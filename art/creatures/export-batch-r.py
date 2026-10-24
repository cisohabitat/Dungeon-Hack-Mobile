"""Batch R deterministic crop/resample registration; no painting or mask correction."""
import argparse,hashlib,io,json
from pathlib import Path
from PIL import Image,ImageDraw
p=Path(__file__).resolve().parent;out=p/'batch-r-preview';m=json.loads((p/'generation-batch-r.json').read_text());ap=argparse.ArgumentParser();ap.add_argument('--check',action='store_true');args=ap.parse_args()
def save(im,file):
 b=io.BytesIO();im.save(b,format='PNG');raw=b.getvalue()
 if args.check:assert file.read_bytes()==raw,str(file)
 else:file.write_bytes(raw)
 return hashlib.sha256(raw).hexdigest()
measures={};contact=Image.new('RGB',(4*256,2*284),'#20242c');draw=ImageDraw.Draw(contact)
for i,(key,c)in enumerate(m['cells'].items()):
 sheet=m['sheets'][c['sheet']];src=p/sheet.get('selected_source',sheet['source']);part=Image.open(src).convert('RGBA').crop(c['source_rect']);native=part.resize((64,64),Image.Resampling.LANCZOS);detail=part.resize((256,256),Image.Resampling.LANCZOS)
 if key!='stairArch':assert native.getchannel('A').getextrema()==(255,255),(key,'must be opaque')
 v={'source':src.name,'source_sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'source_rect':c['source_rect'],'native':[64,64],'detail':[256,256],'native_sha256':save(native,out/f'{key}.png'),'alpha_extrema':native.getchannel('A').getextrema()};save(detail,out/f'{key}-detail.png')
 if key=='stairArch':
  ref=Image.open(out/'0-stairArch-reference.png').convert('RGBA').resize((64,64),Image.Resampling.NEAREST);aa=list(native.getchannel('A').getdata());bb=list(ref.getchannel('A').getdata());v['mask_mismatched_pixels']=sum((a>=128)!=(b>=128) for a,b in zip(aa,bb));v['mask_matches_runtime']=v['mask_mismatched_pixels']==0;v['runtime_policy']='retain original procedural arch; painted candidate is review only unless exact opening is resolved'
 contact.paste(detail,(i%4*256,i//4*284),detail);draw.text((i%4*256+4,i//4*284+261),key,fill='white');measures[key]=v
save(contact,out/'contact-sheet.png')
small=Image.new('RGB',(8*100,112),'#20242c');sd=ImageDraw.Draw(small)
for i,key in enumerate(m['cells']):
 im=Image.open(out/f'{key}.png');small.paste(im,(i*100,0),im);sd.text((i*100,70),key,fill='white')
save(small,out/'native-review.png')
alpha=Image.new('RGB',(512,3*282),'#20242c');ad=ImageDraw.Draw(alpha)
for row,col in enumerate(['#181818','#d0d0d0','#806b51']):
 for i,key in enumerate(['0-stairArch-reference','stairArch-detail']):
  tile=Image.open(out/f'{key}.png').convert('RGBA').resize((256,256),Image.Resampling.NEAREST);bg=Image.new('RGB',(256,256),col);bg.paste(tile,(0,0),tile);alpha.paste(bg,(i*256,row*282));ad.text((i*256+4,row*282+261),'runtime' if i==0 else 'painted candidate',fill='white')
save(alpha,out/'alpha-review.png')
record=json.dumps(measures,indent=2)+'\n'
if args.check:assert (out/'measurements.json').read_text()==record
else:(out/'measurements.json').write_text(record)
print('Eight architecture cells and native64/detail256 measurements '+('verified' if args.check else 'exported'))
print('Arch mask differences:',measures['stairArch']['mask_mismatched_pixels'])
