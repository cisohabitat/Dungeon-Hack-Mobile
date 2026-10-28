"""Register blank reading vellum with uniform scaling; preserve source pixels."""
import argparse, io, json
from pathlib import Path
from PIL import Image
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args()
root=Path(__file__).resolve().parent/'batch-aj-preview'
im=Image.open(root/'source-taller.png').convert('RGBA')
b=im.getchannel('A').point(lambda a:255 if a>=8 else 0).getbbox();b=(b[0]-4,b[1]-4,b[2]+4,b[3]+4)
cut=im.crop(b);scale=222/cut.width;size=(222,round(cut.height*scale));at=(17,(256-size[1])//2)
out=Image.new('RGBA',(256,256));out.alpha_composite(cut.resize(size,Image.Resampling.LANCZOS),at)
point=lambda x,y:[round(at[0]+(x-b[0])*scale,4),round(at[1]+(y-b[1])*scale,4)]
meta={'source':'source-taller.png','crop':b,'scale':scale,'size':size,'paste':at,'anchor':point(686,590),'panel':point(130,250)+point(1256,930),'unitsPerPixel':46/(1126*scale)}
data=io.BytesIO();out.save(data,format='PNG',optimize=True)
for path,content in [(root/'reading-scroll.png',data.getvalue()),(root/'measurements.json',(json.dumps(meta,indent=2)+'\n').encode())]:
 if args.check:assert path.read_bytes()==content,f'Stale {path}'
 else:path.write_bytes(content)
print('Reading scroll registration '+('verified' if args.check else 'exported'))
