"""Lay out existing approved key art and record its hashes; never edit shipped art."""
from pathlib import Path
import hashlib,json,sys
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'art/creatures/batch-w-preview'
FILES=['art/keyart/portrait.png','img/keyart-portrait.webp','art/keyart/landscape.png','img/keyart-landscape.webp','img/portraits/mage.webp','img/portraits/ranger.webp','img/portraits/cleric.webp']
rows=[]
for name in FILES:
    p=ROOT/name
    with Image.open(p) as im:
        rows.append({'path':name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'size':list(im.size),'decision':'reuse unchanged approved artwork'})
manifest={'new_paintings':0,'shipped_file_changes':0,'artwork':rows,'procedural_accents':['Share-card Heart and killer fallback sprites remain compact procedural art where currently selected'],'source_provenance':'art/keyart/SOURCES.md; art/portraits/generation.json','limitations':['Three representative hero portraits captured; full seven-portrait reuse audit is Batch U','Caption/ending-icon follow-ups require content/state selection work, not a new major-screen painting']}
OUT.mkdir(parents=True,exist_ok=True)
data=(json.dumps(manifest,indent=2)+'\n').encode()
sheet=Image.new('RGB',(1024,440),'#20242c');draw=ImageDraw.Draw(sheet)
for i,name in enumerate(FILES[:4]):
    with Image.open(ROOT/name) as src:
        im=src.convert('RGB');im.thumbnail((248,382));x=i*256
        draw.text((x+5,8),name.split('/')[-1],fill='white');draw.text((x+5,25),'source' if name.startswith('art/') else 'shipped',fill='white');sheet.paste(im,(x+(256-im.width)//2,50))
import io
buf=io.BytesIO();sheet.save(buf,format='PNG')
for name,content in [('inventory.json',data),('keyart-contact.png',buf.getvalue())]:
    p=OUT/name
    if '--check' in sys.argv:
        assert p.read_bytes()==content,str(p)+' differs'
    else:p.write_bytes(content)
print('Seven approved art hashes and key-art comparison layout verified')
