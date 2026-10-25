"""Register AA ordinary melee fifth pass painted held poses by authored grips; no painting or rotation."""
import argparse,hashlib,io,json,math
from pathlib import Path
from PIL import Image,ImageDraw
p=Path(__file__).resolve().parent;out=p/'batch-aa-melee5-preview';m=json.loads((p/'generation-batch-aa-melee5.json').read_text());ap=argparse.ArgumentParser();ap.add_argument('--check',action='store_true');args=ap.parse_args()
def save(im,file):
 b=io.BytesIO();im.save(b,format='PNG');raw=b.getvalue()
 if args.check:assert file.read_bytes()==raw,str(file)
 else:file.write_bytes(raw)
 return hashlib.sha256(raw).hexdigest()
prepared={};scales={}
for key,c in m['cells'].items():
 if 'reuse_registered'in c:continue
 sheet=m['sheets'][c['sheet']];src=p/sheet.get('selected_source',sheet['source']);part=Image.open(src).convert('RGBA').crop(c['source_rect']);v=part.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox();assert v and min(v[:2])>0 and v[2]<part.width and v[3]<part.height,(key,'source clipping',v);b=c['source_object_bounds'];g=c['source_grip'];scale=min(c.get('object_height_limit',128)/(b[3]-b[1]),192/(b[2]-b[0]),216/part.width,216/part.height)
 for e in [g[0]-v[0],v[2]-g[0],g[1]-v[1],v[3]-g[1]]:
  if e>0:scale=min(scale,112/e)
 scales[c['sheet']]=min(scales.get(c['sheet'],1e9),scale);prepared[key]=(src,part,v)
for a,b in [('aa20','aa21'),('aa24','aa25')]:scales[a]=scales[b]=min(scales[a],scales[b])
measure={};cells={};contact=Image.new('RGB',(1536,math.ceil(len(m['cells'])/6)*284),'#20242c');cd=ImageDraw.Draw(contact);reg=Image.new('RGB',(1536,math.ceil(len(m['cells'])/6)*284),'#20242c');rd=ImageDraw.Draw(reg)
for i,(key,c)in enumerate(m['cells'].items()):
 if 'reuse_registered'in c:
  rk=c['reuse_registered']['key'];old=json.loads((p/'batch-t-preview/measurements.json').read_text())['cells'][rk];src=p/'batch-t-preview'/f'{rk}.png';cell=Image.open(src).convert('RGBA');fr=dict(old);fr['reused_registered']=str(src.relative_to(p));fr['reused_key']=rk;fr['export_sha256']=save(cell,out/f'{key}.png');lo=fr['object_bounds'][:2];hi=fr['object_bounds'][2:]
 else:
  src,part,v=prepared[key];s=scales[c['sheet']];size=[round(part.width*s),round(part.height*s)];offset=[round(128-c['source_grip'][j]*s) for j in [0,1]];cell=Image.new('RGBA',(256,256));cell.alpha_composite(part.resize(size,Image.Resampling.LANCZOS),tuple(offset));vb=cell.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox();assert min(vb[:2])>=12 and max(vb[2:])<=244,(key,'clearance',vb);pt=lambda q:[offset[0]+q[0]*s,offset[1]+q[1]*s];b=c['source_object_bounds'];lo=pt(b[:2]);hi=pt(b[2:]);fr={'source':src.name,'source_sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'source_rect':c['source_rect'],'source_visible_bounds':list(v),'scale':s,'offset':offset,'grip':pt(c['source_grip']),'object_bounds':lo+hi,'visible_bounds':list(vb),'export_sha256':save(cell,out/f'{key}.png')}
  if 'source_tip'in c:fr['tip']=pt(c['source_tip'])
  if 'source_nocks'in c:fr['nocks']={k:pt(v) for k,v in c['source_nocks'].items()}
 cells[key]=cell;measure[key]=fr;x=i%6*256;y=i//6*284;contact.paste(cell,(x,y),cell);cd.text((x+4,y+261),key,fill='white');reg.paste(cell,(x,y),cell);rd.rectangle((x+lo[0],y+lo[1],x+hi[0],y+hi[1]),outline='#d86c63');gx,gy=fr['grip'];rd.line((x+gx-5,y+gy,x+gx+5,y+gy),fill='#48d6d6');rd.line((x+gx,y+gy-5,x+gx,y+gy+5),fill='#48d6d6');rd.text((x+4,y+261),key,fill='white')
 if 'tip'in fr:
  q=fr['tip'];rd.ellipse((x+q[0]-2,y+q[1]-2,x+q[0]+2,y+q[1]+2),outline='#f0d450')
 for q in fr.get('nocks',{}).values():rd.ellipse((x+q[0]-2,y+q[1]-2,x+q[0]+2,y+q[1]+2),outline='#f0d450')
save(contact,out/'contact-sheet.png');save(reg,out/'registration-review.png')
for group,keys in m['groups'].items():
 cols=m['sheets'][group]['grid'][0];atlas=Image.new('RGBA',(cols*256,math.ceil(len(keys)/cols)*256))
 for i,key in enumerate(keys):atlas.alpha_composite(cells[key],(i%cols*256,i//cols*256))
 save(atlas,out/f'{group}.png')
alpha=Image.new('RGB',(4*256,3*284),'#20242c');ad=ImageDraw.Draw(alpha);selected=[m['groups']['aa17'][6],m['groups']['aa21'][0],m['groups']['aa25'][4],m['groups']['aa27'][0]]
for row,bg in enumerate(['#181818','#d0d0d0','#806b51']):
 for col,key in enumerate(selected):
  tile=Image.new('RGB',(256,256),bg);tile.paste(cells[key],(0,0),cells[key]);alpha.paste(tile,(col*256,row*284));ad.text((col*256+4,row*284+261),key,fill='white')
save(alpha,out/'alpha-review.png')
for group,keys in m['groups'].items():
 cols=m['sheets'][group]['grid'][0];rows=math.ceil(len(keys)/cols);panel=Image.new('RGB',(cols*256,rows*284),'#20242c');pd=ImageDraw.Draw(panel)
 for i,key in enumerate(keys):
  x=i%cols*256;y=i//cols*284;panel.paste(cells[key],(x,y),cells[key]);pd.text((x+3,y+261),key,fill='white')
 save(panel,out/f'{group}-contact.png')
for target,source in [('aa19','aa18'),('aa30','aa29')]:
 for a,b in zip(m['groups'][target],m['groups'][source]):
  assert (out/f'{a}.png').read_bytes()==(out/f'{b}.png').read_bytes(),(a,b)
  assert measure[a]['grip']==measure[b]['grip'] and measure[a]['object_bounds']==measure[b]['object_bounds']
for key in m['groups']['aa23']:
 old=m['cells'][key]['reuse_registered']['key'];assert (out/f'{key}.png').read_bytes()==(p/'batch-t-preview'/f'{old}.png').read_bytes()
record=json.dumps({'family_scale':scales,'cells':measure},indent=2)+'\n'
if args.check:assert (out/'measurements.json').read_text()==record
else:(out/'measurements.json').write_text(record)
print('97 grip-registered RGBA frames, shared family scales, atlases and measurements '+('verified' if args.check else 'exported'))
