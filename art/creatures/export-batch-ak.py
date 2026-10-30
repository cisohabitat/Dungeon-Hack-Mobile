"""Register image-tool blood/ash cutouts; crop/scale only, no scripted painting."""
import argparse, hashlib, io, json
from pathlib import Path
from PIL import Image

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--check',action='store_true')
args=parser.parse_args()
root=Path(__file__).resolve().parent/'batch-ak-preview'
source=Image.open(root/'source-clean.png').convert('RGBA')
assert source.size==(2048,768)
measurements={}
for key,cell in [('blood',(0,0,1024,768)),('ash',(1024,0,2048,768))]:
    image=source.crop(cell)
    bounds=image.getchannel('A').point(lambda a:255 if a>=8 else 0).getbbox()
    crop=(max(0,bounds[0]-2),max(0,bounds[1]-2),min(image.width,bounds[2]+2),min(image.height,bounds[3]+2))
    cut=image.crop(crop)
    scale=112/max(cut.size)
    size=tuple(round(n*scale) for n in cut.size)
    at=((128-size[0])//2,(128-size[1])//2)
    out=Image.new('RGBA',(128,128))
    out.alpha_composite(cut.resize(size,Image.Resampling.LANCZOS),at)
    data=io.BytesIO();out.save(data,format='PNG',optimize=True)
    path=root/(key+'.png')
    if args.check:assert path.read_bytes()==data.getvalue(),str(path)
    else:path.write_bytes(data.getvalue())
    measurements[key]={'cell':cell,'crop':crop,'scale':scale,'size':size,'paste':at,'sha256':hashlib.sha256(data.getvalue()).hexdigest()}
content=(json.dumps(measurements,indent=2)+'\n').encode()
path=root/'measurements.json'
if args.check:assert path.read_bytes()==content,str(path)
else:path.write_bytes(content)
print('Blood/ash registration '+('verified' if args.check else 'exported'))
