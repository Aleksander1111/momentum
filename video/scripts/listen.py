"""Listens to the narration the way a viewer does, with the speech tools of the transcription project next door.

For every line: who is speaking, as a TitaNet speaker embedding compared with the reference voice
(assets/sulafat-reference.wav), so a line in a different voice is caught; and what is said, word by word with
Whisper's timestamps, so a word wrong or missing, or a pause between two words of a sentence, is caught.

    listen.py          checks the clips in public/voice against src/voice.json; writes out/listen.json
    listen.py --track  checks the narration as the cut renders it (out/voice.wav, from scripts/track.ts) against the
                       timeline scripts/validate.ts writes: each line heard, word for word, starting where it should
    listen.py --pick   from the takes in public/candidates, keeps per line the one that passes and sounds most like
                       the reference, trimmed and faded, into public/voice and src/voice.json

Exits non-zero on any failure. Runs with the transcription project's environment (CUDA torch, NeMo, faster-whisper):
    ../../transcription/.venv/Scripts/python.exe scripts/listen.py
"""
from __future__ import annotations

import json
import math
import re
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
import soxr

HERE = Path(__file__).resolve().parent.parent
VOICE = HERE / "public" / "voice"
TIMING_FILE = HERE / "src" / "voice.json"
REFERENCE = HERE / "assets" / "sulafat-reference.wav"
STAMP = "f5:sulafat-reference"
FPS = 30
# Least likeness to the reference voice, and the longest silence allowed between two words of a sentence and between
# two sentences of a line
SAME = 0.72
# Least likeness of a line to all the others: the Gemini narration, heard to change voice, had ten lines under 0.80
AMONG = 0.80
PAUSE = 0.35
FULL_STOP = 0.8


def read(path: Path) -> tuple[np.ndarray, int]:
    audio, rate = sf.read(path, dtype="float32")
    return (audio.mean(axis=1) if audio.ndim == 2 else audio), rate


def words(s: str) -> list[str]:
    return re.sub(r"[^a-z0-9' ]+", " ", s.lower().replace("-", " ")).split()


class Ear:
    def __init__(self) -> None:
        import torch
        from faster_whisper import WhisperModel
        from nemo.collections.asr.models import EncDecSpeakerLabelModel

        self.torch = torch
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.titanet = EncDecSpeakerLabelModel.from_pretrained("nvidia/speakerverification_en_titanet_large").to(self.device).eval()
        self.whisper = WhisperModel("large-v3", device=self.device, compute_type="float16" if self.device == "cuda" else "int8")
        self.reference = self.embed(*read(REFERENCE))

    def embed(self, audio: np.ndarray, rate: int) -> np.ndarray:
        x16 = soxr.resample(audio, rate, 16000) if rate != 16000 else audio
        with self.torch.no_grad():
            x = self.torch.tensor(x16, device=self.device)[None]
            _, e = self.titanet.forward(input_signal=x, input_signal_length=self.torch.tensor([x.shape[1]], device=self.device))
        e = e[0].cpu().numpy()
        return e / np.linalg.norm(e)

    def judge(self, audio: np.ndarray, rate: int, text: str) -> dict:
        """How alike the reference voice, what was heard, and every fault"""
        alike = float(self.embed(audio, rate) @ self.reference)
        x16 = soxr.resample(audio, rate, 16000) if rate != 16000 else audio
        segs, _ = self.whisper.transcribe(x16, language="en", word_timestamps=True, beam_size=5, vad_filter=False)
        heard = [w for s in segs for w in s.words]
        said = "".join(w.word for w in heard).strip()
        faults = []
        # Heard again with silence either side, as it sits in the cut: a word that only just passes is caught here
        pad = np.zeros(int(0.3 * 16000), dtype=np.float32)
        again, _ = self.whisper.transcribe(np.concatenate([pad, x16, pad]), language="en", beam_size=5, vad_filter=False, condition_on_previous_text=False)
        again = "".join(s.text for s in again).strip()
        if words(again) != words(text):
            faults.append(f'heard "{again}" in silence')
        if alike < SAME:
            faults.append(f"another voice (alike {alike:.2f}, least {SAME})")
        if words(said) != words(text):
            faults.append(f'heard "{said}"')
        for a, b in zip(heard, heard[1:]):
            if b.start - a.end > (FULL_STOP if a.word.strip()[-1:] in '.?!' else PAUSE):
                faults.append(f'{b.start - a.end:.2f} s pause between "{a.word.strip()}" and "{b.word.strip()}"')
        return {"alike": round(alike, 3), "heard": said, "faults": faults, "seconds": round(len(audio) / rate, 2)}


def tidy(audio: np.ndarray, rate: int) -> np.ndarray:
    """Trimmed to its sound with a breath either side, faded so it never clicks"""
    loud = np.flatnonzero(np.abs(audio) > 0.01)
    a = max(0, loud[0] - int(0.04 * rate))
    b = min(len(audio), loud[-1] + int(0.15 * rate))
    part = audio[a:b].copy()
    fin, fout = int(0.01 * rate), int(0.04 * rate)
    part[:fin] *= np.linspace(0, 1, fin)
    part[-fout:] *= np.linspace(1, 0, fout)
    return part


def frames_of(audio: np.ndarray, rate: int) -> int:
    """A recording's length in frames, less the silence it leaves at its end"""
    loud = np.flatnonzero(np.abs(audio) >= 300 / 32768)
    return math.ceil((loud[-1] + 1) / rate * FPS) if len(loud) else 0


def check(ear: Ear) -> int:
    timing = json.loads(TIMING_FILE.read_text(encoding="utf8"))
    report, fails = [], []
    for key, t in timing.items():
        row = {"key": key, **ear.judge(*read(VOICE / t["file"]), t["text"])}
        report.append(row)
        fails += [f"{key}: {f}" for f in row["faults"]]
    # One voice across the lines: each alike the others, as a listener compares a line with the ones before it
    embeds = {r["key"]: ear.embed(*read(VOICE / timing[r["key"]]["file"])) for r in report}
    for r in report:
        rest = np.mean([e for k, e in embeds.items() if k != r["key"]], axis=0)
        r["among"] = round(float(embeds[r["key"]] @ (rest / np.linalg.norm(rest))), 3)
        if r["among"] < AMONG:
            fails.append(f"{r['key']}: unlike the other lines (alike {r['among']:.2f}, least {AMONG})")
    (HERE / "out" / "listen.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf8")
    for r in sorted(report, key=lambda r: r["alike"]):
        print(f"{r['key']:12} alike {r['alike']:.3f}  among {r['among']:.3f}  {r['seconds']:5.2f} s  {r['heard']}")
    for f in fails:
        print("FAIL", f)
    print(f"\n{len(report)} lines, {len(fails)} failures")
    return 1 if fails else 0


def pick(ear: Ear) -> int:
    lines = json.loads((HERE / "out" / "script.json").read_text(encoding="utf8"))
    candidates = HERE / "public" / "candidates"
    VOICE.mkdir(parents=True, exist_ok=True)
    timing, fails = {}, []
    for line in lines:
        takes = []
        for path in sorted(candidates.glob(f"{line['key']}@*.wav")):
            if path.with_suffix(".txt").read_text(encoding="utf8") != line["text"]:
                continue
            audio, rate = read(path)
            audio = tidy(audio, rate)
            takes.append((ear.judge(audio, rate, line["text"]), audio, rate, path.stem))
        good = [t for t in takes if not t[0]["faults"]]
        if not good:
            fails.append(f"{line['key']}: no take passes: " + "; ".join(f"{t[3]}: {', '.join(t[0]['faults'])}" for t in takes))
            continue
        verdict, audio, rate, name = max(good, key=lambda t: t[0]["alike"])
        file = f"{line['key']}.wav"
        sf.write(VOICE / file, audio, rate, subtype="PCM_16")
        timing[line["key"]] = {"file": file, "frames": frames_of(audio, rate), "text": line["text"], "voice": STAMP}
        print(f"{line['key']:12} {name:16} alike {verdict['alike']:.3f}  {verdict['seconds']:5.2f} s  ({len(good)}/{len(takes)} takes pass)")
    for f in fails:
        print("FAIL", f)
    if fails:
        return 1
    TIMING_FILE.write_text(json.dumps(timing, indent=2) + "\n", encoding="utf8")
    print(f"\n{len(timing)} lines, {sum(t['frames'] for t in timing.values()) / FPS:.1f} s spoken")
    return 0


def track(ear: Ear) -> int:
    """The narration as rendered: every line heard, word for word, where the cut says it is, and no sound elsewhere"""
    timeline = json.loads((HERE / "out" / "timeline.json").read_text(encoding="utf8"))
    audio, rate = read(HERE / "out" / "voice.wav")
    x = soxr.resample(audio, rate, 16000)
    at = lambda s: max(0, min(len(x), int(s * 16000)))  # noqa: E731
    fails = []
    quiet = np.ones(len(x), dtype=bool)
    for line in timeline:
        # Its stretch of the rendered sound, a little either side, heard on its own
        window = x[at(line["from"] - 0.3) : at(line["to"] + 0.3)]
        segs, _ = ear.whisper.transcribe(window, language="en", beam_size=5, vad_filter=False, condition_on_previous_text=False)
        said = "".join(s.text for s in segs).strip()
        if words(said) != words(line["text"]):
            fails.append(f'{line["key"]} at {line["from"]:.2f} s: heard "{said}", script "{line["text"]}"')
        # Where its sound starts, against where its clip's own sound starts once placed where the cut puts it
        clip, clip_rate = read(VOICE / f'{line["key"]}.wav')
        own = np.flatnonzero(np.abs(clip) > 0.02)[0] / clip_rate
        lead = x[at(line["from"] - 0.5) : at(line["from"] + own + 0.5)]
        loud = np.flatnonzero(np.abs(lead) > 0.02)
        onset = at(line["from"] - 0.5) / 16000 + loud[0] / 16000 if len(loud) else None
        if onset is None or abs(onset - (line["from"] + own)) > 0.05:
            fails.append(f'{line["key"]}: sound starts at {onset if onset is None else round(onset, 2)} s, should at {line["from"] + own:.2f} s')
        quiet[at(line["from"] - 0.05) : at(line["to"] + 0.2)] = False
    # Sound where no line is: a line placed somewhere else, or one running on
    stray = np.flatnonzero(quiet & (np.abs(x) > 0.02))
    if len(stray):
        runs = np.split(stray, np.flatnonzero(np.diff(stray) > 1600) + 1)
        for r in runs:
            fails.append(f"sound outside every line at {r[0] / 16000:.2f}–{r[-1] / 16000:.2f} s")
    for f in fails:
        print("FAIL", f)
    print(f"\n{len(timeline)} lines in the rendered narration;{len(fails)} failures")
    return 1 if fails else 0


if __name__ == "__main__":
    (HERE / "out").mkdir(exist_ok=True)
    ear = Ear()
    sys.exit(pick(ear) if "--pick" in sys.argv else track(ear) if "--track" in sys.argv else check(ear))
