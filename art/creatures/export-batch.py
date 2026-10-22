"""Extract generated pose islands, register transparent cells and export atlases.

This performs raster extraction only. All character drawing and the corrected
Lizardfolk step were produced by image_gen.imagegen.
"""
import hashlib
import json
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

import argparse
import tempfile
root = Path(__file__).resolve().parents[2]
source_root = root / 'art/creatures'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
temporary = tempfile.TemporaryDirectory()
work = Path(temporary.name)
poses = ['idle', 'stepA', 'stepB', 'windup', 'strike', 'recover', 'special', 'hurt', 'blink']
config = json.loads((source_root / 'generation-batch.json').read_text())['creatures']
kinds = [k for k, c in config.items() if c['method'] == 'islands']
manifest = {'date': '2026-10-22', 'tool': 'image_gen.imagegen', 'model': 'not disclosed', 'status': 'preview only; not integrated or published', 'cell': 256, 'baseline': 236, 'poses': poses, 'creatures': {}}

def run(*args):
    subprocess.run(list(map(str, args)), check=True)

for kind in kinds:
    source = source_root / config[kind]['source']
    rgba = np.array(Image.open(source).convert('RGBA'))
    labels, _ = ndimage.label(rgba[:, :, 3] > 8)
    sizes = np.bincount(labels.ravel())
    sizes[0] = 0
    main = np.argsort(sizes)[-9:]
    assert min(sizes[main]) > 10000, (kind, 'missing pose island')
    centres = ndimage.center_of_mass(rgba[:, :, 3], labels, main)
    order = sorted(zip(main, centres), key=lambda item: item[1][0])
    order = sum([sorted(order[i:i+3], key=lambda item: item[1][1]) for i in range(0, 9, 3)], [])
    major = np.zeros(labels.shape, dtype=np.uint8)
    for i, (label, _) in enumerate(order):
        major[labels == label] = i + 1
    # Assign antialiased edge pixels and disconnected slime droplets to their
    # nearest complete character, rather than cutting through irregular gutters.
    distance, nearest = ndimage.distance_transform_edt(major == 0, return_indices=True)
    assigned = major[tuple(nearest)]
    folder = work / kind
    folder.mkdir(exist_ok=True)
    crops = []
    for i, pose in enumerate(poses):
        isolated = rgba.copy()
        isolated[(assigned != i+1) | ((distance > 3) & ((labels == 0) | (sizes[labels] < 30)))] = 0
        im = Image.fromarray(isolated)
        im = im.crop(im.getbbox())
        crop = folder / f'{pose}-crop.png'
        im.save(crop)
        crops.append((crop, im.size))
    scale = min(210 / max(s[0] for _, s in crops), 216 / max(s[1] for _, s in crops))
    cells = []
    for i, (crop, dimensions) in enumerate(crops):
        if 'stepB' in config[kind] and poses[i] == 'stepB':
            im = Image.open(source_root / config[kind]['stepB']).convert('RGBA')
            im = im.crop(im.getbbox())
            im.save(crop)
            # Match the alternate generated frame's spear-to-foot height to
            # the original walking frame without mirroring held equipment.
            frame_scale = crops[1][1][1] * scale / im.height
        else:
            frame_scale = scale
        scaled = folder / 'scaled.png'
        run('convert', crop, '-resize', f'{frame_scale*100}%', scaled)
        im = Image.open(scaled)
        width, height = im.size
        visible = im.getchannel('A').point(lambda p: 255 if p > 32 else 0).getbbox()
        dx, dy = 128 - (visible[0]+visible[2])//2, 237-visible[3]
        assert dx >= 12 and dy >= 12 and height < 225, (kind, poses[i], width, height)
        cell = folder / f'{poses[i]}.png'
        run('convert', '-size', '256x256', 'canvas:none', scaled, '-geometry', f'{dx:+d}{dy:+d}', '-composite', cell)
        bounds = Image.open(cell).getchannel('A').point(lambda p: 255 if p > 32 else 0).getbbox()
        assert bounds[3] == 237 and min(bounds[:2]) >= 12 and bounds[2] <= 244, (kind, poses[i], bounds)
        crop.unlink()
        cells.append(cell)
    scaled.unlink()
    atlas = work / f'{kind}-atlas.png'
    run('montage', *cells, '-tile', '3x3', '-geometry', '+0+0', '-background', 'none', atlas)
    output = work / f'{kind}.webp'
    run('convert', atlas, '-quality', '90', output)
    target = root / f'img/creatures/{kind}.webp'
    if args.check:
        assert output.read_bytes() == target.read_bytes(), kind + ': stale export'
    else:
        target.write_bytes(output.read_bytes())
    manifest['creatures'][kind] = {'source': source.name, 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'atlasSha256': hashlib.sha256(atlas.read_bytes()).hexdigest(), 'scale': scale}
    print(kind + ': nine transparent cells; complete bounds and baseline checked.')

# The first two approved sheets use measured row gutters and body centres.
for kind, cfg in config.items():
    if cfg['method'] != 'crop':
        continue
    folder = work / kind
    folder.mkdir()
    cells = []
    for i, pose in enumerate(poses):
        row, col = divmod(i, 3)
        top, bottom = cfg['rows'][row:row+2]
        crop, scaled = folder / 'crop.png', folder / 'scaled.png'
        run('convert', source_root / cfg['source'], '-crop', f'418x{bottom-top}+{col*418}+{top}', '+repage', crop)
        run('convert', crop, '-resize', f"{cfg['scale']*100}%", scaled)
        alpha = Image.open(scaled).getchannel('A').point(lambda v: 255 if v > 32 else 0)
        x0, y0, x1, y1 = alpha.getbbox()
        dx = 128 - round(cfg['centres'][i] * cfg['scale'])
        dy = 237 - y1
        assert x0+dx > 0 and x1+dx < 256 and y0+dy > 0
        cell = folder / f'{pose}.png'
        run('convert', '-size', '256x256', 'canvas:none', scaled, '-geometry', f'{dx:+d}{dy:+d}', '-composite', cell)
        cells.append(cell)
    output = work / f'{kind}.webp'
    run('montage', *cells, '-tile', '3x3', '-geometry', '+0+0', '-background', 'none', '-quality', '90', output)
    target = root / f'img/creatures/{kind}.webp'
    if args.check:
        assert output.read_bytes() == target.read_bytes(), kind + ': stale export'
    else:
        target.write_bytes(output.read_bytes())
    print(kind + ': nine registered cells verified.')
temporary.cleanup()
