"""Reproduce Batch P icon and separate grip-registered held review exports.
Only raster extraction, uniform fitting and review layout; no painting. Pillow.
"""
import argparse,hashlib,io,json,math
from pathlib import Path
from PIL import Image,ImageDraw
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args()
p=Path(__file__).resolve().parent;m=json.loads((p/'generation-batch-p.json').read_text());out=p/'batch-p-preview';out.mkdir(exist_ok=True)
def save(im,file):
 b=io.BytesIO();im.save(b,format='WEBP' if file.suffix=='.webp' else 'PNG',**({'quality':90,'method':6} if file.suffix=='.webp' else {}));data=b.getvalue()
 if args.check:assert file.read_bytes()==data,f'stale export {file}'
 else:file.write_bytes(data)
 return hashlib.sha256(data).hexdigest()
records={};icons={};held={}
for key,c in {**m['icons'],**m['held']}.items():
 s=m['sheets'][c['sheet']];source=p/s.get('selected_source',s['source']);im=Image.open(source).convert('RGBA').crop(c['source_rect']);v=im.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox();assert v and min(v[:2])>0 and v[2]<im.width and v[3]<im.height,(key,'source clipping',v)
 bounds=[max(0,v[0]-3),max(0,v[1]-3),min(im.width,v[2]+3),min(im.height,v[3]+3)];crop=im.crop(bounds)
 if c['anchor_kind']=='icon-centre':
  scale=min(216/crop.width,216/crop.height);size=[round(crop.width*scale),round(crop.height*scale)];offset=[(256-size[0])//2,(256-size[1])//2]
 else:
  grip=c['source_grip'];target=c['target_grip'];scale=min(216/crop.width,216/crop.height,c['max_object_height']/(c['source_object_bounds'][3]-c['source_object_bounds'][1]))
  for available,extent in [(114,grip[0]-v[0]),(114,v[2]-grip[0]),(114,grip[1]-v[1]),(114,v[3]-grip[1])]:
   if extent>0:scale=min(scale,available/extent)
  size=[round(crop.width*scale),round(crop.height*scale)];offset=[round(target[i]-(grip[i]-bounds[i])*scale) for i in [0,1]]
 scaled=crop.resize(size,Image.Resampling.LANCZOS);cell=Image.new('RGBA',(256,256));cell.alpha_composite(scaled,tuple(offset));vout=cell.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox();assert min(vout[:2])>=12 and max(vout[2:])<=244,(key,'export clearance',vout)
 file=out/(f'{key}.webp' if key in m['icons'] else f"runeshield-{c['class']}-held.png");digest=save(cell,file)
 record={'source':str(source.relative_to(p)),'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'source_rect':c['source_rect'],'source_visible_bounds':list(v),'scale':scale,'offset':offset,'visible_bounds':list(vout),'export_sha256':digest,'anchor_kind':c['anchor_kind']}
 if key in m['held']:
  record['grip']=[round(offset[i]+(c['source_grip'][i]-bounds[i])*scale) for i in [0,1]];b=c['source_object_bounds'];record['object_bounds']=[offset[0]+(b[0]-bounds[0])*scale,offset[1]+(b[1]-bounds[1])*scale,offset[0]+(b[2]-bounds[0])*scale,offset[1]+(b[3]-bounds[1])*scale];held[key]=cell
 else:icons[key]=cell
 records[key]=record
contact=Image.new('RGB',(1024,572),'#20242c');d=ImageDraw.Draw(contact)
for i,(k,c)in enumerate(icons.items()):x=i%4*256;y=i//4*286;contact.paste(c,(x,y),c);d.text((x+8,y+265),k,fill='white')
save(contact,out/'contact-sheet.png')
scales=Image.new('RGB',(560,7*150),'#20242c');d=ImageDraw.Draw(scales)
for row,(key,c)in enumerate(icons.items()):
 d.text((4,row*150+4),key+' / 32, 64, 128px',fill='white')
 for size,x in [(32,12),(64,80),(128,200)]:small=c.resize((size,size),Image.Resampling.LANCZOS);scales.paste(small,(x,row*150+20),small)
save(scales,out/'icon-scales.png')
for g,ks in m['groups'].items():
 cols=2 if len(ks)==4 else len(ks);rows=math.ceil(len(ks)/cols);atlas=Image.new('RGBA',(cols*256,rows*256))
 for i,key in enumerate(ks):atlas.alpha_composite(icons[key],(i%cols*256,i//cols*256))
 save(atlas,out/f'{g}.webp')
hcontact=Image.new('RGB',(512,286),'#20242c');d=ImageDraw.Draw(hcontact)
for i,(key,c)in enumerate(held.items()):hcontact.paste(c,(i*256,0),c);d.text((i*256+8,265),key+' / rear',fill='white')
save(hcontact,out/'held-contact.png')
text=json.dumps(records,indent=2)+'\n';target=out/'measurements.json'
if args.check:assert target.read_text()==text,'stale measurements'
else:target.write_text(text)
print('Seven icons, two held rear frames, atlases/scales and authored measurements '+('verified' if args.check else 'exported'))
