"""Compose source review screenshots; does not edit artwork pixels."""
from pathlib import Path
from PIL import Image,ImageDraw
p=Path(__file__).resolve().parent/'batch-ag-ah-preview';d=p/'dungeon'
for width in [390,320]:
 for region in range(13):
  files=[f'{width}-{region}-{k}-1.png'for k in ['door','pillar','up','down']]if region else[]
  files +=[f'{width}-{region}-{k}.png'for k in (['floor1','floor4','fountain','torch1']if region else['decor0','decor1','decor4','decor6'])]
  files=[f for f in files if(d/f).exists()];im=Image.new('RGB',(4*256,((len(files)+3)//4)*330),'#25252a');draw=ImageDraw.Draw(im)
  for i,f in enumerate(files):
   tile=Image.open(d/f).crop((0,45,width,45+450)).resize((256,295));im.paste(tile,(i%4*256,i//4*330));draw.text((i%4*256+3,i//4*330+300),f,fill='white')
  im.save(p/f'{width}-region-{region}-gallery.png')
