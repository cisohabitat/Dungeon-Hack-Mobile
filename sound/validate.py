"""Validate delivery structure, decoded timing, levels and loop stacks.

Run: python sound/validate.py. Requires NumPy and FFmpeg/ffprobe.
Writes validation.json inside sound/. This cannot replace listening or browser tests.
"""
from pathlib import Path
import hashlib
import json
import math
import subprocess
import tempfile
import numpy as np

ROOT=Path(__file__).resolve().parent
SR=48000


def run(args):
    p=subprocess.run(args,capture_output=True,check=True)
    return p.stdout,p.stderr


def decoded(path, channels):
    data,_=run(['ffmpeg','-v','error','-i',str(path),'-f','f32le','-acodec','pcm_f32le','-'])
    return np.frombuffer(data,dtype='<f4').reshape(-1,channels)


def measure(y):
    with tempfile.TemporaryDirectory() as tmp:
        path=Path(tmp)/'mix.f32'; path.write_bytes(y.astype('<f4').tobytes())
        _,err=run(['ffmpeg','-hide_banner','-f','f32le','-ar',str(SR),'-ac','2','-i',str(path),
          '-af','loudnorm=I=-18:TP=-1:LRA=11:print_format=json','-f','null','-'])
    text=err.decode(); result=json.loads(text[text.rfind('{'):text.rfind('}')+1])
    return {'integratedLufs':float(result['input_i']),'truePeakDbTP':float(result['input_tp'])}


def main():
    m=json.loads((ROOT/'manifest.json').read_text()); config=json.loads((ROOT/'production.json').read_text())
    failures=[]; warnings=[]; checks=[]; mixes=[]
    def check(ok,message):
        if not ok: failures.append(message)
    assets=m['assets']; check(len(assets)==185,'expected 185 logical assets for both tiers')
    check(len({a['file'] for a in assets})==len(assets),'duplicate logical paths')
    for required in config['sfx']:
        e=m['sfx'].get(required['id'],{})
        check(len(e.get('files',[]))==required['variations'],'SFX coverage '+required['id'])
    for family in config['voiceFamilies']:
        check(len(m['sfx'].get('voice-'+family,{}).get('files',[]))==2,'voice coverage '+family)
    for kind in config['deathKinds']:
        check(len(m['sfx'].get('death-'+kind,{}).get('files',[]))==2,'death coverage '+kind)
    for name,count in config['farSounds'].items():
        check(len(m['sfx'].get('far-'+name,{}).get('files',[]))==count,'distant coverage '+name)
    for name,seconds,_ in config['stingers']:
        check(name in m['stingers'],'stinger coverage '+name)
    sources=(ROOT/'SOURCES.md').read_text()
    for a in assets:
        master=ROOT/a['master']; check(master.is_file(),'missing master '+a['file'])
        if master.is_file():
            out,_=run(['ffprobe','-v','error','-show_streams','-of','json',str(master)])
            ms=json.loads(out)['streams'][0]
            check(ms['codec_name']=='flac' and int(ms['bits_per_raw_sample'])==16,'master format '+a['file'])
            check(int(ms['sample_rate'])==SR and ms['channels']==a['channels'],'master audio layout '+a['file'])
            check(int(ms['duration_ts'])==a['samples'],'master sample count '+a['file'])
        check('`'+a['file']+'`' in sources,'missing provenance '+a['file'])
        for ext in ['ogg','m4a']:
            path=ROOT/(a['file']+'.'+ext)
            if not path.is_file(): failures.append('missing '+str(path)); continue
            out,_=run(['ffprobe','-v','error','-show_streams','-of','json',str(path)])
            streams=json.loads(out)['streams']; check(len(streams)==1,'unexpected streams '+str(path))
            s=streams[0]
            check(s['codec_name']==('vorbis' if ext=='ogg' else 'aac'),'codec '+str(path))
            if ext=='m4a': check(s.get('profile')=='LC','AAC-LC '+str(path))
            check(int(s['sample_rate'])==SR,'sample rate '+str(path))
            check(s['channels']==a['channels'],'channel count '+str(path))
            y=decoded(path,a['channels']); peak=float(abs(y).max())
            check(np.isfinite(y).all(),'non-finite samples '+str(path))
            check(peak>1e-7,'silent asset '+str(path))
            check(peak<=10**(-.9/20),'decoded sample peak '+str(path))
            count=len(y)
            # FFmpeg respects AAC priming but often exposes up to 1023 trailing frames.
            check(count>=a['samples'],'decoded file shorter than canonical interval '+str(path))
            check(count-a['samples']<=2048,'excess encoder padding '+str(path))
            check(hashlib.sha256(path.read_bytes()).hexdigest()==a['formats'][ext]['sha256'],'hash mismatch '+str(path))
            item={'file':a['file']+'.'+ext,'decodedSamples':count,'canonicalSamples':a['samples'],
                  'peakDbFS':20*math.log10(max(peak,1e-12))}
            if a['file'].startswith('sfx/'):
                check(path.stat().st_size<100000,'SFX over 100 KB '+str(path))
                active=np.flatnonzero(np.max(abs(y),axis=1)>peak*.01)
                onset=float(active[0]/SR) if len(active) else math.inf
                check(onset<=.005,'onset over 5 ms '+str(path)); item['onsetSeconds']=onset
            if 'loopEndSample' in a:
                z=y[:a['samples']]
                jump=float(np.max(abs(z[0]-z[-1])))
                item['loopSeamJump']=jump
                # Screen abrupt discontinuities; audible seam quality needs listening.
                check(jump<=max(.004,peak*.08),'abrupt loop seam '+str(path))
                if count!=a['samples']: warnings.append('Trim decoded '+a['file']+'.'+ext+' to '+str(a['samples'])+' sample frames')
            checks.append(item)
        print('CHECKED '+a['file'],flush=True)
    for name,theme in m['music'].items():
        check(theme['bars']==12 and theme['timeSignature']=='4/4','music structure '+name)
        check(theme['samples']==round(12*4*60/theme['bpm']*SR),'tempo/sample mapping '+name)
        check(name in m['ambience'],'ambience coverage '+name)
        for ext in ['ogg','m4a']:
            layers=[]
            for stem in ['explore','tension','fight','boss']:
                a=theme['stemMetadata'][stem]
                check(a['samples']==theme['samples'],'unequal stem masters '+name)
                layers.append(decoded(ROOT/(theme['stems'][stem]+'.'+ext),2)[:theme['samples']])
            for n in range(1,5):
                y=sum(layers[:n]); result=measure(y)
                result.update(theme=name,format=ext,stack=['explore','tension','fight','boss'][:n])
                check(result['truePeakDbTP']<=-1,'stack true peak '+name+' '+ext+' '+str(n))
                if n==4: check(-20<=result['integratedLufs']<=-16,'full mix loudness '+name+' '+ext)
                mixes.append(result)
    sizes={}
    for ext in ['ogg','m4a']:
        total=sum((ROOT/(a['file']+'.'+ext)).stat().st_size for a in assets)
        tier1=sum((ROOT/(a['file']+'.'+ext)).stat().st_size for a in assets if a['tier']==1)
        sizes[ext]={'tier1Bytes':tier1,'allBytes':total}
        check(tier1<15000000,ext+' Tier 1 exceeds 15 MB')
        check(total<25000000,ext+' full pack exceeds 25 MB')
    masters=sum(p.stat().st_size for p in (ROOT/'masters').rglob('*.flac'))
    check(masters<60000000,'masters exceed 60 MB')
    sizes['mastersBytes']=masters
    report={'status':'passed' if not failures else 'failed','logicalAssets':len(assets),'exportFiles':len(checks),
            'failures':failures,'decoderPaddingWarnings':warnings,'sizes':sizes,'files':checks,'mixes':mixes,
            'notVerified':['subjective sound quality','realism of synthetic voices','browser decoder priming',
                           'actual game playback','20-minute repetition tolerance','phone performance']}
    (ROOT/'validation.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:report[k] for k in ['status','logicalAssets','exportFiles','failures','sizes']},indent=2))
    raise SystemExit(bool(failures))


if __name__=='__main__': main()
