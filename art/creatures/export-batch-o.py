"""Deterministic crop/resample export and repeat diagnostics for Batch O.
No painting, recolouring, synthesis or seam blending. Requires Pillow and NumPy.
"""
import argparse,hashlib,io,json
from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args()
p=Path(__file__).resolve().parent;m=json.loads((p/'generation-batch-o.json').read_text());out=p/'batch-o-preview';out.mkdir(exist_ok=True)
def save(im,file):
 b=io.BytesIO();im.save(b,format='PNG');data=b.getvalue()
 if args.check:assert file.read_bytes()==data,f'stale export {file}'
 else:file.write_bytes(data)
 return hashlib.sha256(data).hexdigest()
measurements={};tiles={}
for key,t in m['tiles'].items():
 s=m['sheets'][t['sheet']];src=p/s.get('selected_source',s['source']);im=Image.open(src).convert('RGBA');rect=t['source_rect'];part=im.crop(rect);assert part.getchannel('A').getextrema()==(255,255),(key,'nonopaque source')
 tile=part.convert('RGB').resize((64,64),Image.Resampling.LANCZOS);review=part.convert('RGB').resize((256,256),Image.Resampling.LANCZOS);tiles[key]=tile
 digest=save(tile,out/f'{key}.png');save(review,out/f'{key}-detail.png')
 a=np.asarray(tile,dtype=np.float32);dx=np.abs(a[:,1:]-a[:,:-1]).mean(axis=2);dy=np.abs(a[1:]-a[:-1]).mean(axis=2)
 sx=np.abs(a[:,0]-a[:,-1]).mean(axis=1);sy=np.abs(a[0]-a[-1]).mean(axis=1)
 # Diagnostic only: a low scalar difference does not prove feature alignment.
 seam={'horizontal_join_mean':float(sx.mean()),'vertical_join_mean':float(sy.mean()),'interior_x_mean':float(dx.mean()),'interior_y_mean':float(dy.mean()),'horizontal_ratio':float(sx.mean()/max(dx.mean(),1)),'vertical_ratio':float(sy.mean()/max(dy.mean(),1)),'horizontal_join_p95':float(np.percentile(sx,95)),'vertical_join_p95':float(np.percentile(sy,95))}
 repeat=Image.new('RGB',(192,192))
 for y in range(3):
  for x in range(3):repeat.paste(tile,(x*64,y*64))
 save(repeat,out/f'{key}-repeat.png')
 measurements[key]={'source':str(src.relative_to(p)),'source_sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'source_rect':rect,'native':[64,64],'detail':[256,256],'export_sha256':digest,'rgb_mean':np.asarray(tile).mean(axis=(0,1)).tolist(),'edge_diagnostic':seam}
contact=Image.new('RGB',(768,len(m['groups'])*282),'#20242c');draw=ImageDraw.Draw(contact)
repeats=Image.new('RGB',(768,len(m['groups'])*220),'#20242c');rd=ImageDraw.Draw(repeats)
for row,(group,keys) in enumerate(m['groups'].items()):
 for col,key in enumerate(keys):
  contact.paste(Image.open(out/f'{key}-detail.png'),(col*256,row*282));draw.text((col*256+6,row*282+261),key,fill='white')
  rep=Image.open(out/f'{key}-repeat.png');repeats.paste(rep,(col*256,row*220+24));rd.text((col*256+4,row*220+6),key,fill='white')
save(contact,out/'contact-sheet.png');save(repeats,out/'repeat-overview.png')
flagged=[key for key,v in measurements.items() if max(v['edge_diagnostic']['horizontal_ratio'],v['edge_diagnostic']['vertical_ratio'])>2]
if flagged:
 diagnostic=Image.new('RGB',(768,((len(flagged)+3)//4)*216),'#20242c');dd=ImageDraw.Draw(diagnostic)
 for i,key in enumerate(flagged):
  x=i%4*192;y=i//4*216;diagnostic.paste(Image.open(out/f'{key}-repeat.png'),(x,y+24));dd.text((x+2,y+5),key,fill='white')
 save(diagnostic,out/'edge-diagnostic-overview.png')
record=json.dumps(measurements,indent=2)+'\n'
if args.check:assert (out/'measurements.json').read_text()==record,'stale measurements'
else:(out/'measurements.json').write_text(record)
print(f'{len(tiles)} opaque native64/detail/repeat tiles and measurements '+('verified' if args.check else 'exported'))
for k,v in measurements.items():
 d=v['edge_diagnostic']
 if max(d['horizontal_ratio'],d['vertical_ratio'])>2:print('Inspect edge alignment:',k,round(d['horizontal_ratio'],2),round(d['vertical_ratio'],2))
