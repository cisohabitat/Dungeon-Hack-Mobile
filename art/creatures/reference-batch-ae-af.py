"""Compose original native reference cells without repainting them."""
from pathlib import Path
import json
from PIL import Image
p=Path(__file__).resolve().parent
for batch in ['ae-hands','af-items']:
    m=json.loads((p/f'generation-batch-{batch}.json').read_text());out=p/f'batch-{batch}-preview'
    for sid,sh in m['sheets'].items():
        cols,rows=sh['grid'];im=Image.new('RGBA',(cols*256,rows*256))
        for i,key in enumerate(sh['keys']):im.alpha_composite(Image.open(out/f'{key}-reference.png'),(i%cols*256,i//cols*256))
        im.save(out/f'{sid}-reference.png')
