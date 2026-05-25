"""Convert WAV files to MP3 using pydub. Used by chords-manage.mjs publish."""
import sys
from pathlib import Path

try:
    import imageio_ffmpeg
    import pydub
    pydub.AudioSegment.converter = imageio_ffmpeg.get_ffmpeg_exe()
except ImportError:
    pass

from pydub import AudioSegment

def convert(wav_path: str, mp3_path: str, bitrate: str = "192k") -> None:
    audio = AudioSegment.from_wav(wav_path)
    audio.export(mp3_path, format="mp3", bitrate=bitrate)

if __name__ == "__main__":
    src = Path(sys.argv[1])
    dst = Path(sys.argv[2]) if len(sys.argv) > 2 else src.with_suffix(".mp3")
    bitrate = sys.argv[3] if len(sys.argv) > 3 else "192k"
    convert(str(src), str(dst), bitrate)
    print(f"{src.name} -> {dst.name} ({dst.stat().st_size / 1024:.0f} KB)")
