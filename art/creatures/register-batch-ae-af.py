"""Measure complete selected source crops/hand landmarks; never mask or repaint pixels."""
from pathlib import Path
import argparse,json
import numpy as np
from PIL import Image
from scipy import ndimage,optimize
ap=argparse.ArgumentParser();ap.add_argument('--batch',choices=['ae-hands','af-items','all'],default='all');args=ap.parse_args()
p=Path(__file__).resolve().parent
for batch in (['ae-hands','af-items'] if args.batch=='all' else [args.batch]):
    file=p/f'generation-batch-{batch}.json';m=json.loads(file.read_text());out=p/f'batch-{batch}-preview';native=json.loads((out/'reference-inventory.json').read_text())['rows'];report={}
    for sid,sh in m['sheets'].items():
        im=Image.open(p/sh['source']).convert('RGBA');alpha=np.array(im.getchannel('A'));labels,n=ndimage.label(alpha>32);sizes=np.bincount(labels.ravel());boxes=ndimage.find_objects(labels);cols,rows=sh['grid'];groups={};owners={}
        for label in range(1,n+1):
            if sizes[label]<9:continue
            sy,sx=boxes[label-1];width=sx.stop-sx.start;height=sy.stop-sy.start
            # Thief's rejected original has thin drawn grid separators. They
            # are outside all selected rectangular crops, never masked away.
            if width<=3 and height>im.height*.8:continue
            cy,cx=ndimage.center_of_mass(alpha>32,labels,label);index=min(rows-1,int(cy/im.height*rows))*cols+min(cols-1,int(cx/im.width*cols))
            if index>=len(sh['keys']):raise ValueError((sid,'unexpected object in blank cell',index))
            key=sh['keys'][index];owners[label]=key
            if m['cells'][key].get('sheet')!=sid:continue
            groups.setdefault(key,[]).append([sx.start,sy.start,sx.stop,sy.stop])
        for key,bounds in groups.items():
            c=m['cells'][key];b=[min(v[0]for v in bounds),min(v[1]for v in bounds),max(v[2]for v in bounds),max(v[3]for v in bounds)]
            rect=[max(0,b[0]-6),max(0,b[1]-6),min(im.width,b[2]+6),min(im.height,b[3]+6)]
            foreign=[int(q)for q in np.unique(labels[rect[1]:rect[3],rect[0]:rect[2]])if q and sizes[q]>=9 and owners.get(int(q))!=key]
            assert not foreign,(key,'another figure enters rectangular crop',foreign)
            part=im.crop(rect);a=np.array(part.getchannel('A'));v=Image.fromarray((a>32).astype('uint8')*255).getbbox()
            assert v and min(v[:2])>0 and v[2]<part.width and v[3]<part.height,(key,'clipped source',v,part.size)
            c.update(source_rect=rect,source_density=im.width/cols/256)
            if batch=='ae-hands':
                ref=Image.open(out/f'{key}-reference.png').convert('RGBA');nm=np.array(ref.getchannel('A'))>32;k=min(96/part.width,96/part.height);target=np.array(part.resize((round(part.width*k),round(part.height*k)),Image.Resampling.LANCZOS).getchannel('A'))>32
                ys,xs=np.where(target);ny,nx=np.where(nm);scale=((xs.max()-xs.min())/(nx.max()-nx.min())+(ys.max()-ys.min())/(ny.max()-ny.min()))/2;tx=(xs.min()+xs.max())/2-(nx.min()+nx.max())/2*scale;ty=(ys.min()+ys.max())/2-(ny.min()+ny.max())/2*scale
                def loss(q):
                    s,x,y=q;warped=ndimage.affine_transform(nm.astype('uint8'),np.eye(2)/s,offset=[-y/s,-x/s],output_shape=target.shape,order=0,prefilter=False)>0
                    return 1-np.count_nonzero(warped&target)/max(1,np.count_nonzero(warped|target))
                fit=optimize.minimize(loss,[scale,tx,ty],method='Powell',bounds=[(scale*.7,scale*1.35),(tx-16,tx+16),(ty-16,ty+16)],options={'maxiter':35,'xtol':.002,'ftol':.0001});error,q=min([(loss([scale,tx,ty]),[scale,tx,ty]),(fit.fun,fit.x)],key=lambda t:t[0]);s,x,y=map(float,q);s/=k;x/=k;y/=k
                grip=[native[key]['grip'][0]*s+x,native[key]['grip'][1]*s+y];native_to_source=s*220/max(native[key]['native_size']);box=[grip[0]-24*native_to_source,grip[1]-28*native_to_source,grip[0]+24*native_to_source,grip[1]+15*native_to_source]
                c.update(source_grip=grip,source_object_bounds=box,source_to_native_scale=1/native_to_source)
                report[key]={'silhouette_iou':round(1-error,4),'source_grip':grip,'nominal_source_to_native_pixel_scale':1/native_to_source}
            else:report[key]={'source_rect':rect,'selected_components':len(bounds),'source_alpha32_bounds':list(v)}
    for key,c in m['cells'].items():
        if c.get('approved_reuse'):continue
        if c.get('registered_reuse'):
            src=m['cells'][c['registered_reuse']]
            for field in ['sheet','index','source_rect','source_density','source_grip','source_object_bounds','source_to_native_scale']:c[field]=src[field]
        assert 'source_rect'in c,(key,'missing source figure')
    m['registration']='Complete selected rectangular crops only; alpha used for measurements, never masks. AE uses uniform native-silhouette landmark alignment and nominal native pixel scale; AF uses complete object crops.'
    file.write_text(json.dumps(m,indent=2)+'\n');(out/'registration-audit.json').write_text(json.dumps(report,indent=2)+'\n');print(batch,len(report),'unique selected source figures measured')
