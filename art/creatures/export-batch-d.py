"""Reproduce Batch D's selected review and shipped atlases.

Only raster extraction, uniform scaling and registration happen here. Character
drawing and any repairs belong to image_gen.imagegen. Requires Pillow, NumPy
and SciPy. Run with --check to compare all review bytes and measurements.
"""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--check', action='store_true')
parser.add_argument('--kind', action='append', help='Export selected creatures during review')
args = parser.parse_args()
folder = Path(__file__).resolve().parent
manifest = json.loads((folder / 'generation-batch-d.json').read_text())
destination = folder / 'batch-d-preview'
destination.mkdir(exist_ok=True)
measurements = {}
neutrals = []

def save(image, path, **options):
    import io
    buffer = io.BytesIO()
    image.save(buffer, format='WEBP' if path.suffix == '.webp' else 'PNG', **options)
    data = buffer.getvalue()
    if args.check:
        assert path.read_bytes() == data, f'{path}: stale export'
    else:
        path.write_bytes(data)

def extract_sheet(source, kind):
    rgba = np.array(Image.open(source).convert('RGBA'))
    labels, _ = ndimage.label(rgba[:, :, 3] > 32)
    sizes = np.bincount(labels.ravel())
    sizes[0] = 0
    largest = np.argsort(sizes)[-9:]
    assert min(sizes[largest]) > 10000, (kind, 'nine complete islands required')
    centres = ndimage.center_of_mass(rgba[:, :, 3], labels, largest)
    ordered = sorted(zip(largest, centres), key=lambda item: item[1][0])
    ordered = sum([sorted(ordered[i:i+3], key=lambda item: item[1][1])
                   for i in range(0, 9, 3)], [])
    major = np.zeros(labels.shape, dtype=np.uint8)
    for i, (label, _) in enumerate(ordered):
        major[labels == label] = i + 1
    distances, nearest = ndimage.distance_transform_edt(major == 0, return_indices=True)
    assigned = major[tuple(nearest)]
    crops = []
    for i in range(9):
        isolated = rgba.copy()
        isolated[(assigned != i+1) | ((distances > 3) &
                 ((labels == 0) | (sizes[labels] < 30)))] = 0
        image = Image.fromarray(isolated)
        visible = image.getchannel('A').point(lambda p: 255 if p > 32 else 0).getbbox()
        assert visible and min(visible[:2]) > 0 and visible[2] < image.width and visible[3] < image.height, (kind, i, 'source edge clipping')
        bounds = image.getbbox()
        crops.append((image.crop(bounds), bounds, visible))
    return crops

def extract_single(source, kind):
    rgba = np.array(Image.open(source).convert('RGBA'))
    labels, _ = ndimage.label(rgba[:, :, 3] > 32)
    sizes = np.bincount(labels.ravel()); sizes[0] = 0
    largest = int(sizes.argmax())
    ys, xs = np.where(labels == largest)
    assert xs.min() > 0 and ys.min() > 0 and xs.max() < rgba.shape[1]-1 and ys.max() < rgba.shape[0]-1, (kind, 'replacement background or clipping')
    distances = ndimage.distance_transform_edt(labels != largest)
    assert not any(sizes[i] > 1000 and np.all(distances[labels == i] > 3) for i in range(1, len(sizes)) if i != largest), (kind, 'detached replacement part')
    rgba[distances > 3] = 0
    image = Image.fromarray(rgba)
    bounds = image.getbbox()
    return image.crop(bounds), bounds

for kind, config in manifest['creatures'].items():
    if args.kind and kind not in args.kind:
        continue
    source = folder / config.get('selected_source', config['source'])
    crops = extract_sheet(source, kind)
    if 'source_pose_order' in config:
        order = [config['source_pose_order'].index(pose) for pose in manifest['poses']]
        crops = [crops[i] for i in order]
        config = dict(config)
        for key in ['body_centres', 'anchors']:
            if key in config:
                config[key] = [config[key][i] for i in order]
    if 'sheet_corrections' in config:
        correction = config['sheet_corrections']
        corrected = extract_sheet(folder / correction['source'], kind + ' correction')
        config = dict(config)
        config['body_centres'] = list(config['body_centres'])
        for pose, source_index in correction['poses'].items():
            i = manifest['poses'].index(pose)
            image, bounds, _ = corrected[source_index]
            fraction = (correction['body_centres'][pose] - bounds[0]) / image.width
            reference = correction.get('match_height_to', {}).get(pose, pose)
            height = crops[manifest['poses'].index(reference)][0].height
            image = image.resize((round(image.width * height / image.height), height), Image.Resampling.LANCZOS)
            bounds = (0, 0, image.width, image.height)
            visible = image.getchannel('A').point(lambda p: 255 if p > 32 else 0).getbbox()
            crops[i] = (image, bounds, visible)
            config['body_centres'][i] = image.width * fraction
    if 'replacements' in config:
        config = dict(config)
        config['body_centres'] = list(config['body_centres'])
        for pose, replacement in config['replacements'].items():
            i = manifest['poses'].index(pose)
            image, _ = extract_single(folder / replacement['source'], kind)
            # A separately generated step keeps the first step's total height;
            # the final atlas still uses one shared scale for every cell.
            height = crops[1][0].height
            image = image.resize((round(image.width * height / image.height), height), Image.Resampling.LANCZOS)
            bounds = (0, 0, image.width, image.height)
            visible = image.getchannel('A').point(lambda p: 255 if p > 32 else 0).getbbox()
            crops[i] = (image, bounds, visible)
            config['body_centres'][i] = image.width * replacement['body_fraction']
    scale = min(210 / max(crop.width for crop, _, _ in crops),
                216 / max(crop.height for crop, _, _ in crops))
    if 'body_centres' in config:
        extent = max(max(config['body_centres'][i] - bounds[0],
                         bounds[2] - config['body_centres'][i])
                     for i, (_, bounds, _) in enumerate(crops))
        scale = min(scale, 116 / extent)
    if 'anchors' in config:
        target_x, target_y = config['target_anchor']
        for (anchor_x, anchor_y), (_, bounds, _) in zip(config['anchors'], crops):
            for space, extent in [(target_x-12, anchor_x-bounds[0]),
                                  (244-target_x, bounds[2]-anchor_x),
                                  (target_y-12, anchor_y-bounds[1]),
                                  (244-target_y, bounds[3]-anchor_y)]:
                if extent > 0:
                    scale = min(scale, space / extent)
    if 'max_scale' in config:
        scale = min(scale, config['max_scale'])
    atlas = Image.new('RGBA', (768, 768))
    frames = []
    for i, (crop, bounds, visible) in enumerate(crops):
        scaled = crop.resize((max(1, round(crop.width * scale)),
                              max(1, round(crop.height * scale))), Image.Resampling.LANCZOS)
        alpha = scaled.getchannel('A').point(lambda p: 255 if p > 32 else 0)
        box = alpha.getbbox()
        dx = 128 - (box[0] + box[2]) // 2
        dy = 237 - box[3]
        if 'body_centres' in config:
            dx = round(128 - (config['body_centres'][i] - bounds[0]) * scale)
        # Flying creatures register to a measured body centre, never to wingtips.
        if 'anchors' in config:
            anchor_x, anchor_y = config['anchors'][i]
            target_x, target_y = config['target_anchor']
            dx = round(target_x - (anchor_x - bounds[0]) * scale)
            dy = round(target_y - (anchor_y - bounds[1]) * scale)
        cell = Image.new('RGBA', (256, 256))
        cell.alpha_composite(scaled, (dx, dy))
        fitted = cell.getchannel('A').point(lambda p: 255 if p > 32 else 0).getbbox()
        assert fitted and min(fitted[:2]) >= 12 and fitted[2] <= 244 and fitted[3] <= 244, (kind, i, fitted, 'clearance')
        assert box[0]+dx >= 12 and box[1]+dy >= 12 and box[2]+dx <= 244 and box[3]+dy <= 244, (kind, i, 'clipped export')
        if 'anchors' not in config:
            assert fitted[3] == 237, (kind, i, 'baseline')
        atlas.alpha_composite(cell, ((i % 3)*256, (i // 3)*256))
        if i == 0:
            neutrals.append((kind, cell))
        frames.append({'pose': manifest['poses'][i], 'source_bounds': list(bounds),
                       'visible_bounds': list(fitted), 'offset': [dx, dy]})
    output = destination / f'{kind}.webp'
    save(atlas, output, quality=90, method=6)
    if 'runtime_atlas' in config:
        target = folder / config['runtime_atlas']
        if args.check:
            assert target.read_bytes() == output.read_bytes(), f'{kind}: stale runtime atlas'
        else:
            target.write_bytes(output.read_bytes())
    measurements[kind] = {'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                          'atlas_sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
                          'scale': scale, 'frames': frames}

sheet = Image.new('RGB', (5*256, 2*286), '#20242c')
draw = ImageDraw.Draw(sheet)
for i, (kind, cell) in enumerate(neutrals):
    x, y = (i % 5)*256, (i // 5)*286
    sheet.paste(cell, (x, y), cell)
    draw.text((x+12, y+263), kind, fill='#f5e7ce')
save(sheet, destination / 'contact-sheet.png')
if not args.kind:
    for name, selected in [('walking', ['idle', 'stepA', 'stepB']),
                           ('actions', ['windup', 'strike', 'special', 'hurt'])]:
        comparison = Image.new('RGB', (len(selected)*256, len(measurements)*286), '#20242c')
        draw = ImageDraw.Draw(comparison)
        for row, kind in enumerate(measurements):
            atlas = Image.open(destination / f'{kind}.webp').convert('RGBA')
            for column, pose in enumerate(selected):
                i = manifest['poses'].index(pose)
                cell = atlas.crop(((i % 3)*256, (i // 3)*256, (i % 3+1)*256, (i // 3+1)*256))
                x, y = column*256, row*286
                comparison.paste(cell, (x, y), cell)
                draw.text((x+12, y+263), f'{kind} / {pose}', fill='#f5e7ce')
        save(comparison, destination / f'{name}-sheet.png')
record = json.dumps(measurements, indent=2) + '\n'
record_path = destination / 'measurements.json'
if args.check:
    assert record_path.read_text() == record, 'stale measurements'
else:
    record_path.write_text(record)
print(f'{len(measurements)} nine-pose preview atlases and contact sheets verified' if args.check
      else f'Exported {len(measurements)} nine-pose preview atlases and contact sheets')
