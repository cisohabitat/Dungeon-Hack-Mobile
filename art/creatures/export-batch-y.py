"""Crop, uniformly scale and grip-register existing pixels; no painting or rotation."""
import argparse,hashlib,io,json
from pathlib import Path
from PIL import Image,ImageDraw
p=Path(__file__).resolve().parent;out=p/'batch-y-preview';m=json.loads((p/'generation-batch-y.json').read_text());ap=argparse.ArgumentParser();ap.add_argument('--check',action='store_true');args=ap.parse_args()
def save(im,file):
 b=io.BytesIO();im.save(b,format='PNG');raw=b.getvalue()
 if args.check:assert file.read_bytes()==raw,str(file)
 else:file.write_bytes(raw)
 return hashlib.sha256(raw).hexdigest()
prepared={};scale=1e9
for key,c in m['cells'].items():
 src=p/m['sheets'][c['sheet']]['source'];part=Image.open(src).convert('RGBA').crop(c['source_rect']);v=part.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox();assert v and min(v[:2])>0 and v[2]<part.width and v[3]<part.height,(key,v);b=c['source_object_bounds'];g=c['source_grip'];s=min(128/(b[3]-b[1]),192/(b[2]-b[0]),216/part.width,216/part.height)
 for e in [g[0]-v[0],v[2]-g[0],g[1]-v[1],v[3]-g[1]]:
  if e>0:s=min(s,112/e)
 scale=min(scale,s);prepared[key]=(src,part,v)
measure={};atlas=Image.new('RGBA',(768,256));contact=Image.new('RGB',(768,3*284),'#20242c');d=ImageDraw.Draw(contact)
for i,(key,c)in enumerate(m['cells'].items()):
 src,part,v=prepared[key];offset=[round(128-q*scale) for q in c['source_grip']];cell=Image.new('RGBA',(256,256));cell.alpha_composite(part.resize((round(part.width*scale),round(part.height*scale)),Image.Resampling.LANCZOS),tuple(offset));vb=cell.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox();assert min(vb[:2])>=12 and max(vb[2:])<=244,(key,vb);pt=lambda q:[offset[0]+q[0]*scale,offset[1]+q[1]*scale];b=c['source_object_bounds'];bounds=pt(b[:2])+pt(b[2:]);measure[key]={'source':src.name,'source_sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'source_rect':c['source_rect'],'source_visible_bounds':list(v),'scale':scale,'offset':offset,'grip':pt(c['source_grip']),'object_bounds':bounds,'visible_bounds':list(vb),'export_sha256':save(cell,out/(key+'.png'))};atlas.alpha_composite(cell,(256*i,0))
 for row,bg in enumerate(['#181818','#d0d0d0','#806b51']):
  tile=Image.new('RGB',(256,256),bg);tile.paste(cell,(0,0),cell);contact.paste(tile,(i*256,row*284));d.text((i*256+4,row*284+260),key,fill='white')
save(atlas,out/'shield-atlas.png');save(contact,out/'alpha-review.png');record=json.dumps({'family_scale':scale,'cells':measure},indent=2)+'\n'
if args.check:assert (out/'measurements.json').read_text()==record
else:(out/'measurements.json').write_text(record)
print('Three rear-shield frames, common scale, grip/object bounds and alpha review '+('verified' if args.check else 'exported'))
