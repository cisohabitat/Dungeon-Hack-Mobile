"""Register the selected empty iron lantern frame, without painting/masking pixels."""
import argparse, io, json
from pathlib import Path
from PIL import Image
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args()
root=Path(__file__).resolve().parent/'batch-ai-preview'
im=Image.open(root/'source-compact.png').convert('RGBA')
b=im.getchannel('A').point(lambda a:255 if a>=8 else 0).getbbox()
b=(b[0]-4,b[1]-4,b[2]+4,b[3]+4)
cut=im.crop(b);scale=222/cut.height;size=(round(cut.width*scale),222);at=((256-size[0])//2,17)
out=Image.new('RGBA',(256,256));out.alpha_composite(cut.resize(size,Image.Resampling.LANCZOS),at)
point=lambda x,y:[round(at[0]+(x-b[0])*scale),round(at[1]+(y-b[1])*scale)]
meta={'source':'source-compact.png','crop':b,'scale':scale,'size':size,'paste':at,'anchor':point(443,1134),'window':point(258,946)+point(628,1324),'unitsPerPixel':20/222}
data=io.BytesIO();out.save(data,format='PNG',optimize=True)
for path,content in [(root/'amber-lantern.png',data.getvalue()),(root/'measurements.json',(json.dumps(meta,indent=2)+'\n').encode())]:
 if args.check:assert path.read_bytes()==content,f'Stale {path}'
 else:path.write_bytes(content)
print('Amber lantern registration '+('verified' if args.check else 'exported'))
