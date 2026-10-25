"""Compose native guides after reference-batch-ag-ah.cjs; preserve production manifest."""
from pathlib import Path
from PIL import Image
import json
p=Path(__file__).resolve().parent;d=p/'batch-ag-ah-preview';m=json.loads((p/'generation-batch-ag-ah.json').read_text())
for i in range(13):
 s=m['sheets'][str(i)];cols,rows=s['grid'];im=Image.new('RGBA',(cols*256,rows*256),(30,30,30,255))
 for n,k in enumerate(s['keys']):im.paste(Image.open(d/f'{i}-{k}-reference.png'),(n%cols*256,n//cols*256))
 im.save(d/f'region-{i}-guide.png')
for key in ['cellDoor','stairArch']:
 im=Image.new('RGBA',(4*256,3*256))
 for n in range(12):im.paste(Image.open(d/f'{n+1}-{key}-reference.png'),(n%4*256,n//4*256))
 im.save(d/f'{key}-repair-guide.png')
