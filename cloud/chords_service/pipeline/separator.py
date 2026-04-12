"""Audio stem separation using demucs.

Supports two modes:
- htdemucs: 4 stems (drums, bass, other, vocals) — faster
- htdemucs_6s: 6 stems (drums, bass, other, vocals, guitar, piano) — more detail

Each stem is saved as a separate WAV file.
"""

import os
import numpy as np
import torch
import torchaudio
from demucs.pretrained import get_model
from demucs.apply import apply_model


# Cache models to avoid reloading
_MODELS = {}


def _get_model(name: str = "htdemucs_6s"):
    if name not in _MODELS:
        _MODELS[name] = get_model(name)
        _MODELS[name].eval()
    return _MODELS[name]


def _ensure_ffmpeg():
    """Add bundled ffmpeg to PATH if available."""
    tools_ffmpeg = os.path.join(os.path.dirname(__file__), "tools",
                                "ffmpeg-master-latest-win64-gpl", "bin")
    if os.path.isdir(tools_ffmpeg) and tools_ffmpeg not in os.environ.get("PATH", ""):
        os.environ["PATH"] = tools_ffmpeg + os.pathsep + os.environ.get("PATH", "")


def separate(
    audio_path: str, output_dir: str, model_name: str = "htdemucs_6s"
) -> dict[str, str]:
    """Separate an audio file into stems.

    Args:
        audio_path: Path to mp3 or wav file.
        output_dir: Directory to write stem WAV files.
        model_name: "htdemucs_6s" (6 stems) or "htdemucs" (4 stems).

    Returns:
        Dict mapping stem name to output file path.
        htdemucs_6s keys: 'drums', 'bass', 'other', 'vocals', 'guitar', 'piano'
        htdemucs keys: 'drums', 'bass', 'other', 'vocals'
    """
    _ensure_ffmpeg()
    os.makedirs(output_dir, exist_ok=True)

    model = _get_model(model_name)
    sr = model.samplerate  # 44100

    # Load audio via librosa (avoids torchcodec dependency)
    import librosa
    y, file_sr = librosa.load(audio_path, sr=sr, mono=False)

    # y shape: (channels, samples) or (samples,) if mono
    if y.ndim == 1:
        y = np.stack([y, y])  # mono -> stereo
    elif y.shape[0] > 2:
        y = y[:2]

    wav = torch.from_numpy(y).float()

    # Add batch dimension: (1, 2, T)
    wav = wav.unsqueeze(0)

    # Separate
    with torch.no_grad():
        sources = apply_model(model, wav)

    # sources shape: (1, n_sources, 2, T)
    # model.sources: ['drums', 'bass', 'other', 'vocals']
    stem_paths = {}
    base_name = os.path.splitext(os.path.basename(audio_path))[0]

    import soundfile as sf

    for i, stem_name in enumerate(model.sources):
        stem_audio = sources[0, i].cpu().numpy()  # (2, T)
        out_path = os.path.join(output_dir, f"{base_name}_{stem_name}.wav")
        # soundfile expects (T, channels)
        sf.write(out_path, stem_audio.T, sr)
        stem_paths[stem_name] = out_path

    return stem_paths
