"""Compose unmodified native reference captures into image-tool geometry guides."""
from pathlib import Path
from PIL import Image
import json
p=Path(__file__).resolve().parent/'batch-ab-named-preview';plan=json.loads((p/'reference-plan.json').read_text())
for key,sh in plan['sheets'].items():
 cols,rows=sh['grid'];im=Image.new('RGBA',(cols*256,rows*256))
 for i,k in enumerate(sh['keys']):im.alpha_composite(Image.open(p/(k+'-reference.png')).convert('RGBA'),(i%cols*256,i//cols*256))
 im.save(p/(key+'-reference.png'));bg=Image.new('RGB',im.size,'#23242d');bg.paste(im,(0,0),im);bg.save(p/(key+'-reference-opaque.png'))
im=Image.new('RGB',(512,256),'#23242d')
for i,cls in enumerate(['fighter','cleric']):
 q=Image.open(p/(cls+'-relic_dawnbringer-windup-reference.png')).convert('RGBA');im.paste(q,(i*256,0),q)
im.save(p/'ab14-windup-reference-opaque.png')
