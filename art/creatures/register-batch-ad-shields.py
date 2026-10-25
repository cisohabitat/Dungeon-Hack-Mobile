"""Measure source landmarks by uniform native-silhouette registration; never edit source pixels.

The fitted landmarks and diagnostic overlays require visual review. Export is a
separate crop/uniform-scale/translation operation. No rotations, masks or repaint.
"""
from pathlib import Path
import json,math
import numpy as np
from PIL import Image
from scipy import ndimage,optimize
p=Path(__file__).resolve().parent;o=p/'batch-ad-shields-preview'
m=json.loads((p/'generation-batch-ad-shields.json').read_text());native=json.loads((o/'reference-inventory.json').read_text())
report={};cache={};rects={}
for sid,sh in m['sheets'].items():
 src=p/sh.get('selected_source',sh['source']);im=Image.open(src).convert('RGBA');cache[str(src)]=im;mask=np.array(im.getchannel('A'))>32;labels,count=ndimage.label(mask);sizes=np.bincount(labels.ravel());objects=ndimage.find_objects(labels);cols,rows=sh['grid'];assigned={}
 for label in range(1,count+1):
  if sizes[label]<=100:continue
  sy,sx=objects[label-1];cy,cx=ndimage.center_of_mass(mask,labels,label);index=min(rows-1,int(cy/im.height*rows))*cols+min(cols-1,int(cx/im.width*cols));assert index<len(sh['keys']) and index not in assigned,(sid,'ambiguous component',index)
  assigned[index]=(label,[sx.start,sy.start,sx.stop,sy.stop])
 assert len(assigned)==len(sh['keys']),(sid,'figure count')
 for index,(label,b)in assigned.items():
  # Find a transparent rectangular gap around this complete connected figure.
  # Analysis labels are never applied to source/output pixels: export crops the
  # original RGBA rectangle including natural antialiasing and raw edge flecks.
  rect=[max(0,b[0]-6),max(0,b[1]-6),min(im.width,b[2]+6),min(im.height,b[3]+6)]
  inside=labels[rect[1]:rect[3],rect[0]:rect[2]];other=np.unique(inside[(inside!=0)&(inside!=label)]);assert all(sizes[q]<=100 for q in other),(sid,index,'another figure enters crop')
  rects[sh['keys'][index]]=rect
for key,c in m['cells'].items():
 sh=m['sheets'][c['sheet']];src=p/sh.get('selected_source',sh['source']);im=cache.setdefault(str(src),Image.open(src).convert('RGBA'))
 rect=rects[key]
 cell=im.crop(rect);alpha=np.array(cell.getchannel('A'));assert (alpha==0).mean()>.08,('Opaque source',key)
 nr=native['rows'][key];ref=Image.open(o/(key+'-reference.png')).convert('RGBA');nm=np.array(ref.getchannel('A'))>32
 k=min(96/cell.width,96/cell.height);small=cell.resize((max(1,round(cell.width*k)),max(1,round(cell.height*k))),Image.Resampling.LANCZOS);target=np.array(small.getchannel('A'))>32
 ys,xs=np.where(target);ny,nx=np.where(nm);assert len(xs) and len(nx)
 scale=((xs.max()-xs.min())/(nx.max()-nx.min())+(ys.max()-ys.min())/(ny.max()-ny.min()))/2
 tx=(xs.min()+xs.max())/2-(nx.min()+nx.max())/2*scale;ty=(ys.min()+ys.max())/2-(ny.min()+ny.max())/2*scale
 def loss(v):
  s,x,y=v
  warped=ndimage.affine_transform(nm.astype(np.uint8),np.eye(2)/s,offset=[-y/s,-x/s],output_shape=target.shape,order=0,prefilter=False)>0
  return 1-np.count_nonzero(warped&target)/max(1,np.count_nonzero(warped|target))
 bounds=[(scale*.7,scale*1.35),(tx-16,tx+16),(ty-16,ty+16)]
 fitted=optimize.minimize(loss,[scale,tx,ty],method='Powell',bounds=bounds,options={'maxiter':35,'xtol':.002,'ftol':.0001})
 candidates=[(loss([scale,tx,ty]),[scale,tx,ty]),(fitted.fun,fitted.x)];error,v=min(candidates,key=lambda x:x[0]);s,x,y=map(float,v);s/=k;x/=k;y/=k
 pt=lambda q:[round(q[0]*s+x,4),round(q[1]*s+y,4)]
 grip=pt(nr['grip']);b=nr['object_bounds'] or [142,42,237,207];lo=pt(b[:2]);hi=pt(b[2:]);pad=min(cell.size)*.055
 box=[max(0,lo[0]-pad),max(0,lo[1]-pad),min(cell.width,hi[0]+pad),min(cell.height,hi[1]+pad)]
 ay,ax=np.where(alpha>32)
 if nr.get('base'): c['source_base']=pt(nr['base'])
 c.update(source_rect=rect,source_density=im.width/sh['grid'][0]/256,source_grip=grip,source_object_bounds=[round(q,4) for q in box],object_height_limit=128 if c['id']=='towershield' else 112)
 c.update(c.get('authored_landmarks',{}))
 report[key]={'source':src.name,'native_to_source':{'scale':s,'offset':[x,y]},'silhouette_iou':round(1-error,4),'source_grip':grip,'source_object_bounds':c['source_object_bounds'],'source_alpha32_bounds':[int(ax.min()),int(ay.min()),int(ax.max()+1),int(ay.max()+1)],'method':'Uniform silhouette alignment measures landmarks only; no rotation or source pixel editing. Review diagnostic overlay.'}
 print(key,round(1-error,3),flush=True)
m['registration']='Native geometry measured by uniform silhouette alignment without rotation/pixel edits; landmarks and exports require visual review.'
(p/'generation-batch-ad-shields.json').write_text(json.dumps(m,indent=2)+'\n');(o/'registration-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print('Measured',len(report),'ordinary shield paintings')
