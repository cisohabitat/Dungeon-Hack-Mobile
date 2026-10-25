"""Register regional source candidates with crops/resampling only; never repair pixels."""
from pathlib import Path
from PIL import Image,ImageDraw
import json,hashlib,io,argparse,numpy as np
p=Path(__file__).resolve().parent;out=p/'batch-ag-ah-preview';m=json.loads((p/'generation-batch-ag-ah.json').read_text());ap=argparse.ArgumentParser();ap.add_argument('--check',action='store_true');args=ap.parse_args();records={};sources={};source_hashes={}
def save(im,f):
 b=io.BytesIO();im.save(b,format='PNG');raw=b.getvalue()
 if args.check:assert f.read_bytes()==raw,str(f)
 else:f.write_bytes(raw)
 return hashlib.sha256(raw).hexdigest()
for name,c in m['cells'].items():
 s=m['sheets'][c['sheet']];src=p/s['source'];
 if src not in sources:sources[src]=Image.open(src).convert('RGBA');source_hashes[src]=hashlib.sha256(src.read_bytes()).hexdigest()
 im=sources[src];cols,rows=s['grid'];i=c['index'];rect=c.get('source_rect',[round(i%cols*im.width/cols),round(i//cols*im.height/rows),round((i%cols+1)*im.width/cols),round((i//cols+1)*im.height/rows)]);part=im.crop(rect)
 if c['key']!='stairArch':
  # Native materials are RGB; preserve generated RGB bytes, omit incidental near-opaque alpha.
  assert np.array(part)[:,:,3].min()>=128,(name,'unexpected hole')
  part=part.convert('RGB').convert('RGBA')
 native=part.resize((64,64),Image.Resampling.LANCZOS);a=np.array(native);record={'batch':c['batch'],'theme':c['theme'],'key':c['key'],'source':src.name,'source_sha256':source_hashes[src],'source_rect':rect,'alpha_min':int(a[:,:,3].min()),'transparent_pixels':int((a[:,:,3]<128).sum()),'sha256':save(native,out/f'{name}.png')};save(part.resize((256,256),Image.Resampling.LANCZOS),out/f'{name}-detail.png')
 if c['key']=='stairArch':
  ref=np.array(Image.open(out/f'{c["theme"]}-stairArch-reference.png').convert('RGBA').resize((64,64),Image.Resampling.NEAREST));record['mask_differences']=int(((a[:,:,3]>=128)!=(ref[:,:,3]>=128)).sum());record['policy']='retain exact native arch during source previews and future integration until exact mask resolved'
 else:
  record['opaque']=record['alpha_min']==255
  rgb=a[:,:,:3].astype(float);record['edge_mean_difference']={'horizontal':round(float(abs(rgb[:,0]-rgb[:,-1]).mean()),2),'vertical':round(float(abs(rgb[0]-rgb[-1]).mean()),2)}
 records[name]=record
for theme in range(13):
 cells=[(k,c)for k,c in m['cells'].items()if c['theme']==theme];cols=6;rows=(len(cells)+cols-1)//cols;contact=Image.new('RGB',(cols*160,rows*185),'#25252a');d=ImageDraw.Draw(contact)
 for i,(k,c)in enumerate(cells):
  im=Image.open(out/f'{k}-detail.png').resize((160,160));contact.paste(im,(i%cols*160,i//cols*185),im);d.text((i%cols*160+3,i//cols*185+162),c['key'],fill='white')
 save(contact,out/f'{theme}-contact.png')
# Source atlases remain separate from runtime loading and release metadata.
for batch in ['ag','ah']:
 for theme in range(13):
  cells=[(k,c)for k,c in m['cells'].items()if c['theme']==theme and c['batch']==batch]
  if not cells:continue
  cols=4 if batch=='ag'else 6;atlas=Image.new('RGBA',(cols*64,((len(cells)+cols-1)//cols)*64))
  for i,(key,c)in enumerate(cells):
   xy=(i%cols*64,i//cols*64);atlas.paste(Image.open(out/f'{key}.png'),xy);records[key]['atlas']={'file':f'{batch}-{theme}-atlas.png','cell':[xy[0],xy[1],64,64]}
  save(atlas,out/f'{batch}-{theme}-atlas.png')
# Diagnostic repetition/alpha compositions never alter selected texture pixels.
for theme in range(1,13):
 keys=['floor'+str(i)for i in range(1,7)]+['ceil'+str(i)for i in range(1,4)]
 im=Image.new('RGB',(3*144,3*150),'#25252a');draw=ImageDraw.Draw(im)
 for i,key in enumerate(keys):
  tile=Image.open(out/f'{theme}-{key}.png').convert('RGB');x=i%3*144;y=i//3*150
  for dx,dy in [(0,0),(64,0),(0,64),(64,64)]:im.paste(tile,(x+dx,y+dy))
  draw.text((x,y+130),key,fill='white')
 save(im,out/f'{theme}-repeat-review.png')
im=Image.new('RGB',(12*80,3*100),'#25252a');draw=ImageDraw.Draw(im)
for row,col in enumerate(['#181818','#dddddd','#806b51']):
 for theme in range(1,13):
  tile=Image.open(out/f'{theme}-stairArch.png');bg=Image.new('RGB',(64,64),col);bg.paste(tile,(0,0),tile);im.paste(bg,((theme-1)*80,row*100));draw.text(((theme-1)*80,row*100+68),str(theme),fill='white')
save(im,out/'arch-alpha-review.png')
record=json.dumps(records,indent=2)+'\n'
if args.check:assert(out/'measurements.json').read_text()==record
else:(out/'measurements.json').write_text(record)
print(len(records),'exports verified'if args.check else 'exports registered');print('Non-opaque non-arch candidates:',[k for k,v in records.items()if v.get('opaque')is False]);print('Arch differences:',{k:v['mask_differences']for k,v in records.items()if'mask_differences'in v})
