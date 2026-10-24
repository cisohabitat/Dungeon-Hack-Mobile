"""Batch Q world crops and common-scale effect-origin exports. Pillow only.
Raster extraction, uniform scaling and layout; no painting or synthetic masks.
"""
import argparse,hashlib,io,json,math
from pathlib import Path
from PIL import Image,ImageDraw
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args()
p=Path(__file__).resolve().parent;m=json.loads((p/'generation-batch-q.json').read_text());out=p/'batch-q-preview';out.mkdir(exist_ok=True)
def save(im,file):
 b=io.BytesIO();im.save(b,format='PNG');data=b.getvalue()
 if args.check:assert file.read_bytes()==data,f'stale export {file}'
 else:file.write_bytes(data)
 return hashlib.sha256(data).hexdigest()
prepared={};family_scale={}
for key,c in {**m['world'],**m['effects']}.items():
 sheet=m['sheets'][c['sheet']];src=p/sheet.get('selected_source',sheet['source']);im=Image.open(src).convert('RGBA').crop(c['source_rect']);threshold=32 if key in m['world'] else 8;v=im.getchannel('A').point(lambda a:255 if a>threshold else 0).getbbox();assert v and min(v[:2])>0 and v[2]<im.width and v[3]<im.height,(key,'source clipping',v)
 bounds=[max(0,v[0]-3),max(0,v[1]-3),min(im.width,v[2]+3),min(im.height,v[3]+3)];crop=im.crop(bounds)
 if key in m['effects']:
  origin=c['source_origin'];scale=min(216/crop.width,216/crop.height)
  for extent in [origin[0]-v[0],v[2]-origin[0],origin[1]-v[1],v[3]-origin[1]]:
   if extent>0:scale=min(scale,114/extent)
  family_scale[c['family']]=min(family_scale.get(c['family'],scale),scale)
 prepared[key]=(c,src,crop,bounds,v,threshold)
cells={};records={}
for key,(c,src,crop,bounds,v,threshold)in prepared.items():
 if key in m['world']:
  scale=min(216/crop.width,c['max_height']/crop.height);anchor=c['source_anchor'];target=c['target_anchor']
  resized=crop.resize((max(1,round(crop.width*scale)),max(1,round(crop.height*scale))),Image.Resampling.LANCZOS);fitted=resized.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox();offset=[round(target[0]-(anchor[0]-bounds[0])*scale),237-fitted[3]]
 else:
  scale=family_scale[c['family']];anchor=c['source_origin'];target=c['target_origin'];resized=crop.resize((max(1,round(crop.width*scale)),max(1,round(crop.height*scale))),Image.Resampling.LANCZOS);offset=[round(target[i]-(anchor[i]-bounds[i])*scale) for i in [0,1]]
 cell=Image.new('RGBA',(256,256));cell.alpha_composite(resized,tuple(offset));box=cell.getchannel('A').point(lambda a:255 if a>threshold else 0).getbbox();assert min(box[:2])>=12 and max(box[2:])<=244,(key,'clearance',box)
 digest=save(cell,out/f'{key}.png');cells[key]=cell
 records[key]={'source':str(src.relative_to(p)),'source_sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'source_rect':c['source_rect'],'source_visible_bounds':list(v),'alpha_threshold':threshold,'visible_bounds':list(box),'anchor_kind':c['anchor_kind'],'source_anchor':anchor,'target_anchor':target,'scale':scale,'offset':offset,'export_sha256':digest}
contact=Image.new('RGB',(1024,math.ceil(len(cells)/4)*286),'#20242c');d=ImageDraw.Draw(contact)
for i,(key,cell)in enumerate(cells.items()):x=i%4*256;y=i//4*286;contact.paste(cell,(x,y),cell);d.text((x+8,y+265),key,fill='white')
save(contact,out/'contact-sheet.png')
for group,ks in m['groups'].items():
 cols=3 if group=='q1' else 2;rows=math.ceil(len(ks)/cols);atlas=Image.new('RGBA',(cols*256,rows*256))
 for i,key in enumerate(ks):atlas.alpha_composite(cells[key],(i%cols*256,i//cols*256))
 save(atlas,out/f'{group}.png')
# Background tests are review layout composites of the exact exported alpha.
alpha=Image.new('RGB',(1024,3*286));d=ImageDraw.Draw(alpha)
for row,bg in enumerate(['#111317','#c4c6cc','#6f6457']):
 for col,key in enumerate(['fire_0','fire_3','frost_0','frost_3']):
  x=col*256;y=row*286;alpha.paste(Image.new('RGB',(256,286),bg),(x,y));alpha.paste(cells[key],(x,y),cells[key]);d.text((x+8,y+265),key,fill='white' if row!=1 else 'black')
save(alpha,out/'alpha-review.png')
record=json.dumps({'family_scale':family_scale,'cells':records},indent=2)+'\n';target=out/'measurements.json'
if args.check:assert target.read_text()==record,'stale measurements'
else:target.write_text(record)
print('Three static world cells and eight shared-scale RGBA impact cells, atlases/alpha review and measurements '+('verified' if args.check else 'exported'))
