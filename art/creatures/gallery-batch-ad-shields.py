"""Compose labelled source-review screen crops; no edits to equipment pixels."""
from pathlib import Path
import json
from PIL import Image,ImageDraw
p=Path(__file__).resolve().parent/'batch-ad-shields-preview'
m=json.loads((p/'captures.json').read_text())
for width in [390,320]:
    for key in dict.fromkeys(c['key'] for c in m['captures']):
        captures=[c for c in m['captures'] if c['width']==width and c['key']==key]
        height=520 if width==390 else 410
        gallery=Image.new('RGB',(4*width,2*(height+25)),'#23242d')
        d=ImageDraw.Draw(gallery)
        for i,c in enumerate(captures):
            im=Image.open(p/'dungeon'/c['file'])
            tile=im.crop((0,45,width,45+height))
            x=i%4*width;y=i//4*(height+25)
            gallery.paste(tile,(x,y))
            d.text((x+3,y+height+3),f"{width} {key} {c['state']}",fill='white')
        gallery.save(p/f'{width}-{key}-gallery.png')
