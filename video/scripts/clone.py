"""Records the narration in one voice: every line spoken by F5-TTS, cloned from the same few seconds of Sulafat
(assets/sulafat-reference.wav), so no line can drift into another voice the way separate requests to a hosted model do.
Each line gets several takes, one per seed, into public/candidates/ (more for the lines named as arguments); scripts/listen.py --pick keeps the take that sounds
most like the reference and says exactly its line without a pause inside it.

Runs in the transcription project's F5-TTS environment:
    ../../transcription/.venv-tts/Scripts/python.exe scripts/clone.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(r"C:\Projects\transcription\scripts")))
from _torchaudio_soundfile import install as patch_audio  # noqa: E402

SEEDS = [11, 23, 37, 51]
# More takes for the lines named on the command line, when none of the first passed
MORE = [67, 79, 83, 97, 101, 113, 127, 131, 137, 139, 149, 151, 157, 163]
# A little slower than F5's default, the pace of a narrator rather than a conversation
SPEED = 0.92


def main() -> int:
    patch_audio()
    from f5_tts.api import F5TTS

    lines = json.loads((HERE / "out" / "script.json").read_text(encoding="utf8"))
    ref = HERE / "assets" / "sulafat-reference.wav"
    ref_text = (HERE / "assets" / "sulafat-reference.txt").read_text(encoding="utf8").strip()
    out = HERE / "public" / "candidates"
    out.mkdir(parents=True, exist_ok=True)
    f5 = F5TTS(device="cuda")
    only = set(sys.argv[1:])
    for line in lines:
        if only and line["key"] not in only:
            continue
        for seed in SEEDS + (MORE if only else []):
            dest = out / f"{line['key']}@{seed}.wav"
            # A take of the same text and seed is the same take: kept
            stamp = dest.with_suffix(".txt")
            if dest.exists() and stamp.exists() and stamp.read_text(encoding="utf8") == line["text"]:
                continue
            f5.infer(ref_file=str(ref), ref_text=ref_text, gen_text=line["text"], file_wave=str(dest), remove_silence=True, seed=seed, speed=SPEED)
            stamp.write_text(line["text"], encoding="utf8")
        print(line["key"], flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
