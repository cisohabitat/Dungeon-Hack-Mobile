"""Export the approved Dark Elf Warrior atlas with registered feet and body centres."""
import argparse
import re
import subprocess
import tempfile
from pathlib import Path

root = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
source = root / 'art/creatures/drow_warrior.png'
target = root / 'img/creatures/drow_warrior.webp'
# Measured safe row gaps and pelvis centres in the approved generated sheet.
rows = [0, 355, 682, 1024]
centres = [296, 242, 245, 299, 252, 245, 290, 247, 243]
with tempfile.TemporaryDirectory() as directory:
    tmp = Path(directory)
    cells = []
    for i, centre in enumerate(centres):
        row, col = divmod(i, 3)
        crop, cell = tmp / 'crop.png', tmp / f'{i}.png'
        subprocess.run(['convert', str(source), '-crop', f'512x{rows[row+1]-rows[row]}+{col*512}+{rows[row]}',
                        '+repage', '-resize', '512x512!', str(crop)], check=True)
        box = subprocess.check_output(['convert', str(crop), '-alpha', 'extract', '-threshold', '12.5%',
                                       '-format', '%@', 'info:'], text=True)
        _, height, _, y = map(int, re.fullmatch(r'(\d+)x(\d+)\+(\d+)\+(\d+)', box).groups())
        dy = 500 - (y + height - 1)
        subprocess.run(['convert', '-size', '512x512', 'canvas:none', str(crop),
                        '-geometry', f'{256-centre:+d}{dy:+d}', '-composite', '-resize', '256x256', str(cell)], check=True)
        cells.append(str(cell))
    output = tmp / 'drow_warrior.webp'
    subprocess.run(['montage', *cells, '-tile', '3x3', '-geometry', '+0+0', '-background', 'none',
                    '-quality', '90', str(output)], check=True)
    if args.check:
        if not target.exists() or output.read_bytes() != target.read_bytes():
            raise SystemExit('Dark Elf Warrior sprite export is stale.')
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(output.read_bytes())
print('Dark Elf Warrior: registered nine-pose atlas ' + ('verified.' if args.check else 'exported.'))
