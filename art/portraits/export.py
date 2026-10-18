"""Export current class and keeper portraits, preserving the original PNGs."""
import argparse
import json
import subprocess
import tempfile
from pathlib import Path

root = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--check', action='store_true', help='Reject stale exports without changing files.')
args = parser.parse_args()
temporary = tempfile.TemporaryDirectory() if args.check else None
stale = []
count = 0
for group in ('portraits', 'bosses'):
    art = root / 'art' / group
    manifest = json.loads((art / 'generation.json').read_text())
    portraits = manifest['portraits']
    ids = list(portraits) if isinstance(portraits, dict) else [p['id'] for p in portraits]
    target = Path(temporary.name) / group if temporary else root / 'img' / group
    target.mkdir(parents=True, exist_ok=True)
    for identity in ids:
        entry = manifest.get('overrides', {}).get(identity, {})
        source = art / entry.get('source', f'{identity}.png')
        output = target / f'{identity}.webp'
        subprocess.run([
            'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(source),
            '-vf', 'scale=512:512:flags=lanczos', '-c:v', 'libwebp', '-quality', '85',
            str(output),
        ], check=True)
        shipped = root / 'img' / group / output.name
        if args.check and (not shipped.exists() or output.read_bytes() != shipped.read_bytes()):
            stale.append(f'{group}/{output.name}')
        count += 1
        print(f'{group}/{identity}: {source.relative_to(art)}')
    extra = sorted(p.name for p in (root / 'img' / group).glob('*.webp') if p.stem not in ids)
    stale.extend(f'{group}/{name} (not in manifest)' for name in extra)
if stale:
    raise SystemExit(f'Stale or unexpected exports: {stale}')
print(f'All {count} class/keeper exports {"match their current sources" if args.check else "exported"}.')
