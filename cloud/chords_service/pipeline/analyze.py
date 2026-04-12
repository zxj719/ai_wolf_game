"""Audio analysis: BPM, key detection, per-stem stats, drum patterns, bass notes."""

import numpy as np
import librosa


# Krumhansl-Schmuckler key profiles
_MAJOR_PROFILE = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
_MINOR_PROFILE = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
_KEY_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def detect_bpm(y: np.ndarray, sr: int) -> float:
    """Detect BPM using librosa's beat tracker."""
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    return round(float(np.atleast_1d(tempo)[0]), 1)


def detect_key(y: np.ndarray, sr: int) -> dict:
    """Detect musical key using Krumhansl-Schmuckler algorithm.

    Returns dict with 'key', 'mode' (major/minor), 'confidence'.
    """
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    chroma_mean = np.mean(chroma, axis=1)

    best_corr = -1
    best_key = "C"
    best_mode = "major"

    for shift in range(12):
        shifted = np.roll(chroma_mean, -shift)
        corr_major = float(np.corrcoef(shifted, _MAJOR_PROFILE)[0, 1])
        corr_minor = float(np.corrcoef(shifted, _MINOR_PROFILE)[0, 1])

        if corr_major > best_corr:
            best_corr = corr_major
            best_key = _KEY_NAMES[shift]
            best_mode = "major"
        if corr_minor > best_corr:
            best_corr = corr_minor
            best_key = _KEY_NAMES[shift]
            best_mode = "minor"

    return {"key": best_key, "mode": best_mode, "confidence": round(best_corr, 3)}


def analyze_stem(path: str, sr: int = 22050) -> dict:
    """Compute statistics for a single stem.

    Returns dict with peak_db, rms_db, freq_centroid_hz, bandwidth_hz, panning.
    """
    y, _ = librosa.load(path, sr=sr, mono=False)

    # Handle stereo
    if y.ndim == 2 and y.shape[0] == 2:
        left_rms = float(np.sqrt(np.mean(y[0] ** 2)))
        right_rms = float(np.sqrt(np.mean(y[1] ** 2)))
        total = left_rms + right_rms
        panning = round((right_rms - left_rms) / total, 3) if total > 1e-10 else 0.0
        y_mono = librosa.to_mono(y)
    else:
        y_mono = y if y.ndim == 1 else y[0]
        panning = 0.0

    peak = float(np.max(np.abs(y_mono)))
    rms = float(np.sqrt(np.mean(y_mono ** 2)))

    peak_db = round(20 * np.log10(peak + 1e-10), 1)
    rms_db = round(20 * np.log10(rms + 1e-10), 1)

    # Spectral features
    centroid = librosa.feature.spectral_centroid(y=y_mono, sr=sr)
    bandwidth = librosa.feature.spectral_bandwidth(y=y_mono, sr=sr)

    freq_centroid = round(float(np.mean(centroid)), 0)
    freq_bandwidth = round(float(np.mean(bandwidth)), 0)

    # Frequency range (where most energy lives)
    S = np.abs(librosa.stft(y_mono))
    freqs = librosa.fft_frequencies(sr=sr)
    energy = np.mean(S, axis=1)
    cumulative = np.cumsum(energy) / (np.sum(energy) + 1e-10)
    low_idx = int(np.searchsorted(cumulative, 0.05))
    high_idx = int(np.searchsorted(cumulative, 0.95))
    freq_low = round(float(freqs[low_idx]))
    freq_high = round(float(freqs[min(high_idx, len(freqs) - 1)]))

    return {
        "peak_db": peak_db,
        "rms_db": rms_db,
        "freq_centroid_hz": freq_centroid,
        "freq_bandwidth_hz": freq_bandwidth,
        "freq_range": [freq_low, freq_high],
        "panning": panning,
    }


def analyze_drum_pattern(drum_path: str, sr: int = 22050, n_bars: int = 4) -> dict:
    """Analyze drum stem to extract onset pattern.

    Separates into 3 frequency bands (kick, snare, hihat) and detects onsets.
    Returns onset times for each band.
    """
    y, _ = librosa.load(drum_path, sr=sr, mono=True)

    # 3-band split for drum analysis
    # Kick: < 200Hz, Snare: 200-5000Hz, Hihat: > 5000Hz
    S = librosa.stft(y)
    freqs = librosa.fft_frequencies(sr=sr)

    kick_mask = freqs < 200
    snare_mask = (freqs >= 200) & (freqs < 5000)
    hihat_mask = freqs >= 5000

    def get_onsets(mask):
        S_band = np.zeros_like(S)
        S_band[mask] = S[mask]
        y_band = librosa.istft(S_band)
        onset_frames = librosa.onset.onset_detect(y=y_band, sr=sr, units='frames')
        onset_times = librosa.frames_to_time(onset_frames, sr=sr)
        return onset_times.tolist()

    return {
        "kick": get_onsets(kick_mask),
        "snare": get_onsets(snare_mask),
        "hihat": get_onsets(hihat_mask),
    }


def analyze_bass_notes(bass_path: str, sr: int = 22050) -> list[dict]:
    """Detect bass notes over time using pitch tracking.

    Returns list of {time, freq_hz, note_name, midi}.
    """
    y, _ = librosa.load(bass_path, sr=sr, mono=True)

    # Use pyin for pitch tracking (good for monophonic bass)
    f0, voiced_flag, _ = librosa.pyin(
        y, fmin=30, fmax=500, sr=sr, frame_length=4096
    )
    times = librosa.times_like(f0, sr=sr)

    notes = []
    prev_midi = -1
    for t, freq, voiced in zip(times, f0, voiced_flag):
        if not voiced or np.isnan(freq):
            prev_midi = -1
            continue
        midi = int(round(librosa.hz_to_midi(freq)))
        if midi == prev_midi:
            continue  # same note, skip
        prev_midi = midi
        note_name = librosa.midi_to_note(midi)
        notes.append({
            "time": round(float(t), 3),
            "freq_hz": round(float(freq), 1),
            "note": note_name,
            "midi": midi,
        })

    return notes


def analyze_structure(y: np.ndarray, sr: int) -> list[dict]:
    """Detect song structure (intro, verse, chorus, etc.) using
    multi-feature analysis: chroma + MFCC + energy."""
    from scipy.spatial.distance import cdist
    from scipy.signal import find_peaks

    # Beat tracking for beat-sync features
    tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
    if len(beats) < 4:
        return []

    beat_times = librosa.frames_to_time(beats, sr=sr)

    # Multi-feature extraction for better discrimination
    # 1. Chroma (harmonic content — distinguishes verse from chorus)
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    chroma_sync = librosa.util.sync(chroma, beats, aggregate=np.median)

    # 2. MFCC (timbral texture — distinguishes sparse from dense sections)
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    mfcc_sync = librosa.util.sync(mfcc, beats, aggregate=np.median)

    # 3. RMS energy contour
    rms = librosa.feature.rms(y=y)[0]
    rms_frames = librosa.util.sync(rms.reshape(1, -1), beats, aggregate=np.mean)

    # Combine features (chroma + MFCC + energy)
    combined = np.vstack([chroma_sync, mfcc_sync, rms_frames])

    # Self-similarity matrix
    R = 1 - cdist(combined.T, combined.T, metric='cosine')

    # Novelty curve from checkerboard kernel
    novelty = np.zeros(R.shape[0])
    kernel_size = min(8, R.shape[0] // 4)
    for i in range(kernel_size, R.shape[0] - kernel_size):
        before = R[i - kernel_size:i, i - kernel_size:i]
        after = R[i:i + kernel_size, i:i + kernel_size]
        cross = R[i - kernel_size:i, i:i + kernel_size]
        novelty[i] = np.mean(before) + np.mean(after) - 2 * np.mean(cross)

    # Find section boundaries from novelty peaks
    peaks, _ = find_peaks(novelty, height=np.percentile(novelty, 75),
                          distance=max(4, len(novelty) // 20))

    boundaries = [0] + [int(p) for p in peaks] + [len(beat_times) - 1]
    boundaries = sorted(set(boundaries))

    sections = []
    for i in range(len(boundaries) - 1):
        b_start = boundaries[i]
        b_end = boundaries[i + 1]
        if b_start >= len(beat_times) or b_end >= len(beat_times):
            continue
        sections.append({
            "index": i + 1,
            "time_start": round(float(beat_times[b_start]), 2),
            "time_end": round(float(beat_times[min(b_end, len(beat_times) - 1)]), 2),
        })

    # Label sections by combined feature similarity
    if len(sections) >= 2 and combined.shape[1] > 0:
        section_features = []
        section_energy = []
        for sec in sections:
            t_start = sec["time_start"]
            t_end = sec["time_end"]
            beat_start = np.searchsorted(beat_times, t_start)
            beat_end = np.searchsorted(beat_times, t_end)
            beat_start = min(beat_start, combined.shape[1] - 1)
            beat_end = min(beat_end, combined.shape[1])
            if beat_end > beat_start:
                feat = np.mean(combined[:, beat_start:beat_end], axis=1)
            else:
                feat = np.zeros(combined.shape[0])
            section_features.append(feat)

            s_start = int(t_start * sr)
            s_end = min(int(t_end * sr), len(y))
            if s_end > s_start:
                section_energy.append(float(np.sqrt(np.mean(y[s_start:s_end] ** 2))))
            else:
                section_energy.append(0.0)

        # Adaptive threshold: use the distribution of pairwise similarities
        all_sims = []
        for i in range(len(section_features)):
            for j in range(i + 1, len(section_features)):
                n1 = np.linalg.norm(section_features[i])
                n2 = np.linalg.norm(section_features[j])
                if n1 > 0 and n2 > 0:
                    all_sims.append(float(
                        np.dot(section_features[i], section_features[j]) / (n1 * n2)
                    ))
        if all_sims:
            # Threshold = mean similarity — this ensures roughly half are different
            sim_threshold = np.mean(all_sims)
        else:
            sim_threshold = 0.90

        # Cluster sections
        labels = ["A"]
        label_map = {"A": [section_features[0]]}
        next_label = ord("B")
        for i in range(1, len(section_features)):
            best_match = None
            best_sim = -1
            for lbl, feats in label_map.items():
                cluster_mean = np.mean(feats, axis=0)
                n1 = np.linalg.norm(section_features[i])
                n2 = np.linalg.norm(cluster_mean)
                if n1 > 0 and n2 > 0:
                    sim = float(np.dot(section_features[i], cluster_mean) / (n1 * n2))
                else:
                    sim = 0
                if sim > best_sim:
                    best_sim = sim
                    best_match = lbl
            if best_sim > sim_threshold:
                labels.append(best_match)
                label_map[best_match].append(section_features[i])
            else:
                new_label = chr(next_label)
                next_label += 1
                labels.append(new_label)
                label_map[new_label] = [section_features[i]]

        for sec, lbl in zip(sections, labels):
            sec["label"] = lbl

        _name_sections(sections, section_energy, len(y) / sr)

    return sections


def _name_sections(
    sections: list[dict], energies: list[float], total_duration: float
) -> None:
    """Assign musical names (Intro, Verse, Chorus, etc.) to sections.

    Heuristics:
    - First section < 15s → Intro
    - Last section if energy drops → Outro
    - High-energy sections that repeat → Chorus
    - Lower-energy sections that repeat → Verse
    - Sections appearing once after chorus → Bridge
    - Remaining → Pre-Chorus or Interlude
    """
    n = len(sections)
    if n == 0:
        return

    max_energy = max(energies) if energies else 1.0
    if max_energy < 1e-10:
        max_energy = 1.0
    norm_energy = [e / max_energy for e in energies]

    # Count how many times each label appears
    label_counts = {}
    for sec in sections:
        lbl = sec["label"]
        label_counts[lbl] = label_counts.get(lbl, 0) + 1

    # Average energy per label
    label_energy = {}
    for sec, en in zip(sections, norm_energy):
        lbl = sec["label"]
        if lbl not in label_energy:
            label_energy[lbl] = []
        label_energy[lbl].append(en)
    label_avg_energy = {lbl: sum(vals)/len(vals) for lbl, vals in label_energy.items()}

    # Find the most repeated labels
    repeating = {lbl for lbl, cnt in label_counts.items() if cnt >= 2}

    # Among repeating labels, highest energy → Chorus, next → Verse
    chorus_label = None
    verse_label = None
    if repeating:
        sorted_rep = sorted(repeating, key=lambda l: label_avg_energy.get(l, 0), reverse=True)
        chorus_label = sorted_rep[0]
        if len(sorted_rep) > 1:
            verse_label = sorted_rep[1]

    # Name mapping for each label
    label_name_map = {}
    if chorus_label:
        label_name_map[chorus_label] = "Chorus"
    if verse_label:
        label_name_map[verse_label] = "Verse"

    # Name remaining labels
    other_idx = 0
    other_names = ["Bridge", "Pre-Chorus", "Interlude", "Break", "Hook"]
    for lbl in sorted(label_counts.keys()):
        if lbl in label_name_map:
            continue
        if label_counts[lbl] >= 2 and lbl not in label_name_map:
            label_name_map[lbl] = other_names[other_idx % len(other_names)]
            other_idx += 1
        else:
            label_name_map[lbl] = other_names[other_idx % len(other_names)]
            other_idx += 1

    # Apply names
    for i, sec in enumerate(sections):
        name = label_name_map.get(sec["label"], sec["label"])

        # Override: first section if short-ish → Intro
        if i == 0 and sec["time_end"] - sec["time_start"] < 25:
            name = "Intro"

        # Override: last section if energy drops significantly → Outro
        if i == n - 1 and norm_energy[i] < 0.4:
            name = "Outro"

        sec["name"] = name


def analyze_section_arrangement(
    y: np.ndarray,
    sr: int,
    structure: list[dict],
    stem_paths: dict[str, str],
) -> list[dict]:
    """Summarize which stems are active in each detected section."""
    if not structure or not stem_paths:
        return []

    stem_audio = {}
    stem_global_rms = {}
    for stem_name, path in stem_paths.items():
        y_stem, _ = librosa.load(path, sr=sr, mono=True)
        stem_audio[stem_name] = y_stem
        stem_global_rms[stem_name] = float(np.sqrt(np.mean(y_stem ** 2))) if len(y_stem) else 0.0

    mix_rms_values = []
    section_details = []
    for index, section in enumerate(structure, start=1):
        start = max(0, int(section.get("time_start", 0.0) * sr))
        end = min(len(y), int(section.get("time_end", 0.0) * sr))
        if end <= start:
            section_slice = np.zeros(1, dtype=float)
        else:
            section_slice = y[start:end]

        mix_rms = float(np.sqrt(np.mean(section_slice ** 2))) if len(section_slice) else 0.0
        mix_rms_values.append(mix_rms)

        stem_activity = {}
        strongest = 0.0
        for stem_name, y_stem in stem_audio.items():
            stem_end = min(len(y_stem), end)
            if stem_end <= start:
                rms = 0.0
            else:
                window = y_stem[start:stem_end]
                rms = float(np.sqrt(np.mean(window ** 2))) if len(window) else 0.0
            strongest = max(strongest, rms)
            global_rms = stem_global_rms.get(stem_name, 0.0)
            relative_to_stem = rms / (global_rms + 1e-10) if global_rms > 0 else 0.0
            stem_activity[stem_name] = {
                "rms_db": round(20 * np.log10(rms + 1e-10), 1),
                "relative_to_stem": round(relative_to_stem, 3),
            }

        prominence_cutoff = strongest * 0.25 if strongest > 0 else 0.0
        active_stems = [
            stem_name
            for stem_name, payload in sorted(
                stem_activity.items(),
                key=lambda item: item[1]["rms_db"],
                reverse=True,
            )
            if payload["relative_to_stem"] >= 0.18 and (10 ** (payload["rms_db"] / 20)) >= prominence_cutoff
        ]

        section_details.append(
            {
                "index": index,
                "name": section.get("name") or section.get("label") or f"Section {index}",
                "label": section.get("label", ""),
                "time_start": round(float(section.get("time_start", 0.0)), 2),
                "time_end": round(float(section.get("time_end", 0.0)), 2),
                "mix_rms_db": round(20 * np.log10(mix_rms + 1e-10), 1),
                "active_stems": active_stems,
                "density": len(active_stems),
                "stem_activity": stem_activity,
            }
        )

    if mix_rms_values:
        low_cut = float(np.quantile(mix_rms_values, 0.33))
        high_cut = float(np.quantile(mix_rms_values, 0.66))
    else:
        low_cut = high_cut = 0.0

    for detail, mix_rms in zip(section_details, mix_rms_values):
        if mix_rms <= low_cut:
            energy_level = "low"
        elif mix_rms >= high_cut:
            energy_level = "high"
        else:
            energy_level = "medium"
        detail["energy_level"] = energy_level

    return section_details


def run_full_analysis(
    original_path: str,
    stem_paths: dict[str, str],
    sr: int = 22050,
) -> dict:
    """Run complete analysis on original audio and stems.

    Returns a comprehensive analysis dict.
    """
    print("  Analyzing BPM...")
    y, _ = librosa.load(original_path, sr=sr, mono=True)
    bpm = detect_bpm(y, sr)

    print("  Detecting key...")
    key_info = detect_key(y, sr)

    duration = round(len(y) / sr, 2)

    print("  Analyzing song structure...")
    structure = analyze_structure(y, sr)

    print("  Summarizing section arrangement...")
    section_arrangement = analyze_section_arrangement(y, sr, structure, stem_paths)

    print("  Analyzing stems...")
    stem_stats = {}
    for name, path in stem_paths.items():
        stem_stats[name] = analyze_stem(path, sr)

    print("  Analyzing drum pattern...")
    drum_pattern = {}
    if "drums" in stem_paths:
        drum_pattern = analyze_drum_pattern(stem_paths["drums"], sr)

    print("  Tracking bass notes...")
    bass_notes = []
    if "bass" in stem_paths:
        bass_notes = analyze_bass_notes(stem_paths["bass"], sr)

    return {
        "bpm": bpm,
        "key": key_info,
        "duration": duration,
        "structure": structure,
        "section_arrangement": section_arrangement,
        "stems": stem_stats,
        "drum_pattern": drum_pattern,
        "bass_notes": bass_notes,
    }
