"""Export seven caster source frames using crops, uniform scales and translation only."""
import argparse,hashlib,io,json,math
from pathlib import Path
from PIL import Image,ImageDraw
p=Path(__file__).resolve().parent;o=p/'batch-ac-casters-preview';m=json.loads((p/'generation-batch-ac-casters.json').read_text());ap=argparse.ArgumentParser();ap.add_argument('--check',action='store_true');args=ap.parse_args()
def save(im,file):
 b=io.BytesIO();im.save(b,format='PNG');raw=b.getvalue()
 if args.check:assert file.read_bytes()==raw,str(file)
 else:file.write_bytes(raw)
 return hashlib.sha256(raw).hexdigest()
prepared={};scales={};measure={};frames={}
for key,c in m['cells'].items():
 if c.get('registered_reuse'):continue
 sh=m['sheets'][c['sheet']];src=p/sh.get('selected_source',sh['source']);part=Image.open(src).convert('RGBA').crop(c['source_rect']);v=part.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox();assert v and min(v[:2])>0 and v[2]<part.width and v[3]<part.height,(key,'source edge',v,part.size)
 b=c['source_object_bounds'];g=c['source_grip'];s=min(c['object_height_limit']/(b[3]-b[1]),192/(b[2]-b[0]),216/part.width,216/part.height)
 for e in [g[0]-v[0],v[2]-g[0],g[1]-v[1],v[3]-g[1]]:
  if e>0:s=min(s,111/e)
 family=c['cls']+'|'+c['id'];scales[family]=min(scales.get(family,1e9),s*c['source_density']);prepared[key]=(src,part,v)
for key,c in m['cells'].items():
 if c.get('registered_reuse'):continue
 src,part,v=prepared[key];s=scales[c['cls']+'|'+c['id']]/c['source_density'];offset=[round(128-c['source_grip'][j]*s)for j in [0,1]];size=[round(part.width*s),round(part.height*s)];cell=Image.new('RGBA',(256,256));cell.alpha_composite(part.resize(size,Image.Resampling.LANCZOS),tuple(offset));vb=cell.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox();assert min(vb[:2])>=12 and max(vb[2:])<=244,(key,'export clearance',vb)
 pt=lambda q:[offset[j]+q[j]*s for j in [0,1]];b=c['source_object_bounds'];fr={'source':src.name,'source_sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'source_rect':c['source_rect'],'source_visible_bounds':list(v),'scale':s,'offset':offset,'grip':pt(c['source_grip']),'object_bounds':pt(b[:2])+pt(b[2:]),'visible_bounds':list(vb),'export_sha256':save(cell,o/(key+'.png'))}
 if 'source_nocks'in c:fr['nocks']={k:pt(v)for k,v in c['source_nocks'].items()}
 if 'source_tip'in c:fr['tip']=pt(c['source_tip'])
 if 'source_base'in c:fr['base']=pt(c['source_base'])
 measure[key]=fr;frames[key]=cell
for key,c in m['cells'].items():
 if not c.get('registered_reuse'):continue
 source=c['registered_reuse'];cell=frames[source];fr={**measure[source],'registered_reuse':source};assert save(cell,o/(key+'.png'))==fr['export_sha256'];measure[key]=fr;frames[key]=cell
for sheet,sh in m['sheets'].items():
 keys=sh['keys'];cols,rows=sh['grid'];atlas=Image.new('RGBA',(cols*256,rows*256));contact=Image.new('RGB',(cols*256,rows*288),'#23242d');reg=contact.copy();cd=ImageDraw.Draw(contact);rd=ImageDraw.Draw(reg)
 for i,key in enumerate(keys):
  cell=frames[key];fr=measure[key];x=i%cols*256;y=i//cols*288;atlas.alpha_composite(cell,(x,i//cols*256));contact.paste(cell,(x,y),cell);reg.paste(cell,(x,y),cell);label=key.replace('spellblade-','SB-');cd.text((x+3,y+259),label,fill='white');rd.text((x+3,y+259),label,fill='white');b=fr['object_bounds'];rd.rectangle((x+b[0],y+b[1],x+b[2],y+b[3]),outline='#d86c63');gx,gy=fr['grip'];rd.line((x+gx-5,y+gy,x+gx+5,y+gy),fill='#48d6d6');rd.line((x+gx,y+gy-5,x+gx,y+gy+5),fill='#48d6d6')
  for q in list(fr.get('nocks',{}).values())+([fr['tip']]if 'tip'in fr else[]):rd.ellipse((x+q[0]-2,y+q[1]-2,x+q[0]+2,y+q[1]+2),outline='#f0d450')
 save(atlas,o/(sheet+'.png'));save(contact,o/(sheet+'-contact.png'));save(reg,o/(sheet+'-registration.png'))
contact=Image.new('RGB',(7*256,3*284),'#23242d');d=ImageDraw.Draw(contact)
for i,(key,cell) in enumerate(frames.items()):
 for row,bg in enumerate(['#181818','#d0d0d0','#806b51']):
  tile=Image.new('RGB',(256,256),bg);tile.paste(cell,(0,0),cell)
  contact.paste(tile,(i*256,row*284));d.text((i*256+3,row*284+260),key,fill='white')
save(contact,o/'alpha-review.png')
record=json.dumps({'family_scale':scales,'cells':measure},indent=2)+'\n'
if args.check:assert(o/'measurements.json').read_text()==record
else:(o/'measurements.json').write_text(record)
print(len(frames),'ordinary caster source exports; not runtime delivery')
