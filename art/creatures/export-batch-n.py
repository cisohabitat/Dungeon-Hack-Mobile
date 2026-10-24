"""Reproduce Batch N static scenery crops and authored registration.

Only raster cropping, uniform scaling and authored registration; no painting.
Requires Pillow. --check verifies every export and measurement.
"""
import argparse, hashlib, io, json, math
from pathlib import Path
from PIL import Image, ImageDraw
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args()
folder=Path(__file__).resolve().parent;manifest=json.loads((folder/'generation-batch-n.json').read_text());out=folder/'batch-n-preview';out.mkdir(exist_ok=True)
measurements={};cells={}
def save(im,file,**options):
 b=io.BytesIO();im.save(b,format='WEBP' if file.suffix=='.webp' else 'PNG',**options)
 if args.check:assert file.read_bytes()==b.getvalue(),f'{file}: stale export'
 else:file.write_bytes(b.getvalue())
for kind,c in manifest['scenes'].items():
 source=folder/(c['reuse_source'] if 'reuse_source' in c else manifest['sheets'][c['sheet']].get('selected_source',manifest['sheets'][c['sheet']]['source']))
 original=Image.open(source).convert('RGBA');rect=c['source_rect'];part=original.crop(tuple(rect))
 visible=part.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox();assert visible,(kind,'empty source')
 if 'reuse_source' in c:
  assert part.size==(256,256),(kind,'invalid reuse cell');cell=part;scale=1;offset=[0,0]
 else:
  assert min(visible[:2])>0 and visible[2]<part.width and visible[3]<part.height,(kind,'source cell edge clipping',visible)
  anchor=c['source_anchor'];target=c['target_anchor']
  # Keep the visible scene and a three-pixel antialias rim, excluding faint
  # image-generator haze elsewhere in its authored source rectangle.
  bounds=(max(0,visible[0]-3),max(0,visible[1]-3),min(part.width,visible[2]+3),min(part.height,visible[3]+3));crop=part.crop(bounds)
  scale=min(c.get('max_width',216)/crop.width,c.get('max_height',210)/crop.height)
  for space,extent in [(target[0]-12,anchor[0]-visible[0]),(244-target[0],visible[2]-anchor[0]),(target[1]-12,anchor[1]-visible[1]),(244-target[1],visible[3]-anchor[1])]:
   if extent>0:scale=min(scale,space/extent)
  scaled=crop.resize((max(1,round(crop.width*scale)),max(1,round(crop.height*scale))),Image.Resampling.LANCZOS)
  dx=round(target[0]-(anchor[0]-bounds[0])*scale);dy=round(target[1]-(anchor[1]-bounds[1])*scale)
  # The authored ground-plane anchor is the visible bottom of a whole scene,
  # never a foot inferred from a seated/composed figure.
  if c['anchor_kind']=='scene-ground':
   fitted=scaled.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox();dy=237-fitted[3]
  cell=Image.new('RGBA',(256,256));cell.alpha_composite(scaled,(dx,dy));offset=[dx,dy]
  fitted=scaled.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox()
  assert min(fitted[0]+dx,fitted[1]+dy)>=12 and fitted[2]+dx<=244 and fitted[3]+dy<=244,(kind,'clipped export')
 box=cell.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox();assert min(box[:2])>=12 and max(box[2:])<=244,(kind,'clearance',box)
 save(cell,out/f'{kind}.webp',quality=90,method=6);cells[kind]=cell
 measurements[kind]={'source':str(source.relative_to(folder)),'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'source_rect':rect,'source_visible_bounds':list(visible),'source_anchor':c.get('source_anchor'),'target_anchor':c.get('target_anchor'),'scale':scale,'offset':offset,'visible_bounds':list(box),'export_sha256':hashlib.sha256((out/f'{kind}.webp').read_bytes()).hexdigest()}
cols=min(5,len(cells));contact=Image.new('RGB',(cols*256,math.ceil(len(cells)/cols)*286),'#20242c');draw=ImageDraw.Draw(contact)
for i,(kind,cell) in enumerate(cells.items()):
 x=i%cols*256;y=i//cols*286;contact.paste(cell,(x,y),cell);draw.text((x+10,y+264),kind+(' / reused sit' if 'reuse_source' in manifest['scenes'][kind] else ''),fill='#f5e7ce')
save(contact,out/'contact-sheet.png')
for name,keys in manifest['groups'].items():
 cols=2 if len(keys)==4 else min(3,len(keys));rows=math.ceil(len(keys)/cols);atlas=Image.new('RGBA',(cols*256,rows*256))
 for i,k in enumerate(keys):atlas.alpha_composite(cells[k],(i%cols*256,i//cols*256))
 save(atlas,out/f'{name}.webp',quality=90,method=6)
record=json.dumps(measurements,indent=2)+'\n';target=out/'measurements.json'
if args.check:assert target.read_text()==record,'stale measurements'
else:target.write_text(record)
print(f'{len(cells)} static dressing cells, grouped atlases, contact and measurements '+('verified' if args.check else 'exported'))
