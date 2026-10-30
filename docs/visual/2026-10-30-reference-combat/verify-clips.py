#!/usr/bin/env python3
"""Verify captured native clips; ffmpeg/ffprobe required, no aesthetic claim."""
import hashlib
import json
import re
from pathlib import Path
import subprocess

root = Path(__file__).parent / 'native'
evidence = json.loads((root / 'evidence.json').read_text())
results = []
repo = Path(__file__).resolve().parents[3]
for file, expected in evidence['codeHashes'].items():
    assert hashlib.sha256((repo / file).read_bytes()).hexdigest() == expected, file
assert len(evidence['records']) == 6
for record in evidence['records']:
    clip = root / f"{record['width']}-{record['id']}.webm"
    assert clip.stat().st_size > 1000, f'{clip}: empty/corrupt export'
    probe = subprocess.run(['ffprobe', '-v', 'error', '-show_streams', '-of', 'json', str(clip)],
                           check=True, capture_output=True, text=True)
    streams = json.loads(probe.stdout)['streams']
    assert {s['codec_type'] for s in streams} == {'audio', 'video'}
    decode = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(clip), '-vn',
                             '-af', 'volumedetect', '-f', 'null', '-'],
                            check=True, capture_output=True, text=True)
    levels = [line.strip() for line in decode.stderr.splitlines()
              if 'mean_volume:' in line or 'max_volume:' in line]
    assert len(levels) == 2 and not any('-inf' in line for line in levels)
    levels = {re.search(r'(mean_volume|max_volume):', line)[1]: float(re.search(r': (-?[0-9.]+) dB', line)[1]) for line in levels}
    assert levels['max_volume'] < -0.1, 'captured master tap clips'
    assert record['errors'] == [] and record['status'] == 'playing'
    warnings = [s for s in record['sounds'] if s['name'] in ('windup', 'special')]
    assert warnings and all(s['who'] == record['id'] for s in warnings)
    if record['id'] == 'skarrow':
        assert any(s.get('move') == 'breath' for s in warnings)
    if record['id'] == 'heartforged':
        assert any(s['name'] == 'smash' and s.get('who') == 'heartforged'
                   for s in record['sounds'])
    results.append({'file': clip.name, 'sha256': hashlib.sha256(clip.read_bytes()).hexdigest(),
                    'bytes': clip.stat().st_size, 'levels': levels,
                    'streams': [s['codec_name'] for s in streams]})
(root / 'audio-levels.json').write_text(json.dumps(results, indent=2) + '\n')
print('6 native clips decoded with audio and video; event identity checks passed.')
