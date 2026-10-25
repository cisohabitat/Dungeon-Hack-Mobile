"""Label/composite native source-preview screenshots; do not edit artwork pixels."""
from pathlib import Path
import json,math
from PIL import Image,ImageDraw
p=Path(__file__).resolve().parent;review=[]
ae=p/'batch-ae-hands-preview';m=json.loads((ae/'captures.json').read_text())
for width in [390,320]:
    for cls in dict.fromkeys(c['cls']for c in m['captures']):
        captures=[c for c in m['captures']if c['width']==width and c['cls']==cls];height=520 if width==390 else 410
        im=Image.new('RGB',(4*width,math.ceil(len(captures)/4)*(height+25)),'#23242d');d=ImageDraw.Draw(im)
        for i,c in enumerate(captures):
            tile=Image.open(ae/'dungeon'/c['file']).crop((0,45,width,45+height));x=i%4*width;y=i//4*(height+25);im.paste(tile,(x,y));d.text((x+3,y+height+3),f"{width} {cls} {c['state']}",fill='white')
        f=ae/f'{width}-{cls}-gallery.png';im.save(f);review.append(str(f))
af=p/'batch-af-items-preview'
if (af/'captures.json').exists():
    m=json.loads((af/'captures.json').read_text());plan=json.loads((p/'generation-batch-af-items.json').read_text());groups={sid:[k for k in s['keys']if k not in ['key','amulet_tooth']]for sid,s in plan['sheets'].items()if sid.startswith('af')and sid[2:].isdigit()};groups['approved-P-reuse']=[k for k,c in plan['cells'].items()if c.get('approved_reuse')and not c.get('reserve')]
    by={(c['width'],c['key'],c['mode'],c.get('distance',0)):c for c in m['captures']}
    for width in[390,320]:
        phoneH=844 if width==390 else 667;viewEnd=552 if width==390 else 390
        for sid,keys in groups.items():
            for start in range(0,len(keys),4):
                part=keys[start:start+4];im=Image.new('RGB',(4*width,2*(phoneH+28)),'#23242d');d=ImageDraw.Draw(im)
                for i,k in enumerate(part):
                    floor=by[width,k,'floor',1];pack=by[width,k,'pack',0];x=i%2*2*width;y=i//2*(phoneH+28);d.text((x+3,y+4),f'{width} {k} / floor + Pack source',fill='white');a=Image.open(af/'dungeon'/floor['file']).crop((0,45,width,viewEnd));b=Image.open(af/'dungeon'/pack['file']);im.paste(a,(x,y+28));im.paste(b,(x+width,y+28))
                f=af/f'{width}-{sid}-{start//4+1}-gallery.png';im.save(f);review.append(str(f))
        far=[c for c in m['captures']if c['width']==width and c['mode']=='floor'and c['distance']==3]
        for start in range(0,len(far),8):
            part=far[start:start+8];h=viewEnd-45;im=Image.new('RGB',(4*width,2*(h+25)),'#23242d');d=ImageDraw.Draw(im)
            for i,c in enumerate(part):
                x=i%4*width;y=i//4*(h+25);im.paste(Image.open(af/'dungeon'/c['file']).crop((0,45,width,viewEnd)),(x,y));d.text((x+3,y+h+3),c['key']+' / distance3',fill='white')
            f=af/f'{width}-far-{start//8+1}-gallery.png';im.save(f);review.append(str(f))
Path('/tmp/ae-af-gallery-list.json').write_text(json.dumps(review,indent=2)+'\n');print(len(review),'source-preview galleries composed')
