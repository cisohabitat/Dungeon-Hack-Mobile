"""Register the reviewed mannequin with uniform scaling only; requires Pillow."""
import argparse
import hashlib
import io
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[3]
source = Path(__file__).with_name('mannequin-source.png')
target = root / 'img/ui/equipment-mannequin.webp'
im = Image.open(source).convert('RGBA')
bounds = im.getchannel('A').point(lambda a: 255 if a >= 8 else 0).getbbox()
assert bounds, 'Source must contain an alpha cutout'
# Retain the authored antialiased edge; do not redraw, warp or recolour it.
bounds = (max(0,bounds[0]-2),max(0,bounds[1]-2),min(im.width,bounds[2]+2),min(im.height,bounds[3]+2))
body = im.crop(bounds)
scale = min(292/body.width,520/body.height)
size = tuple(round(v*scale) for v in body.size)
body = body.resize(size,Image.Resampling.LANCZOS)
out = Image.new('RGBA',(720,600))
out.alpha_composite(body,(360-size[0]//2,570-size[1]))
stream=io.BytesIO();out.save(stream,format='WEBP',lossless=True,method=6)
data=stream.getvalue()
report={'source_bounds':list(bounds),'scale':scale,'body_size':list(size),
        'canvas':[720,600],'baseline':570,'sha256':hashlib.sha256(data).hexdigest()}
parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
if args.check:
    assert target.read_bytes()==data,'Shipped mannequin differs from reviewed source registration'
else:
    target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
print(json.dumps(report))
