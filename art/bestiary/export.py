"""Export the individual bestiary portraits from the original painting sheets."""
import json
import argparse
import subprocess
import tempfile
from pathlib import Path

art = Path(__file__).resolve().parent
root = art.parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--check', action='store_true', help='Reject stale exports without changing files.')
args = parser.parse_args()
temporary = tempfile.TemporaryDirectory() if args.check else None
target = Path(temporary.name) if temporary else root / 'img' / 'bestiary'
target.mkdir(parents=True, exist_ok=True)
manifest = json.loads((art / 'generation.json').read_text())
for sheet in manifest['sheets']:
    source = art / sheet['source']
    size = subprocess.check_output(['identify', '-format', '%w %h', str(source)], text=True).split()
    width, height = map(int, size)
    n = sheet['columns']
    for j, creature in enumerate(sheet['portraits']):
        col, row = j % n, j // n
        x, y = round(col * width / n), round(row * height / n)
        w, h = round((col + 1) * width / n) - x, round((row + 1) * height / n) - y
        subprocess.run([
            'convert', str(source), '-crop', f'{w}x{h}+{x}+{y}', '+repage',
            '-filter', 'Lanczos', '-resize', '512x512!', '-quality', '85',
            str(target / f'{creature}.webp'),
        ], check=True)
    print(f'{source.name}: {len(sheet["portraits"])} portraits exported')

# An individually repaired painting takes precedence over its original tile.
for creature, repair in manifest.get('overrides', {}).items():
    subprocess.run([
        'convert', str(art / repair['source']), '-filter', 'Lanczos',
        '-resize', '512x512!', '-quality', '85', str(target / f'{creature}.webp'),
    ], check=True)
    print(f'{creature}: corrected source exported')

if args.check:
    shipped = root / 'img' / 'bestiary'
    stale = [p.name for p in target.glob('*.webp')
             if not (shipped / p.name).exists() or p.read_bytes() != (shipped / p.name).read_bytes()]
    extra = sorted(p.name for p in shipped.glob('*.webp') if not (target / p.name).exists())
    if stale or extra:
        raise SystemExit(f'Stale exports: {stale}; untracked exports: {extra}')
    print(f'All {len(list(target.glob("*.webp")))} bestiary exports match their current sources.')
