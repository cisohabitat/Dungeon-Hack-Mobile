"""Register the approved Heart paintings; retain source pixels and old atlas reviews."""
import argparse
import io
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
measurements = {}
for key, source in [('artifact', 'source-core.png'), ('heart_dais', 'source-dais.png')]:
    image = Image.open(root / source).convert('RGBA')
    # Measure visible alpha, with a four-source-pixel fringe. The generated
    # transparent canvas has a few almost invisible pixels far from the object.
    box = image.getchannel('A').point(lambda value: 255 if value >= 8 else 0).getbbox()
    box = (max(0, box[0] - 4), max(0, box[1] - 4), min(image.width, box[2] + 4), min(image.height, box[3] + 4))
    cut = image.crop(box)
    scale = min((196 if key == 'artifact' else 216) / cut.width, 222 / cut.height)
    size = (round(cut.width * scale), round(cut.height * scale))
    resized = cut.resize(size, Image.Resampling.LANCZOS)
    result = Image.new('RGBA', (256, 256))
    at = ((256 - size[0]) // 2, 238 - size[1])
    result.alpha_composite(resized, at)
    data = io.BytesIO()
    suffix = '.png' if key == 'artifact' else '.webp'
    if suffix == '.png': result.save(data, format='PNG', optimize=True)
    else: result.save(data, format='WEBP', lossless=True, method=6)
    target = root / (key + suffix)
    if args.check:
        assert target.read_bytes() == data.getvalue(), f'Stale Heart export: {target}'
    else: target.write_bytes(data.getvalue())
    measurements[key] = {'source_crop': box, 'scale': scale, 'registered_size': size, 'paste': at,
                         'visible_bounds': result.getchannel('A').point(lambda value: 255 if value >= 8 else 0).getbbox()}
encoded = (json.dumps(measurements, indent=2) + '\n').encode()
if args.check: assert (root / 'measurements.json').read_bytes() == encoded
else: (root / 'measurements.json').write_bytes(encoded)
print('Two Heart exports ' + ('verified.' if args.check else 'registered.'))
