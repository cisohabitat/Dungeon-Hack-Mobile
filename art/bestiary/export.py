"""Export the individual bestiary portraits from the original painting sheets."""
import json
import subprocess
from pathlib import Path

art = Path(__file__).resolve().parent
root = art.parent.parent
target = root / 'img' / 'bestiary'
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
