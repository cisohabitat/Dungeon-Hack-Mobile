"""Export approved relic cards without captions, preserving their aspect ratio."""
import argparse
import json
import subprocess
import tempfile
from pathlib import Path

art = Path(__file__).resolve().parent
root = art.parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
temporary = tempfile.TemporaryDirectory() if args.check else None
target = Path(temporary.name) if temporary else root / 'img/relics'
target.mkdir(parents=True, exist_ok=True)
portraits = json.loads((art / 'generation.json').read_text())['portraits']
for identity, entry in portraits.items():
    x, y, w, h = entry['crop']
    subprocess.run(['convert', str(art / entry['source']), '-crop', f'{w}x{h}+{x}+{y}',
                    '+repage', '-resize', '512x512', '-background', '#151410',
                    '-gravity', 'center', '-extent', '512x512', '-quality', '85',
                    str(target / f'{identity}.webp')], check=True)
if args.check:
    shipped = root / 'img/relics'
    stale = [p.name for p in target.glob('*.webp')
             if not (shipped / p.name).exists() or p.read_bytes() != (shipped / p.name).read_bytes()]
    extra = [p.name for p in shipped.glob('*.webp') if p.stem not in portraits]
    if stale or extra:
        raise SystemExit(f'Stale exports: {stale}; unexpected exports: {extra}')
print(f'{len(portraits)} relic portraits {"verified" if args.check else "exported"}.')
