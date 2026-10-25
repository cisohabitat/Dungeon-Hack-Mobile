"""Compose review diagnostics from real browser screenshots; never alter painted exports."""
from pathlib import Path
from PIL import Image,ImageDraw
import json,math
p=Path(__file__).resolve().parent;o=p/'batch-ab-named-preview/dungeon';m=json.loads((p/'generation-batch-ab-named.json').read_text());r=json.loads((o/'review.json').read_text());galleries=[]
for width in [390,320]:
 shots={c['key']:c for c in r['captures']if c['width']==width}
 groups={s:sh['keys'][:]for s,sh in m['sheets'].items()}
 for family,keys in m['groups'].items():
  if any(m['cells'][k].get('registered_reuse')for k in keys):groups['reuse-'+family]=keys[:]
 for name,keys in groups.items():
  families={m['cells'][k]['relic']+'-'+m['cells'][k]['cls']for k in keys}
  extra=[key for key in shots if any(key.startswith(family+'-')for family in families)and key not in m['cells']]
  selected=list(dict.fromkeys(keys+extra));tiles=[]
  for key in selected:
   shot=shots[key];im=Image.open(o/shot['file']).convert('RGB');b=shot['canvas_box'];im=im.crop((round(b['x']),round(b['y']),round(b['x']+b['width']),round(b['y']+b['height'])))
   im=im.resize((200,round(im.height*200/im.width)));tile=Image.new('RGB',(200,im.height+38),'#23242d');tile.paste(im,(0,38));d=ImageDraw.Draw(tile);label=key.replace('spellblade','SB');d.text((3,3),label[:31],fill='white');d.text((3,18),label[31:],fill='white');tiles.append(tile)
  cols=min(6,len(tiles));height=max(im.height for im in tiles);panel=Image.new('RGB',(cols*200,math.ceil(len(tiles)/cols)*height),'#23242d')
  for i,tile in enumerate(tiles):panel.paste(tile,(i%cols*200,i//cols*height))
  file=f'{width}-{name}-overview.png';panel.save(o/file);galleries.append(file)
r['galleries']=galleries;(o/'review.json').write_text(json.dumps(r,indent=2)+'\n');print(len(galleries),'named source phone galleries composed')
