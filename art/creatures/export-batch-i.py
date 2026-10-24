"""Extract Batch I's three static traders; no drawing or palette alterations.

Requires Pillow, NumPy and SciPy. --check verifies all exported bytes.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
folder = Path(__file__).resolve().parent
manifest = json.loads((folder / 'generation-batch-i.json').read_text())
source = folder / manifest.get('selected_source', manifest['source'])
out = folder / 'batch-i-preview'
out.mkdir(exist_ok=True)
rgba = np.array(Image.open(source).convert('RGBA'))
labels, _ = ndimage.label(rgba[:, :, 3] > 32)
sizes = np.bincount(labels.ravel()); sizes[0] = 0
largest = np.argsort(sizes)[-3:]
assert min(sizes[largest]) > 10000, 'three complete figures required'
centres = ndimage.center_of_mass(rgba[:, :, 3], labels, largest)
ordered = sorted(zip(largest, centres), key=lambda x: x[1][1])
major = np.zeros(labels.shape, dtype=np.uint8)
for i, (label, _) in enumerate(ordered):
    major[labels == label] = i + 1
distances, nearest = ndimage.distance_transform_edt(major == 0, return_indices=True)
assigned = major[tuple(nearest)]
crops = []
for i, kind in enumerate(manifest['figures']):
    isolated = rgba.copy()
    isolated[(assigned != i+1) | ((distances > 3) & ((labels == 0) | (sizes[labels] < 30)))] = 0
    image = Image.fromarray(isolated)
    visible = image.getchannel('A').point(lambda a: 255 if a > 32 else 0).getbbox()
    assert visible and min(visible[:2]) > 0 and visible[2] < image.width and visible[3] < image.height, (kind, 'source edge clipping')
    bounds = image.getbbox()
    crops.append((kind, image.crop(bounds), bounds))
scale = min(210/max(c.height for _, c, _ in crops), 216/max(c.width for _, c, _ in crops))
for kind, _, bounds in crops:
    centre = manifest['figures'][kind]['body_centre']
    scale = min(scale, 116/max(centre-bounds[0], bounds[2]-centre))

def save(image, file, **options):
    b = io.BytesIO(); image.save(b, format='WEBP' if file.suffix == '.webp' else 'PNG', **options)
    data = b.getvalue()
    if args.check:
        assert file.read_bytes() == data, f'{file}: stale export'
    else:
        file.write_bytes(data)

atlas = Image.new('RGBA', (768,256))
contact = Image.new('RGB',(768,286),'#20242c')
draw = ImageDraw.Draw(contact)
measurements = {'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(), 'common_scale':scale, 'figures':{}}
for i, (kind, crop, bounds) in enumerate(crops):
    scaled = crop.resize((max(1, round(crop.width*scale)),max(1, round(crop.height*scale))),Image.Resampling.LANCZOS)
    visible = scaled.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox()
    dx = round(128-(manifest['figures'][kind]['body_centre']-bounds[0])*scale)
    dy = 237-visible[3]
    cell = Image.new('RGBA',(256,256)); cell.alpha_composite(scaled,(dx,dy))
    fitted = cell.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox()
    assert min(fitted[:2])>=12 and fitted[2]<=244 and fitted[3]==237, (kind,'clearance/baseline',fitted)
    assert min(visible[0]+dx,visible[1]+dy)>=12 and visible[2]+dx<=244, (kind,'clipped')
    save(cell,out/f'{kind}.webp',quality=90,method=6)
    atlas.alpha_composite(cell,(i*256,0));contact.paste(cell,(i*256,0),cell)
    draw.text((i*256+12,264),kind,fill='#f5e7ce')
    measurements['figures'][kind]={'source_bounds':list(bounds),'visible_bounds':list(fitted),'offset':[dx,dy],'export_sha256':hashlib.sha256((out/f'{kind}.webp').read_bytes()).hexdigest()}
save(atlas,out/'traders.webp',quality=90,method=6)
save(contact,out/'contact-sheet.png')
# Put selected traders next to approved monster cells for a direct style review.
comparison = Image.new('RGB', (1280,286), '#20242c')
comparison.paste(contact,(0,0)); comparison_draw=ImageDraw.Draw(comparison)
for i, kind in enumerate(['goblin','warlord'],start=3):
    reference=Image.open(folder/'../../img/creatures'/f'{kind}.webp').convert('RGBA').crop((0,0,256,256))
    comparison.paste(reference,(i*256,0),reference)
    comparison_draw.text((i*256+12,264),f'{kind} / style reference',fill='#f5e7ce')
save(comparison,out/'style-comparison.png')

record = json.dumps(measurements,indent=2)+'\n'; target=out/'measurements.json'
if args.check: assert target.read_text()==record,'stale measurements'
else: target.write_text(record)
print('Three static traders, combined atlas, contact sheet and measurements '+('verified' if args.check else 'exported'))
