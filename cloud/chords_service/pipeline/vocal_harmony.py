"""Vocal harmony separation: split a vocal stem into individual voice parts.

Uses iterative pitch detection + spectral subtraction:
1. Detect dominant voice via pyin pitch tracking
2. Build harmonic mask for that voice
3. Extract voice audio, subtract from residual
4. Repeat for next voice

This approach is more robust than multi-F0 because pyin is well-proven
for monophonic pitch tracking, and iterative subtraction avoids the
confusion of trying to detect multiple pitches simultaneously.
"""

import os
import numpy as np
import librosa
import soundfile as sf
from scipy.ndimage import median_filter


def _build_harmonic_mask(
    S_mag: np.ndarray,
    freqs: np.ndarray,
    f0_contour: np.ndarray,
    times: np.ndarray,
    sr: int,
    hop_length: int,
    n_harmonics: int = 10,
    bandwidth_cents: float = 80,
) -> np.ndarray:
    """Build a soft time-frequency mask for a voice from its pitch contour.

    For each frame where f0 is active, creates Gaussian-weighted bands
    around each harmonic (f0, 2*f0, 3*f0, ...).
    """
    n_freq, n_frames = S_mag.shape
    mask = np.zeros_like(S_mag)

    for t in range(min(len(f0_contour), n_frames)):
        f0 = f0_contour[t]
        if f0 <= 0 or np.isnan(f0):
            continue

        for h in range(1, n_harmonics + 1):
            hf = f0 * h
            if hf > sr / 2:
                break

            # Convert bandwidth from cents to Hz at this frequency
            bw_hz = hf * (2 ** (bandwidth_cents / 1200) - 1)

            # Gaussian weighting around harmonic frequency
            weight = np.exp(-0.5 * ((freqs - hf) / (bw_hz / 2)) ** 2)
            # Decay higher harmonics
            weight *= 1.0 / (h ** 0.5)

            mask[:, t] = np.maximum(mask[:, t], weight)

    return mask


def _extract_voice_pyin(
    y: np.ndarray,
    sr: int,
    fmin: float = 80,
    fmax: float = 1200,
    frame_length: int = 2048,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Run pyin pitch detection on audio.

    Returns (f0, voiced_flag, voiced_prob).
    """
    f0, voiced_flag, voiced_prob = librosa.pyin(
        y, fmin=fmin, fmax=fmax, sr=sr,
        frame_length=frame_length,
    )
    return f0, voiced_flag, voiced_prob


def _smooth_f0(f0: np.ndarray, voiced: np.ndarray, window: int = 5) -> np.ndarray:
    """Smooth pitch contour with median filter, only on voiced regions."""
    smoothed = f0.copy()
    active = voiced & ~np.isnan(f0)
    if np.sum(active) < window:
        return smoothed

    # Convert to MIDI for smoother filtering
    midi = np.full_like(f0, np.nan)
    midi[active] = librosa.hz_to_midi(f0[active])

    # Find contiguous voiced regions and smooth each
    changes = np.diff(active.astype(int))
    starts = np.where(changes == 1)[0] + 1
    ends = np.where(changes == -1)[0] + 1
    if active[0]:
        starts = np.concatenate([[0], starts])
    if active[-1]:
        ends = np.concatenate([ends, [len(f0)]])

    for s, e in zip(starts, ends):
        if e - s >= window:
            midi[s:e] = median_filter(midi[s:e], size=window)

    valid = ~np.isnan(midi)
    smoothed[valid] = librosa.midi_to_hz(midi[valid])
    smoothed[~valid] = 0
    return smoothed


def _contour_to_melody(
    f0: np.ndarray, voiced: np.ndarray, times: np.ndarray
) -> list[dict]:
    """Convert pitch contour to note events, grouping same-pitch frames."""
    notes = []
    current = None
    n = min(len(f0), len(times))

    for i in range(n):
        freq = f0[i]
        t = float(times[i])
        active = voiced[i] and not np.isnan(freq) and freq > 0

        if not active:
            if current is not None:
                current["duration"] = round(t - current["time"], 4)
                if current["duration"] > 0.04:
                    notes.append(current)
                current = None
            continue

        midi = int(round(librosa.hz_to_midi(freq)))

        if current is None or abs(midi - current["midi"]) > 1:
            if current is not None:
                current["duration"] = round(t - current["time"], 4)
                if current["duration"] > 0.04:
                    notes.append(current)

            current = {
                "time": round(t, 4),
                "duration": 0,
                "midi": midi,
                "note": librosa.midi_to_note(midi),
                "freq_hz": round(float(freq), 1),
            }

    if current is not None and n > 0:
        current["duration"] = round(float(times[n - 1]) - current["time"], 4)
        if current["duration"] > 0.04:
            notes.append(current)

    return notes


def separate_harmonies(
    vocal_path: str,
    output_dir: str,
    max_voices: int = 4,
    sr: int = 22050,
    min_voice_duration: float = 3.0,
) -> dict:
    """Separate a vocal stem into individual harmony parts.

    Uses iterative pitch detection + spectral subtraction:
    - Detect strongest voice with pyin
    - Extract it via harmonic masking
    - Subtract from spectrogram
    - Repeat for remaining voices

    Args:
        vocal_path: Path to the vocal stem WAV.
        output_dir: Output directory for voice WAV files.
        max_voices: Maximum number of voices to separate.
        sr: Sample rate.
        min_voice_duration: Minimum seconds of voiced content to keep a voice.

    Returns dict with 'voices' list and 'n_voices' count.
    """
    os.makedirs(output_dir, exist_ok=True)
    base_name = os.path.splitext(os.path.basename(vocal_path))[0]

    print("    Loading vocal stem...")
    y_original, _ = librosa.load(vocal_path, sr=sr, mono=True)

    # STFT of original
    n_fft = 2048
    hop_length = 512
    S_original = librosa.stft(y_original, n_fft=n_fft, hop_length=hop_length)
    S_mag = np.abs(S_original)
    S_phase = np.angle(S_original)
    freqs = librosa.fft_frequencies(sr=sr, n_fft=n_fft)
    times = librosa.times_like(S_mag, sr=sr, hop_length=hop_length)

    # Track remaining energy
    S_residual = S_mag.copy()

    voices = []
    voice_masks = []

    for v_idx in range(max_voices):
        print(f"    Detecting voice {v_idx + 1}...")

        # Reconstruct audio from residual for pyin
        y_residual = librosa.istft(
            S_residual * np.exp(1j * S_phase),
            hop_length=hop_length,
        )

        # Check if there's enough energy left
        rms = np.sqrt(np.mean(y_residual ** 2))
        if rms < 0.005:
            print(f"    Residual too quiet (RMS={rms:.4f}), stopping.")
            break

        # Detect pitch in residual
        f0, voiced, prob = _extract_voice_pyin(
            y_residual, sr, fmin=100, fmax=1100,
        )

        voiced_frames = np.sum(voiced & ~np.isnan(f0))
        voiced_seconds = voiced_frames * hop_length / sr
        print(f"      Voiced: {voiced_seconds:.1f}s ({voiced_frames} frames)")

        if voiced_seconds < min_voice_duration:
            print(f"      Too short (<{min_voice_duration}s), stopping.")
            break

        # Smooth the contour
        f0_smooth = _smooth_f0(f0, voiced, window=5)

        # Build harmonic mask
        mask = _build_harmonic_mask(
            S_mag, freqs, f0_smooth, times, sr, hop_length,
            n_harmonics=10, bandwidth_cents=80,
        )

        voice_masks.append(mask)

        # Subtract this voice's energy from residual
        # Use soft subtraction to avoid artifacts
        S_residual = np.maximum(S_residual - S_mag * mask * 0.8, 0)

        # Store voice info
        melody = _contour_to_melody(f0_smooth, voiced & ~np.isnan(f0), times)
        active_midi = librosa.hz_to_midi(f0_smooth[f0_smooth > 0])

        voices.append({
            "f0": f0_smooth,
            "voiced": voiced & ~np.isnan(f0),
            "melody": melody,
            "midi_range": (
                int(round(np.min(active_midi))) if len(active_midi) > 0 else 0,
                int(round(np.max(active_midi))) if len(active_midi) > 0 else 0,
            ),
            "median_midi": float(np.median(active_midi)) if len(active_midi) > 0 else 0,
            "voiced_pct": round(100 * voiced_seconds / (len(y_original) / sr), 1),
        })

    if not voices:
        print("    No voice parts detected.")
        return {"voices": [], "n_voices": 0}

    # Wiener-like normalization of all masks
    print(f"    Separating {len(voices)} voices via Wiener masking...")
    mask_sum = np.sum(voice_masks, axis=0) + 1e-10
    normalized_masks = [m / mask_sum for m in voice_masks]

    # Also create a residual mask for anything not captured
    captured = np.sum(voice_masks, axis=0)
    captured = np.minimum(captured, 1.0)

    # Sort voices by median pitch (high to low)
    order = sorted(range(len(voices)), key=lambda i: voices[i]["median_midi"], reverse=True)
    voices = [voices[i] for i in order]
    normalized_masks = [normalized_masks[i] for i in order]

    # Name voices
    names = _assign_voice_names(len(voices))

    # Apply masks and save
    result_voices = []
    for i, (voice, mask, name) in enumerate(zip(voices, normalized_masks, names)):
        S_voice = S_mag * mask * np.exp(1j * S_phase)
        y_voice = librosa.istft(S_voice, hop_length=hop_length)

        voice_path = os.path.join(output_dir, f"{base_name}_voice{i+1}_{name.lower()}.wav")
        sf.write(voice_path, y_voice, sr)

        midi_lo, midi_hi = voice["midi_range"]
        if midi_lo > 0:
            range_str = (
                f"{librosa.midi_to_note(midi_lo)}-{librosa.midi_to_note(midi_hi)}"
                .replace('\u266f', '#').replace('\u266d', 'b')
            )
        else:
            range_str = "?"

        print(f"      {name}: {range_str}, {len(voice['melody'])} notes, "
              f"{voice['voiced_pct']}% active")

        result_voices.append({
            "path": voice_path,
            "name": name,
            "range": range_str,
            "range_midi": [midi_lo, midi_hi],
            "melody": voice["melody"],
            "active_pct": voice["voiced_pct"],
        })

    return {
        "voices": result_voices,
        "n_voices": len(result_voices),
    }


def _assign_voice_names(n: int) -> list[str]:
    """Assign voice part names based on count."""
    if n == 1:
        return ["Lead"]
    elif n == 2:
        return ["Lead", "Harmony"]
    elif n == 3:
        return ["High", "Mid", "Low"]
    elif n == 4:
        return ["Soprano", "Alto", "Tenor", "Bass"]
    else:
        names = ["Soprano", "Alto", "Tenor", "Bass"]
        for i in range(4, n):
            names.append(f"Voice{i + 1}")
        return names
