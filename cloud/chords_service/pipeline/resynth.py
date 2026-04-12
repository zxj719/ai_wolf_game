"""Resynthesis: transcribe stems to note events + extract timbre samples.

Converts each separated stem into:
1. A MIDI-like note event list (pitch, timing, duration, velocity)
2. Articulation & expression annotations (ornaments, grace notes, legato, syncopation)
3. A short timbre sample extracted from the stem for resynthesis

This allows reconstructing the entire song from scratch using the
extracted timbres, and swapping timbres between tracks.
"""

import os
import numpy as np
import librosa
import soundfile as sf


# --- Articulation / expression analysis helpers ---

def _detect_vibrato(f0_segment: np.ndarray, sr: int, hop: int = 512) -> dict | None:
    """Detect vibrato in a pitch contour segment.

    Vibrato is a periodic pitch oscillation, typically 4-8 Hz with
    depth of 20-100 cents. Returns {rate_hz, depth_cents} or None.
    """
    if len(f0_segment) < 10:
        return None

    valid = ~np.isnan(f0_segment)
    if np.sum(valid) < 10:
        return None

    # Interpolate NaNs for analysis
    f0_clean = f0_segment.copy()
    if np.any(~valid):
        f0_clean[~valid] = np.interp(
            np.where(~valid)[0], np.where(valid)[0], f0_segment[valid]
        )

    # Convert to cents deviation from mean
    mean_freq = np.mean(f0_clean)
    if mean_freq < 20:
        return None
    cents = 1200 * np.log2(f0_clean / mean_freq + 1e-10)

    # Remove DC and trend
    cents = cents - np.mean(cents)
    if len(cents) < 8:
        return None

    # FFT to find periodic oscillation
    frame_rate = sr / hop
    fft = np.abs(np.fft.rfft(cents * np.hanning(len(cents))))
    freqs = np.fft.rfftfreq(len(cents), d=1.0 / frame_rate)

    # Look for peaks in vibrato range (4-8 Hz)
    vib_mask = (freqs >= 3.5) & (freqs <= 9.0)
    if not np.any(vib_mask):
        return None

    fft_vib = fft.copy()
    fft_vib[~vib_mask] = 0
    peak_idx = np.argmax(fft_vib)

    if fft_vib[peak_idx] < 5:  # minimum vibrato amplitude in cents
        return None

    # Verify it's significantly periodic (peak > 2x mean of vibrato band)
    vib_mean = np.mean(fft[vib_mask])
    if fft[peak_idx] < 2.0 * vib_mean:
        return None

    depth = round(float(np.std(cents) * 2), 1)  # ~peak-to-peak in cents
    if depth < 15:
        return None

    return {
        "rate_hz": round(float(freqs[peak_idx]), 1),
        "depth_cents": depth,
    }


def _detect_pitch_bend(f0_segment: np.ndarray) -> dict | None:
    """Detect pitch bend/slide at note start or end.

    Returns {type: "slide_up"|"slide_down"|"bend_up"|"bend_down",
             cents: amount, position: "attack"|"release"} or None.
    """
    valid = ~np.isnan(f0_segment)
    if np.sum(valid) < 6:
        return None

    f0_clean = f0_segment[valid]
    n = len(f0_clean)
    if n < 6:
        return None

    mean_freq = np.mean(f0_clean)
    if mean_freq < 20:
        return None

    cents = 1200 * np.log2(f0_clean / mean_freq + 1e-10)

    # Check attack (first 20% of note)
    attack_len = max(3, n // 5)
    attack = cents[:attack_len]
    attack_slope = (attack[-1] - attack[0])

    # Check release (last 20% of note)
    release_len = max(3, n // 5)
    release = cents[-release_len:]
    release_slope = (release[-1] - release[0])

    # Significant bend = >50 cents deviation
    if abs(attack_slope) > 50:
        return {
            "type": "slide_up" if attack_slope > 0 else "slide_down",
            "cents": round(abs(float(attack_slope)), 0),
            "position": "attack",
        }
    if abs(release_slope) > 50:
        return {
            "type": "bend_up" if release_slope > 0 else "bend_down",
            "cents": round(abs(float(release_slope)), 0),
            "position": "release",
        }
    return None


def _classify_articulation(
    onset_strength: float, note_duration: float, has_clear_onset: bool
) -> str:
    """Classify note articulation based on onset strength and duration.

    Returns: "staccato", "legato", "accent", or "normal".
    """
    if note_duration < 0.08:
        return "staccato"
    if onset_strength > 0.7 and has_clear_onset:
        return "accent"
    if onset_strength < 0.25 and not has_clear_onset:
        return "legato"
    return "normal"


def _detect_syncopation(
    note_time: float, beat_times: np.ndarray, tolerance: float = 0.06
) -> bool:
    """Check if a note is syncopated (falls between beats).

    A note is syncopated if it doesn't align with any beat position
    and falls in the off-beat region (>25% and <75% between beats).
    """
    if len(beat_times) < 2:
        return False

    idx = np.searchsorted(beat_times, note_time)

    # Check if it's close to a beat
    for bi in [idx - 1, idx]:
        if 0 <= bi < len(beat_times):
            if abs(note_time - beat_times[bi]) < tolerance:
                return False

    # Find surrounding beats
    if idx <= 0 or idx >= len(beat_times):
        return False

    beat_before = beat_times[idx - 1]
    beat_after = beat_times[idx]
    beat_interval = beat_after - beat_before
    if beat_interval <= 0:
        return False

    position = (note_time - beat_before) / beat_interval

    # Syncopated if in the off-beat zone (not near 0 or 1)
    return 0.25 < position < 0.75


def _get_onset_strength_at(
    onset_env: np.ndarray, time: float, sr: int, hop: int = 512
) -> float:
    """Get onset envelope strength at a given time."""
    frame = librosa.time_to_frames(time, sr=sr, hop_length=hop)
    frame = max(0, min(frame, len(onset_env) - 1))
    env_max = float(np.max(onset_env)) if np.max(onset_env) > 0 else 1.0
    return float(onset_env[frame]) / env_max


def _is_grace_note(note: dict, next_note: dict | None) -> bool:
    """Detect if a note is a grace note (very short, leading into next note)."""
    if note["duration"] > 0.1:
        return False
    if next_note is None:
        return False
    gap = next_note["time"] - (note["time"] + note["duration"])
    return gap < 0.05  # grace note leads directly into next note


def _detect_trill(f0_segment: np.ndarray) -> dict | None:
    """Detect trill (rapid alternation between two pitches).

    Returns {interval_semitones, speed_hz} or None.
    """
    valid = ~np.isnan(f0_segment)
    if np.sum(valid) < 12:
        return None

    f0_clean = f0_segment[valid]
    midi_vals = librosa.hz_to_midi(f0_clean)
    midi_rounded = np.round(midi_vals)

    # Check for alternation between exactly 2 pitches
    unique_pitches = np.unique(midi_rounded)
    if len(unique_pitches) != 2:
        return None

    interval = abs(unique_pitches[1] - unique_pitches[0])
    if interval < 1 or interval > 3:
        return None

    # Count alternations
    changes = np.sum(np.abs(np.diff(midi_rounded)) >= 0.5)
    if changes < 4:  # need at least 4 alternations for a trill
        return None

    return {
        "interval_semitones": int(interval),
        "alternations": int(changes),
    }


def transcribe_monophonic(
    path: str, sr: int = 22050, fmin: float = 50, fmax: float = 2000
) -> list[dict]:
    """Transcribe a monophonic stem (vocals, bass) to note events.

    Uses pyin for pitch tracking and onset detection for note boundaries.
    Each note event includes articulation, ornaments, syncopation, and
    pitch expression data.

    Returns list of dicts with fields:
        time, duration, midi, note, freq_hz, velocity,
        articulation, ornament, syncopation, vibrato, pitch_bend
    """
    y, _ = librosa.load(path, sr=sr, mono=True)
    hop_length = 512

    # Pitch tracking
    f0, voiced_flag, voiced_prob = librosa.pyin(
        y, fmin=fmin, fmax=fmax, sr=sr, frame_length=2048
    )
    times = librosa.times_like(f0, sr=sr)

    # Onset detection for note boundaries
    onset_frames = librosa.onset.onset_detect(y=y, sr=sr, backtrack=True)
    onset_times = librosa.frames_to_time(onset_frames, sr=sr)

    # Onset strength envelope (for articulation classification)
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)

    # Beat tracking (for syncopation detection)
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)

    # RMS for velocity
    rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=hop_length)[0]
    rms_times = librosa.times_like(rms, sr=sr)
    rms_max = float(np.max(rms)) if np.max(rms) > 0 else 1.0

    # Build note events by grouping consecutive voiced frames with same pitch
    notes = []
    current_note = None
    current_f0_frames = []  # collect raw f0 for expression analysis

    for i, (t, freq, voiced) in enumerate(zip(times, f0, voiced_flag)):
        if not voiced or np.isnan(freq):
            if current_note is not None:
                current_note["duration"] = round(t - current_note["time"], 4)
                current_note["_f0"] = np.array(current_f0_frames)
                if current_note["duration"] > 0.02:
                    notes.append(current_note)
                current_note = None
                current_f0_frames = []
            continue

        midi = int(round(librosa.hz_to_midi(freq)))

        if current_note is None or abs(midi - current_note["midi"]) > 1:
            if current_note is not None:
                current_note["duration"] = round(t - current_note["time"], 4)
                current_note["_f0"] = np.array(current_f0_frames)
                if current_note["duration"] > 0.02:
                    notes.append(current_note)

            rms_idx = np.searchsorted(rms_times, t)
            rms_idx = min(rms_idx, len(rms) - 1)
            velocity = float(rms[rms_idx]) / rms_max

            # Check if this note aligns with a detected onset
            has_clear_onset = any(abs(t - ot) < 0.05 for ot in onset_times)

            current_note = {
                "time": round(float(t), 4),
                "duration": 0,
                "midi": midi,
                "note": librosa.midi_to_note(midi),
                "freq_hz": round(float(freq), 1),
                "velocity": round(velocity, 3),
                "_has_onset": has_clear_onset,
            }
            current_f0_frames = [freq]
        else:
            current_f0_frames.append(freq)

    # Close last note
    if current_note is not None:
        current_note["duration"] = round(float(times[-1]) - current_note["time"], 4)
        current_note["_f0"] = np.array(current_f0_frames)
        if current_note["duration"] > 0.02:
            notes.append(current_note)

    # --- Post-processing: add expression annotations ---
    for i, note in enumerate(notes):
        f0_seg = note.pop("_f0", np.array([]))
        has_onset = note.pop("_has_onset", True)
        next_note = notes[i + 1] if i + 1 < len(notes) else None

        # Onset strength for articulation
        onset_str = _get_onset_strength_at(onset_env, note["time"], sr)

        # Articulation
        note["articulation"] = _classify_articulation(
            onset_str, note["duration"], has_onset
        )

        # Grace note detection
        if _is_grace_note(note, next_note):
            note["ornament"] = "grace_note"
        else:
            # Trill detection
            trill = _detect_trill(f0_seg) if len(f0_seg) > 0 else None
            if trill:
                note["ornament"] = "trill"
                note["trill_info"] = trill
            else:
                note["ornament"] = None

        # Syncopation
        note["syncopation"] = bool(_detect_syncopation(note["time"], beat_times))

        # Vibrato
        note["vibrato"] = _detect_vibrato(f0_seg, sr) if len(f0_seg) > 0 else None

        # Pitch bend / slide
        note["pitch_bend"] = _detect_pitch_bend(f0_seg) if len(f0_seg) > 0 else None

    # Mark legato groups (consecutive legato notes = slur)
    _mark_slur_groups(notes)

    return notes


def _mark_slur_groups(notes: list[dict]) -> None:
    """Mark consecutive legato notes as belonging to a slur group.

    Adds 'slur_group' field: an integer ID shared by connected legato notes,
    or None for non-slurred notes.
    """
    group_id = 0
    in_slur = False

    for i, note in enumerate(notes):
        if note["articulation"] == "legato":
            if not in_slur:
                group_id += 1
                in_slur = True
                # Also mark the previous note as slur start if it exists
                if i > 0 and notes[i - 1].get("slur_group") is None:
                    notes[i - 1]["slur_group"] = group_id
            note["slur_group"] = group_id
        else:
            in_slur = False
            note["slur_group"] = None


def transcribe_drums(path: str, sr: int = 22050) -> dict:
    """Transcribe drum stem to onset events per frequency band.

    Returns dict with 'kick', 'snare', 'hihat' lists of
    {time, velocity, syncopation, ghost_note} events.
    """
    y, _ = librosa.load(path, sr=sr, mono=True)
    S = librosa.stft(y)
    freqs = librosa.fft_frequencies(sr=sr)

    # Beat tracking for syncopation
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)

    bands = {
        "kick": (20, 200),
        "snare": (200, 5000),
        "hihat": (5000, sr // 2),
    }

    result = {}
    for name, (lo, hi) in bands.items():
        mask = (freqs >= lo) & (freqs < hi)
        S_band = np.zeros_like(S)
        S_band[mask] = S[mask]
        y_band = librosa.istft(S_band)

        onset_frames = librosa.onset.onset_detect(y=y_band, sr=sr)
        onset_times = librosa.frames_to_time(onset_frames, sr=sr)

        # Get onset strength for velocity
        onset_env = librosa.onset.onset_strength(y=y_band, sr=sr)
        env_max = float(np.max(onset_env)) if np.max(onset_env) > 0 else 1.0

        events = []
        for frame, t in zip(onset_frames, onset_times):
            if frame < len(onset_env):
                vel = float(onset_env[frame]) / env_max
            else:
                vel = 0.5
            events.append({
                "time": round(float(t), 4),
                "velocity": round(vel, 3),
                "syncopation": bool(_detect_syncopation(float(t), beat_times)),
                "ghost_note": bool(vel < 0.25),
            })

        result[name] = events

    return result


def transcribe_polyphonic(path: str, sr: int = 22050) -> list[dict]:
    """Transcribe polyphonic stem (guitar, keys) to chord-like events.

    Since true polyphonic transcription is extremely hard, we use
    chroma features + onset detection to create events where each
    event has the active pitch classes and their relative strengths.

    Returns list of {time, duration, pitches, velocity, articulation, syncopation}.
    """
    y, _ = librosa.load(path, sr=sr, mono=True)

    # Onset detection
    onset_frames = librosa.onset.onset_detect(y=y, sr=sr, backtrack=True)
    onset_times = librosa.frames_to_time(onset_frames, sr=sr)

    # Beat tracking for syncopation
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)

    # Onset strength for articulation
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)

    # Chroma features
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    hop_length = 512
    pitch_names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

    # RMS for velocity
    rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=hop_length)[0]
    rms_max = float(np.max(rms)) if np.max(rms) > 0 else 1.0

    events = []
    for i in range(len(onset_times)):
        t_start = onset_times[i]
        t_end = onset_times[i + 1] if i + 1 < len(onset_times) else float(len(y) / sr)

        f_start = librosa.time_to_frames(t_start, sr=sr, hop_length=hop_length)
        f_end = librosa.time_to_frames(t_end, sr=sr, hop_length=hop_length)
        f_start = max(0, f_start)
        f_end = min(chroma.shape[1], f_end)

        if f_end <= f_start:
            continue

        chroma_seg = np.median(chroma[:, f_start:f_end], axis=1)
        chroma_max = float(np.max(chroma_seg))
        if chroma_max < 0.1:
            continue  # silence

        # Find active pitch classes (above 40% of peak)
        threshold = chroma_max * 0.4
        pitches = []
        for j in range(12):
            if chroma_seg[j] >= threshold:
                strength = float(chroma_seg[j]) / chroma_max
                # Assign to a reasonable octave based on the stem
                midi_base = 60 + j  # Middle C octave as default
                pitches.append({
                    "midi": midi_base,
                    "note": pitch_names[j],
                    "strength": round(strength, 3),
                })

        # Velocity
        rms_idx = np.searchsorted(
            librosa.times_like(rms, sr=sr), t_start
        )
        rms_idx = min(rms_idx, len(rms) - 1)
        velocity = float(rms[rms_idx]) / rms_max

        # Articulation from onset strength
        onset_str = _get_onset_strength_at(onset_env, t_start, sr)
        has_onset = any(abs(t_start - ot) < 0.05 for ot in onset_times)
        dur = float(t_end - t_start)
        artic = _classify_articulation(onset_str, dur, has_onset)

        events.append({
            "time": round(float(t_start), 4),
            "duration": round(dur, 4),
            "pitches": pitches,
            "velocity": round(velocity, 3),
            "articulation": artic,
            "syncopation": bool(_detect_syncopation(t_start, beat_times)),
        })

    return events


def extract_timbre_sample(
    path: str, stem_type: str, output_dir: str, sr: int = 44100
) -> str:
    """Extract a clean timbre sample from a stem for resynthesis.

    Finds the clearest/loudest segment and extracts ~0.5s as a
    single-cycle-ish wavetable sample.

    Returns path to the saved sample WAV file.
    """
    y, file_sr = librosa.load(path, sr=sr, mono=True)
    base_name = os.path.splitext(os.path.basename(path))[0]
    sample_path = os.path.join(output_dir, f"{base_name}_sample.wav")

    if stem_type == "drums":
        # For drums, extract 3 separate samples (kick, snare, hihat)
        return _extract_drum_samples(y, sr, output_dir, base_name)

    # For tonal stems: find the loudest stable segment
    rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=512)[0]
    rms_times = librosa.times_like(rms, sr=sr)

    # Find segments where RMS is in top 20% and relatively stable
    threshold = np.percentile(rms, 80)
    candidates = np.where(rms > threshold)[0]

    if len(candidates) < 10:
        # Fallback: just use the loudest point
        peak_idx = int(np.argmax(rms))
        center_time = float(rms_times[peak_idx])
    else:
        # Find the most stable high-RMS region (low variance)
        best_var = float('inf')
        best_start = candidates[0]
        window = min(20, len(candidates) // 2)
        for i in range(len(candidates) - window):
            segment = rms[candidates[i]:candidates[i] + window]
            var = float(np.var(segment))
            if var < best_var:
                best_var = var
                best_start = candidates[i]
        center_time = float(rms_times[best_start + window // 2])

    # Extract 0.5s centered on the best point
    sample_duration = 0.5
    start_sample = max(0, int((center_time - sample_duration / 2) * sr))
    end_sample = min(len(y), int((center_time + sample_duration / 2) * sr))
    sample = y[start_sample:end_sample]

    # Apply fade in/out to avoid clicks
    fade_len = min(512, len(sample) // 4)
    sample[:fade_len] *= np.linspace(0, 1, fade_len)
    sample[-fade_len:] *= np.linspace(1, 0, fade_len)

    sf.write(sample_path, sample, sr)
    return sample_path


def _extract_drum_samples(
    y: np.ndarray, sr: int, output_dir: str, base_name: str
) -> dict[str, str]:
    """Extract individual drum hit samples (kick, snare, hihat)."""
    S = librosa.stft(y)
    freqs = librosa.fft_frequencies(sr=sr)

    bands = {
        "kick": (20, 200),
        "snare": (200, 5000),
        "hihat": (5000, sr // 2),
    }

    sample_paths = {}
    for name, (lo, hi) in bands.items():
        mask = (freqs >= lo) & (freqs < hi)
        S_band = np.zeros_like(S)
        S_band[mask] = S[mask]
        y_band = librosa.istft(S_band)

        # Find the strongest onset
        onset_env = librosa.onset.onset_strength(y=y_band, sr=sr)
        onset_frames = librosa.onset.onset_detect(y=y_band, sr=sr)

        if len(onset_frames) == 0:
            continue

        # Find the loudest hit
        best_frame = onset_frames[0]
        best_strength = 0
        for frame in onset_frames:
            if frame < len(onset_env) and onset_env[frame] > best_strength:
                best_strength = onset_env[frame]
                best_frame = frame

        # Extract ~0.2s starting from the onset
        start = librosa.frames_to_samples(best_frame)
        length = int(0.2 * sr)
        end = min(len(y_band), start + length)
        sample = y_band[start:end]

        if len(sample) < 100:
            continue

        # Fade out
        fade_len = min(256, len(sample) // 2)
        sample[-fade_len:] *= np.linspace(1, 0, fade_len)

        sample_path = os.path.join(output_dir, f"{base_name}_{name}_sample.wav")
        sf.write(sample_path, sample, sr)
        sample_paths[name] = sample_path

    return sample_paths


def _print_expression_stats(events: list[dict], label: str) -> None:
    """Print summary of expression annotations for a monophonic transcription."""
    n = len(events)
    grace = sum(1 for e in events if e.get("ornament") == "grace_note")
    trills = sum(1 for e in events if e.get("ornament") == "trill")
    syncopated = sum(1 for e in events if e.get("syncopation"))
    legato = sum(1 for e in events if e.get("articulation") == "legato")
    staccato = sum(1 for e in events if e.get("articulation") == "staccato")
    accents = sum(1 for e in events if e.get("articulation") == "accent")
    vibrato = sum(1 for e in events if e.get("vibrato"))
    bends = sum(1 for e in events if e.get("pitch_bend"))
    slur_groups = len(set(e.get("slur_group") for e in events if e.get("slur_group")))

    print(f"    {n} {label}")
    details = []
    if grace:
        details.append(f"{grace} grace notes")
    if trills:
        details.append(f"{trills} trills")
    if syncopated:
        details.append(f"{syncopated} syncopated")
    if legato:
        details.append(f"{legato} legato")
    if staccato:
        details.append(f"{staccato} staccato")
    if accents:
        details.append(f"{accents} accents")
    if vibrato:
        details.append(f"{vibrato} vibrato")
    if bends:
        details.append(f"{bends} pitch bends")
    if slur_groups:
        details.append(f"{slur_groups} slur groups")
    if details:
        print(f"      Expression: {', '.join(details)}")


def transcribe_all_stems(
    stem_paths: dict[str, str], output_dir: str
) -> dict:
    """Transcribe all stems and extract timbre samples.

    Returns dict with transcription data and sample paths for each stem.
    """
    os.makedirs(output_dir, exist_ok=True)
    result = {}

    for stem_name, stem_path in stem_paths.items():
        print(f"  Transcribing {stem_name}...")

        if stem_name == "drums":
            events = transcribe_drums(stem_path)
            samples = extract_timbre_sample(stem_path, "drums", output_dir)
            total = sum(len(v) for v in events.values())
            print(f"    {total} drum hits (kick={len(events.get('kick',[]))}, "
                  f"snare={len(events.get('snare',[]))}, "
                  f"hihat={len(events.get('hihat',[]))})")
        elif stem_name == "vocals":
            events = transcribe_monophonic(stem_path, fmin=80, fmax=1000)
            samples = extract_timbre_sample(stem_path, "vocals", output_dir)
            _print_expression_stats(events, "vocal notes")
        elif stem_name == "bass":
            events = transcribe_monophonic(stem_path, fmin=30, fmax=500)
            samples = extract_timbre_sample(stem_path, "bass", output_dir)
            _print_expression_stats(events, "bass notes")
        else:  # other, guitar, piano
            events = transcribe_polyphonic(stem_path)
            samples = extract_timbre_sample(stem_path, stem_name, output_dir)
            sync = sum(1 for e in events if e.get("syncopation"))
            leg = sum(1 for e in events if e.get("articulation") == "legato")
            print(f"    {len(events)} polyphonic events"
                  + (f" ({sync} syncopated, {leg} legato)" if sync or leg else ""))

        result[stem_name] = {
            "events": events,
            "samples": samples,
        }

    return result
