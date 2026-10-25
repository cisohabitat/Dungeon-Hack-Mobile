"""Compose native geometry references without modifying their pixels."""
from pathlib import Path
import json
from PIL import Image
p=Path(__file__).resolve().parent/'batch-ac-casters-preview'
m=json.loads((p/'reference-inventory.json').read_text())
for key,pairs in m['groups'].items():
    im=Image.new('RGBA',(256*len(pairs),256))
    for i,(cls,id) in enumerate(pairs):
        im.alpha_composite(Image.open(p/(cls+'-'+id+'-reference.png')),(256*i,0))
    im.save(p/(key+'-reference.png'))
