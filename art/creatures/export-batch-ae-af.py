"""Export source-only AE/AF crops, uniform scales and translations; no painting."""
from pathlib import Path
import argparse,hashlib,io,json,math
from PIL import Image,ImageDraw
ap=argparse.ArgumentParser();ap.add_argument('--check',action='store_true');ap.add_argument('--batch',choices=['ae-hands','af-items','all'],default='all');args=ap.parse_args();p=Path(__file__).resolve().parent
def save(im,file):
    b=io.BytesIO();im.save(b,format='PNG');raw=b.getvalue()
    if args.check:assert file.read_bytes()==raw,('stale export',file)
    else:file.write_bytes(raw)
    return hashlib.sha256(raw).hexdigest()
for batch in (['ae-hands','af-items']if args.batch=='all'else[args.batch]):
    m=json.loads((p/f'generation-batch-{batch}.json').read_text());out=p/f'batch-{batch}-preview';frames={};measure={}
    for key,c in m['cells'].items():
        if c.get('registered_reuse'):continue
        if c.get('approved_reuse'):
            source=p/c['approved_reuse'];cell=Image.open(source).convert('RGBA');assert cell.size==(256,256);fr={'approved_reuse':c['approved_reuse'],'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'reserve':c.get('reserve',False)}
        else:
            source=p/m['sheets'][c['sheet']]['source'];part=Image.open(source).convert('RGBA').crop(c['source_rect']);v=part.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox();cell=Image.new('RGBA',(256,256))
            if batch=='ae-hands':
                g=c['source_grip'];s=c['source_to_native_scale']
                for extent in [g[0]-v[0],v[2]-g[0],g[1]-v[1],v[3]-g[1]]:
                    if extent>0:s=min(s,111/extent)
                offset=[round(128-g[j]*s)for j in [0,1]]
            else:s=min(216/(v[2]-v[0]),216/(v[3]-v[1]));offset=[round(128-(v[0]+v[2])*s/2),round(128-(v[1]+v[3])*s/2)]
            cell.alpha_composite(part.resize((round(part.width*s),round(part.height*s)),Image.Resampling.LANCZOS),tuple(offset));fr={'source':source.name,'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'source_rect':c['source_rect'],'scale':s,'offset':offset}
            if batch=='ae-hands':
                pt=lambda q:[offset[j]+q[j]*s for j in [0,1]];fr.update(grip=pt(c['source_grip']),object_bounds=pt(c['source_object_bounds'][:2])+pt(c['source_object_bounds'][2:]))
        vb=cell.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox();assert min(vb[:2])>=12 and max(vb[2:])<=244,(key,'clearance',vb);fr.update(visible_bounds=list(vb),export_sha256=save(cell,out/f'{key}.png'));frames[key]=cell;measure[key]=fr
    for key,c in m['cells'].items():
        if c.get('registered_reuse'):
            src=c['registered_reuse'];cell=frames[src];fr={**measure[src],'registered_reuse':src};assert save(cell,out/f'{key}.png')==fr['export_sha256'];frames[key]=cell;measure[key]=fr
    for sid,sh in m['sheets'].items():
        cols,rows=sh['grid'];atlas=Image.new('RGBA',(cols*256,rows*256));contact=Image.new('RGB',(cols*256,rows*288),'#23242d');d=ImageDraw.Draw(contact);alpha=Image.new('RGB',(cols*256,rows*288*3),'#23242d');ad=ImageDraw.Draw(alpha)
        for i,key in enumerate(sh['keys']):
            cell=frames[key];x=i%cols*256;y=i//cols*288;atlas.alpha_composite(cell,(x,i//cols*256));contact.paste(cell,(x,y),cell);d.text((x+3,y+260),key,fill='white')
            for row,bg in enumerate(['#181818','#d0d0d0','#806b51']):
                tile=Image.new('RGB',(256,256),bg);tile.paste(cell,(0,0),cell);ay=y+row*rows*288;alpha.paste(tile,(x,ay));ad.text((x+3,ay+260),key,fill='white')
        save(atlas,out/f'{sid}.png');save(contact,out/f'{sid}-contact.png');save(alpha,out/f'{sid}-alpha.png')
        if batch=='af-items':
            scales=Image.new('RGB',(cols*288,rows*184),'#23242d');sd=ImageDraw.Draw(scales)
            for i,key in enumerate(sh['keys']):
                x=i%cols*288;y=i//cols*184;sd.text((x+3,y+3),key,fill='white');left=x+2
                for size in [32,48,64,128]:
                    icon=frames[key].resize((size,size),Image.Resampling.LANCZOS);scales.paste(icon,(left,y+28),icon);left+=size+2
            save(scales,out/f'{sid}-scales.png')
    text=json.dumps({'scope':'Source-only registered exports; no runtime activation','cells':measure},indent=2)+'\n'
    if args.check:assert(out/'measurements.json').read_text()==text
    else:(out/'measurements.json').write_text(text)
    print(batch,len(frames),'exact source exports', 'verified'if args.check else'written')
