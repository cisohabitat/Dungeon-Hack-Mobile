from pathlib import Path
from PIL import Image,ImageDraw
import json,math
r=Path(__file__).resolve().parents[2];out=r/'art/creatures/runtime-preview'
d=json.loads((r/'art/creatures/runtime-delivery.json').read_text())
for group in ['creatures','world','materials','held','effects']:
 rows=[x for x in d['files'] if x['runtime'].split('/')[1]==group];cols=8;w=160;h=184
 sheet=Image.new('RGB',(cols*w,math.ceil(len(rows)/cols)*h),'#24242c');draw=ImageDraw.Draw(sheet)
 for i,row in enumerate(rows):
  im=Image.open(r/row['runtime']).convert('RGBA');im.thumbnail((152,152));x=i%cols*w;y=i//cols*h;sheet.paste(im,(x+(w-im.width)//2,y+24),im);draw.text((x+2,y+3),Path(row['runtime']).stem[:25],fill='white')
 sheet.save(out/f'catalog-{group}.png')
