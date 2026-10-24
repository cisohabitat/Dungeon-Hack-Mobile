"""Reproduce Batch U audit layouts from approved portrait exports; no new painting."""
from pathlib import Path
from PIL import Image,ImageDraw
import argparse,hashlib,io,json
p=Path(__file__).resolve().parent;r=p.parents[1];out=p/'batch-u-preview';out.mkdir(exist_ok=True);ap=argparse.ArgumentParser();ap.add_argument('--check',action='store_true');args=ap.parse_args();m=json.loads((r/'art/portraits/generation.json').read_text());keys=list(m['portraits']);audit={};contact=Image.new('RGB',(1024,564),'#20242c');c=ImageDraw.Draw(contact);sizes=Image.new('RGB',(640,1120),'#20242c');d=ImageDraw.Draw(sizes)
def save(im,file):
 b=io.BytesIO();im.save(b,format='PNG')
 if args.check:assert file.read_bytes()==b.getvalue(),str(file)
 else:file.write_bytes(b.getvalue())
for i,k in enumerate(keys):
 entry=m.get('overrides',{}).get(k,{});src=r/'art/portraits'/entry.get('source',k+'.png');export=r/f'img/portraits/{k}.webp';im=Image.open(export).convert('RGB');assert im.size==(512,512);audit[k]={'source':str(src.relative_to(r)),'source_sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'shipped':str(export.relative_to(r)),'shipped_sha256':hashlib.sha256(export.read_bytes()).hexdigest(),'size':list(im.size),'action':'reuse approved source and shipped bytes; no repaint'};contact.paste(im.resize((256,256),Image.Resampling.LANCZOS),(i%4*256,i//4*282));c.text((i%4*256+4,i//4*282+261),k,fill='white');d.text((4,i*160+3),k+' / 48,96,128px',fill='white')
 for n,x in [(48,12),(96,100),(128,250)]:sizes.paste(im.resize((n,n),Image.Resampling.LANCZOS),(x,i*160+24))
save(contact,out/'contact-sheet.png');save(sizes,out/'size-review.png');record=json.dumps(audit,indent=2)+'\n'
if args.check:assert (out/'inventory.json').read_text()==record
else:(out/'inventory.json').write_text(record)
print('Seven existing portrait source/export hashes and two reuse review sheets '+('verified' if args.check else 'exported'))
