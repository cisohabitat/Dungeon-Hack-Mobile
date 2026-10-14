"""Render the prologue with the approved Kokoro George neural voice.

Install kokoro-onnx==0.6.1 and soundfile==0.14.0, then run:
python sound/render-narration.py --model /path/kokoro-v1.0.onnx --voices /path/voices-v1.0.bin
Model files: https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.1
Only the compressed reading is loaded by the game; the model is a production tool.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile

import numpy as np
import onnxruntime as ort
import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = Path(__file__).resolve().parent


def ffmpeg(*args):
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', *map(str, args)], check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--model', required=True, type=Path)
    parser.add_argument('--voices', required=True, type=Path)
    args = parser.parse_args()
    ort.disable_telemetry_events()
    catalogue_path = ROOT / 'narration/catalog.json'
    if catalogue_path.exists():
        render_catalogue(args)
        return
    brief = json.loads((ROOT / 'narration/brief.json').read_text())
    engine = Kokoro(str(args.model), str(args.voices))
    parts = []
    for i, text in enumerate(brief['script']):
        samples, rate = engine.create(text, voice='bm_george', speed=0.92, lang='en-gb')
        parts.append(samples)
        gap = 2.0 if i == 2 else 1.25 if i < 3 else 0.75
        parts.append(np.zeros(int(rate * gap), dtype=np.float32))
    joined = np.concatenate(parts)
    master = ROOT / 'masters/narration/prologue.flac'
    master.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='deepdelve-george-') as tmp:
        raw = Path(tmp) / 'raw.wav'
        sf.write(raw, joined, rate, subtype='PCM_24')
        ffmpeg('-i', raw, '-af', 'loudnorm=I=-18:TP=-1:LRA=7',
               '-ar', 48000, '-ac', 1, '-c:a', 'flac', master)
        for ext, codec in [('ogg', ['-c:a', 'libvorbis', '-q:a', '4']),
                           ('m4a', ['-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart'])]:
            ffmpeg('-i', master, '-af', 'volume=-1dB', *codec, ROOT / f'narration/prologue.{ext}')
    provenance = {
        'engine': 'kokoro-onnx 0.6.1', 'model': 'Kokoro 82M v1.0',
        'voice': 'bm_george', 'language': 'en-gb', 'speed': 0.92,
        'modelLicence': 'Apache-2.0', 'engineLicence': 'MIT',
        'source': 'https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.1',
        'modelSha256': hashlib.sha256(args.model.read_bytes()).hexdigest(),
        'voicesSha256': hashlib.sha256(args.voices.read_bytes()).hexdigest(),
        'scriptSource': 'js/data.js: PROLOGUE', 'script': brief['script'],
        'seconds': round(len(joined) / rate, 3),
        'postProcessing': 'Paragraph silence and loudness normalisation only; no pitch or tempo stretching',
    }
    (ROOT / 'narration/provenance.json').write_text(json.dumps(provenance, indent=2) + '\n')
    print(f"Rendered George prologue: {provenance['seconds']} seconds.")


def render_catalogue(args):
    catalogue = json.loads((ROOT / 'narration/catalog.json').read_text())
    index_path = ROOT / 'narration/production.json'
    index = json.loads(index_path.read_text()) if index_path.exists() else {}
    model_hash = hashlib.sha256(args.model.read_bytes()).hexdigest()
    voice_hash = hashlib.sha256(args.voices.read_bytes()).hexdigest()
    signature = model_hash + voice_hash + '|bm_george|0.92|native24-s16-v1'
    engine = Kokoro(str(args.model), str(args.voices))
    prior = json.loads((ROOT / 'narration/provenance.json').read_text())
    for number, (key, entry) in enumerate(catalogue['clips'].items(), 1):
        output = ROOT / f'narration/{key}'
        master = ROOT / f'masters/narration/{key}.flac'
        have = all(p.exists() for p in [master, output.with_suffix('.ogg'), output.with_suffix('.m4a')])
        if key == 'prologue' and have and prior.get('modelSha256') == model_hash:
            continue  # the opening was approved already; keep its pauses and exact take
        if have and index.get(key, {}).get('signature') == signature:
            continue
        samples, rate = engine.create(entry['text'], voice='bm_george', speed=0.92, lang='en-gb')
        samples = np.concatenate([samples, np.zeros(int(rate * 0.2), dtype=np.float32)])
        with tempfile.TemporaryDirectory(prefix='deepdelve-george-') as tmp:
            raw = Path(tmp) / 'raw.wav'
            sf.write(raw, samples, rate, subtype='PCM_24')
            ffmpeg('-i', raw, '-af', 'loudnorm=I=-18:TP=-1:LRA=7', '-ar', rate,
                   '-ac', 1, '-sample_fmt', 's16', '-c:a', 'flac', master)
            for ext, codec in [('ogg', ['-c:a', 'libvorbis', '-q:a', '4']),
                               ('m4a', ['-c:a', 'aac', '-b:a', '80k', '-movflags', '+faststart'])]:
                ffmpeg('-i', master, '-af', 'volume=-1dB', *codec, output.with_suffix('.' + ext))
        index[key] = {'seconds': round(len(samples) / rate, 3), 'signature': signature,
                      'text': entry['text'], 'voice': 'bm_george', 'modelSha256': model_hash}
        index_path.write_text(json.dumps(index, indent=2) + '\n')
        print(f"{number}/{len(catalogue['clips'])}: {key} ({entry['kind']}, {index[key]['seconds']}s)", flush=True)


if __name__ == '__main__':
    main()
