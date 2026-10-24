"""Crop and uniformly resample Batch S materials; no paint/recolour/seam synthesis."""
import argparse,hashlib,io,json
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
p=Path(__file__).resolve().parent;out=p/'batch-s-preview';m=json.loads((p/'generation-batch-s.json').read_text());ap=argparse.ArgumentParser();ap.add_argument('--check',action='store_true');args=ap.parse_args()
def save(im,file):
 b=io.BytesIO();im.save(b,format='PNG');raw=b.getvalue()
 if args.check:assert file.read_bytes()==raw,str(file)
 else:file.write_bytes(raw)
 return hashlib.sha256(raw).hexdigest()
measure={};contact=Image.new('RGB',(1024,5*282),'#20242c');cd=ImageDraw.Draw(contact);small=Image.new('RGB',(1000,2*100),'#20242c');sd=ImageDraw.Draw(small);repeatkeys=[]
for i,(key,c)in enumerate(m['cells'].items()):
 sheet=m['sheets'][c['sheet']];src=p/sheet.get('selected_source',sheet['source']);part=Image.open(src).convert('RGBA').crop(c['source_rect']);assert part.getchannel('A').getextrema()==(255,255),(key,'nonopaque source');part=part.convert('RGB');native=part.resize((64,64),Image.Resampling.LANCZOS);detail=part.resize((256,256),Image.Resampling.LANCZOS)
 v={'source':src.name,'source_sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'source_rect':c['source_rect'],'native':[64,64],'detail':[256,256],'native_sha256':save(native,out/f'{key}.png')};save(detail,out/f'{key}-detail.png');contact.paste(detail,(i%4*256,i//4*282));cd.text((i%4*256+4,i//4*282+261),key,fill='white');small.paste(native,(i%10*100,i//10*100));sd.text((i%10*100,i//10*100+70),key,fill='white')
 if not key.startswith(('fountain','torch')):
  repeatkeys.append(key);tile=Image.new('RGB',(192,192))
  for yy in range(3):
   for xx in range(3):tile.paste(native,(xx*64,yy*64))
  save(tile,out/f'{key}-repeat.png');a=np.asarray(native,dtype=float);dx=np.abs(a[:,1:]-a[:,:-1]).mean();dy=np.abs(a[1:]-a[:-1]).mean();sx=np.abs(a[:,0]-a[:,-1]).mean();sy=np.abs(a[0]-a[-1]).mean();v['edge_diagnostic']={'join_x_mean':sx,'join_y_mean':sy,'interior_x_mean':dx,'interior_y_mean':dy,'ratio_x':sx/max(dx,1),'ratio_y':sy/max(dy,1)}
 measure[key]=v
save(contact,out/'contact-sheet.png');save(small,out/'native-review.png');rep=Image.new('RGB',(5*192,3*216),'#20242c');rd=ImageDraw.Draw(rep)
for i,key in enumerate(repeatkeys):rep.paste(Image.open(out/f'{key}-repeat.png'),(i%5*192,i//5*216));rd.text((i%5*192+2,i//5*216+194),key,fill='white')
save(rep,out/'repeat-overview.png');record=json.dumps(measure,indent=2)+'\n'
if args.check:assert (out/'measurements.json').read_text()==record
else:(out/'measurements.json').write_text(record)
print('20 opaque native64/detail256 cells and15 repeat panels '+('verified' if args.check else 'exported'))
for k,v in measure.items():
 d=v.get('edge_diagnostic',{})
 if max(d.get('ratio_x',0),d.get('ratio_y',0))>2:print('Inspect edge joins:',k,round(d['ratio_x'],2),round(d['ratio_y'],2))
