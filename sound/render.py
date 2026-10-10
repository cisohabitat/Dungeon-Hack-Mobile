"""Render the original Deepdelve procedural audio pack.

Requires Python 3, NumPy, SciPy and FFmpeg/ffprobe. No downloads or API calls.
The numerical recipes and seeds are the generation instructions; these are
physically inspired synthetic performances, not recordings of real objects.
Run from any directory: python sound/render.py
"""
from pathlib import Path
import hashlib
import json
import math
import subprocess
import tempfile
import numpy as np
from scipy.signal import butter, sosfilt

ROOT = Path(__file__).resolve().parent
CONFIG = json.loads((ROOT / 'production.json').read_text())
SR = CONFIG['sampleRate']
PEAK = 10 ** (-1 / 20)
STEMS = ['explore', 'tension', 'fight', 'boss']
MANIFEST = {'schemaVersion': 1, 'sampleRate': SR, 'masterBitDepth': 16,
            'production': 'original procedural audio; not live recordings',
            'sfx': {}, 'stingers': {}, 'ambience': {}, 'music': {}, 'title': {}}
CATALOG = []


def rng(label):
    return np.random.default_rng(int.from_bytes(hashlib.sha256(label.encode()).digest()[:8], 'little'))


def low(x, hz):
    return sosfilt(butter(2, min(hz, SR * .45), fs=SR, output='sos'), x, axis=0)


def noise(seconds, label, hz=5000):
    return low(rng(label).normal(size=round(seconds * SR)), hz)


def modal(freq, seconds, instrument='bell'):
    """Damped resonant modes for bells, wood, drums and string-like voices."""
    t = np.arange(round(seconds * SR)) / SR
    modes = {'bell': [1, 2.76, 5.4], 'wood': [1, 2.13, 3.7],
             'drum': [1, 1.59, 2.14], 'string': [1, 2, 3, 4, 5],
             'horn': [1, 2, 3, 4], 'choir': [1, 2, 3, 5]}[instrument]
    y = np.zeros_like(t)
    for i, ratio in enumerate(modes):
        vibrato = .006 * np.sin(2 * np.pi * 4.7 * t) if instrument in ['string', 'choir'] else 0
        phase = 2 * np.pi * freq * ratio * t + vibrato
        y += np.sin(phase) * np.exp(-t * (1 + i * .35) / max(.04, seconds * .35)) / (i + 1) ** 1.5
    attack = .07 if instrument in ['string', 'horn', 'choir'] else .001
    y *= np.minimum(t / attack, 1)
    y *= np.minimum((seconds - t) / .025, 1).clip(0, 1)
    return y


def add(dest, src, at=0, gain=1, pan=0, wrap=False):
    start = round(at * SR)
    if dest.ndim == 2 and src.ndim == 1:
        src = np.column_stack([src * math.sqrt((1 - pan) / 2), src * math.sqrt((1 + pan) / 2)])
    if wrap:
        indices = (np.arange(len(src)) + start) % len(dest)
        np.add.at(dest, indices, src * gain)
    else:
        end = min(len(dest), start + len(src))
        if start < len(dest) and end > start:
            dest[start:end] += src[:end-start] * gain


def burst(seconds, label, cutoff, decay, strength=1):
    t = np.arange(round(seconds * SR)) / SR
    return noise(seconds, label, cutoff) * np.exp(-t * decay) * np.minimum(t / .0005, 1) * strength


def effect(id_, variation, seconds):
    label = f'{id_}-{variation}'
    r = rng(label)
    y = np.zeros(round(seconds * SR))
    def impact(at=0, f=100, length=.15, g=.6, material='drum'):
        add(y, modal(f * r.uniform(.88, 1.12), length, material), at, g)
        add(y, burst(min(length, .12), label+str(at), 4500, 45), at, g*.2)
    def rub(at=0, length=.15, hz=2000, g=.2):
        z = noise(length, label+str(at)+'rub', hz)
        z *= np.sin(np.linspace(0, np.pi, len(z))) ** 1.5
        add(y, z, at, g)
    if id_ in ['swing', 'miss']:
        rub(0, seconds*.95, 4500 if id_ == 'swing' else 2200, .5)
        add(y, burst(.04, label, 8000, 70), .002, .1)
    elif id_ in ['hit-blade','hit-blunt','hit-pierce','hit-fist','crit','hurt','bump','arrow-hit','block','glance']:
        f = {'hit-blade':110,'hit-blunt':65,'hit-pierce':180,'hit-fist':90,'crit':55,
             'hurt':95,'bump':70,'arrow-hit':240,'block':190,'glance':1200}[id_]
        impact(f=f, length=seconds*.75, material='wood' if id_ in ['block','arrow-hit'] else 'drum')
        if id_ in ['hit-blade','block','glance','crit']:
            add(y, modal(1300*r.uniform(.8,1.2), seconds*.9, 'bell'), .002, .09)
        if id_ in ['hit-pierce','hurt','glance']:
            rub(.004, seconds*.75, 3400, .4)
    elif id_.startswith('step-') or id_ == 'stairs':
        count = 4 if id_ == 'stairs' else 1
        for i in range(count):
            at = i*.36
            impact(at, 100, .16, .8, 'wood')
            if id_ == 'step-water': rub(at+.002, .38, 3300, .65)
            else: rub(at+.005, .19, 1800, .15)
    elif id_.startswith('door-'):
        if id_ == 'door-open':
            rub(0, seconds*.8, 650, .4)
            t = np.arange(len(y))/SR
            y += .08*np.sin(2*np.pi*(380*t+20*np.sin(2*np.pi*3*t)))*np.sin(np.pi*t/seconds)**2
            impact(seconds*.7, 95, .2, .6, 'wood')
        elif id_ == 'door-splinter':
            impact(f=70, length=.4)
            for i in range(12): impact(i*.08, r.uniform(160,600), .1, .25, 'wood')
        elif id_ == 'door-locked':
            for at in [0,.12,.26]: impact(at, 220, .1, .5, 'wood')
        elif id_ == 'door-unlock':
            impact(0, 1000, .06, .12, 'bell'); impact(.15, 210, .16, .8, 'wood')
        else: impact(f=75, length=seconds*.7, material='wood'); rub(.008, seconds*.6, 900, .15)
    elif id_ in ['secret','collapse']:
        rub(0, seconds*.95, 800, .35)
        for i in range(7 if id_ == 'collapse' else 3): impact(i*seconds/9, 60+r.uniform(0,130), .25, .4, 'wood')
    elif id_ == 'trap':
        impact(0, 1200, .06, .3, 'bell'); rub(.045, seconds*.65, 6000, .6); impact(.1, 240, .15, .5, 'wood')
    elif id_ in ['pickup','read','ui-page','rest','eat']:
        rub(0, seconds*.92, {'read':6500,'ui-page':5000,'eat':2400,'rest':1600,'pickup':2000}[id_], .4)
        if id_ == 'pickup': impact(.05, 1300, .07, .08, 'bell')
        if id_ == 'eat':
            for at in [0,.13,.28]: impact(at, 450, .06, .2, 'wood')
    elif id_ in ['gold','drink','fountain']:
        if id_ == 'gold':
            for i in range(9): impact(i*.045, r.uniform(1500,3800), .13, .1, 'bell')
        else:
            rub(.003, seconds*.9, 2000, .45)
            for i in range(4): impact(i*seconds/6, 240+r.uniform(0,180), .08, .12)
            if id_ == 'drink': impact(0, 700, .06, .4, 'wood')
    elif id_ in ['ui-tap','ui-error']:
        impact(f=800 if id_=='ui-tap' else 120, length=seconds*.8, material='wood')
    elif id_.startswith('voice-'):
        family = id_[6:]
        f = {'growl':65,'roar':55,'shriek':900,'chant':140,'squelch':90,'rasp':150,
             'hiss':1200,'chitter':500,'grunt':95,'bark':180,'rattle':400,'howl':260,
             'moan':100,'lament':300,'wail':600}[family]
        t = np.arange(len(y))/SR
        if family in ['hiss','rasp','squelch','rattle','chitter']:
            rub(0, seconds*.98, 6000 if family=='hiss' else 1800, .5)
            for i in range(6): impact(i*seconds/7, f, .09, .25, 'wood')
        else:
            voice=np.zeros_like(t)
            gliss=f*(.95+.15*np.sin(2*np.pi*.8*t)+.01*np.sin(2*np.pi*23*t))
            phase=2*np.pi*np.cumsum(gliss)/SR
            for k in range(1,8): voice+=np.sin(k*phase)/k**1.3
            voice=low(voice, 1400 if f<200 else 4500)
            env=np.sin(np.pi*t/seconds)**1.5
            if family in ['bark','grunt','roar']: env*=np.exp(-t*3)
            y+=voice*env*.4; rub(0, seconds*.8, 2200, .12)
            if family=='grunt' and variation==2:
                add(y,burst(.04,label+'breath',4000,80),0,.15)
    elif id_.startswith('death-'):
        kind=id_[6:]
        if kind in ['ecto','spore']:
            rub(0, seconds*.95, 6000, .4)
            add(y, modal(320, seconds*.9, 'choir'), 0, .2)
        else:
            impact(f=55 if kind in ['blood','rot','goo'] else 300, length=.3, material='wood')
            for i in range(5): impact(i*.1, r.uniform(90,650), .14, .25, 'wood')
            rub(.005, seconds*.85, 1400, .35)
    elif id_.startswith('far-'):
        name=id_[4:]
        if name in ['drip','chain','bones','clatter','creak']:
            for i in range(3): impact(i*.3, 1500 if name=='drip' else 400, .3, .25, 'bell' if name in ['drip','chain'] else 'wood')
        else:
            rub(0, seconds*.9, 350 if name=='rumble' else 1000, .4)
            if name=='moan': add(y, modal(110, seconds*.8, 'choir'), 0, .2)
        original=y.copy()
        for lag,gain in [(.11,.28),(.23,.12)]: add(y, original, lag, gain)
    else: raise ValueError(id_)
    # One-shot endings are tapered; looping music is rendered circularly instead.
    n=min(240,len(y)); y[-n:]*=np.linspace(1,0,n)
    if abs(y).max()<1e-8: raise ValueError('silent '+label)
    y*=PEAK/abs(y).max()
    # Remove any initial silence from long material rub envelopes.
    nonzero=np.flatnonzero(abs(y)>PEAK*.01)
    offset=max(0,int(nonzero[0])-24)
    if offset: y=np.concatenate([y[offset:],np.zeros(offset)])
    return y


def command(args):
    return subprocess.run(args, check=True, capture_output=True)


def decode(path, channels):
    raw=command(['ffmpeg','-v','error','-i',str(path),'-f','f32le','-acodec','pcm_f32le','-']).stdout
    return np.frombuffer(raw,dtype='<f4').reshape(-1,channels)


def write_audio(base, y, tier, category, description, loop=False):
    """Keep a 16-bit FLAC master and independently measure both lossy exports."""
    channels=1 if y.ndim==1 else y.shape[1]
    master=ROOT/'masters'/(base+'.flac'); master.parent.mkdir(parents=True,exist_ok=True)
    pcm=(np.clip(y,-.999,.999)*32767).round().astype('<i2')
    with tempfile.TemporaryDirectory() as tmp:
        raw=Path(tmp)/'master.pcm'; raw.write_bytes(pcm.tobytes())
        command(['ffmpeg','-v','error','-y','-f','s16le','-ar',str(SR),'-ac',str(channels),'-i',str(raw),
                 '-c:a','flac','-compression_level','12',str(master)])
    formats={}
    for ext, codec in [('ogg',['-c:a','libvorbis','-q:a','4']),
                       ('m4a',['-c:a','aac','-profile:a','aac_low','-b:a','96k' if channels==1 else '128k'])]:
        path=ROOT/(base+'.'+ext); path.parent.mkdir(parents=True,exist_ok=True)
        gain=1.0
        for attempt in range(4):
            filters=f'volume={gain:.9f}'+(',apad=pad_len=128' if ext=='ogg' else '')
            command(['ffmpeg','-v','error','-y','-i',str(master),'-af',filters,*codec,str(path)])
            decoded=decode(path,channels)
            p=float(abs(decoded).max())
            if p<=PEAK*1.01: break
            gain*=PEAK/p*.997
        if p>PEAK*1.01: raise ValueError('export peak '+str(path))
        formats[ext]={'bytes':path.stat().st_size,'decodedSamples':len(decoded),
                      'peakDbFS':round(20*math.log10(max(p,1e-12)),3),'encodingGain':round(gain,9),
                      'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
    entry={'file':base,'tier':tier,'seconds':len(y)/SR,'samples':len(y),'sampleRate':SR,'channels':channels,
           'master':str(master.relative_to(ROOT)),'description':description,'formats':formats}
    if loop: entry.update(loopStartSample=0,loopEndSample=len(y),loopUnit='decoded PCM sample frames',
                          paddingPolicy='trim decoded buffers to loopEndSample; retain encoder delay metadata')
    CATALOG.append(entry)
    print(f'RENDERED {base}',flush=True)
    return entry


SCALES={'halls':(38,[0,2,3,5,7,9,10]),'crypts':(40,[0,1,3,5,7,8,10]),
        'warrens':(43,[0,3,5,7,10]),'sanctum':(36,[0,1,4,5,7,8,11]),
        'darkelf':(37,[0,2,3,6,7,8,11]),'greyhold':(41,[0,2,3,5,7,8,10]),
        'marsh':(45,[0,2,3,5,7,8,10])}


def hz(midi): return 440*2**((midi-69)/12)


def ambience(theme):
    name=theme['id']; n=30*SR; t=np.arange(n)/SR; y=np.zeros((n,2)); r=rng('ambience-'+name)
    descriptions={'halls':'cold passage air and scattered resonant water drips',
      'crypts':'low stone resonance and wordless breath-like whispers',
      'warrens':'distant scurrying feet and irregular wooden clatter',
      'sanctum':'low ritual hum with a faint dissonant upper resonance',
      'darkelf':'cold air and far-off irregular temple chimes',
      'greyhold':'distant hammer and anvil, low forge-like breathing air',
      'marsh':'water, thin insect chirps, and sparse low frog-like croaks'}
    # Periodic slow modulation and circularly placed contacts avoid loop fades.
    for j in range(2):
        air=noise(30,name+'air'+str(j),250 if name=='greyhold' else 1200)
        air*=.0005*(1+.2*np.sin(2*np.pi*(j+1)*t/30))
        y[:,j]+=air
    root=SCALES[name][0]
    for j in range(2 if name=='sanctum' else 1):
        frequency=round(hz(root+j)*30)/30
        wave=np.sin(2*np.pi*frequency*t)*(.004 if name=='sanctum' else .0015)
        y[:,j%2]+=wave
    for i in range(7):
        at=float(r.uniform(0,30));pan=float(r.uniform(-.8,.8))
        if name=='halls':
            add(y,modal(float(r.uniform(1000,2200)),.5,'bell'),at,.004,pan,True)
        elif name=='crypts':
            breath=noise(1.8,'crypt-breath'+str(i),1800)
            breath-=low(breath,450);breath*=np.sin(np.linspace(0,np.pi,len(breath)))**2
            add(y,breath,at,.009,pan,True)
        elif name=='warrens':
            for j in range(3):
                add(y,modal(float(r.uniform(220,500)),.12,'wood'),at+j*.12,.009,pan,True)
        elif name=='sanctum':
            add(y,modal(hz(root+13),2.4,'choir'),at,.003,pan,True)
        elif name=='darkelf':
            add(y,modal(hz(root+36+[0,7,11][i%3]),2,'bell'),at,.005,pan,True)
        elif name=='greyhold':
            add(y,modal(float(r.uniform(700,1400)),.45,'bell'),at,.007,pan,True)
            add(y,modal(75,.2,'drum'),at,.007,pan,True)
        else:
            add(y,modal(float(r.uniform(350,900)),.25,'wood'),at,.006,pan,True)
            if i%2==0:
                croak=modal(float(r.uniform(90,160)),.5,'wood')
                croak*=1+.6*np.sin(2*np.pi*25*np.arange(len(croak))/SR)
                add(y,croak,at+.4,.008,pan,True)
    if name=='marsh':
        insect=np.sin(2*np.pi*2400*t)*(np.sin(2*np.pi*3*t)**12)*.0006
        y[:,1]+=insect
    return y,descriptions[name]


def music(theme):
    bars=12; beat=60/theme['bpm']; frames=round(bars*4*beat*SR)
    root,scale=SCALES[theme['id']]
    layers={name:np.zeros((frames,2)) for name in STEMS}
    # Four-note identity: home, third, second, fifth; modal pitches adapt per floor.
    motif=[0,2,1,4 if len(scale)>5 else 3]
    for bar in range(bars):
        at=bar*4*beat
        if bar%3==0:
            for j,degree in enumerate(motif):
                add(layers['explore'],modal(hz(root+24+scale[degree]),beat*2.7,'bell'),
                    at+j*beat*.75,.095,pan=[-.45,.15,.45,-.15][j],wrap=True)
            add(layers['explore'],modal(hz(root+12),beat*3,'string'),at,.065,pan=.25,wrap=True)
        for b in [0,2.5]:
            add(layers['tension'],modal(hz(root),beat*.8,'string'),at+b*beat,.12,pan=-.15,wrap=True)
        for b in [0,1.5,2,3.5]:
            degree=0 if b in [0,2] else 4 if len(scale)>5 else 3
            add(layers['fight'],modal(hz(root+12+scale[degree]),beat*.55,'wood'),at+b*beat,.16,pan=.25,wrap=True)
        for b in [0,2]:
            add(layers['fight'],modal(78,beat*.4,'drum'),at+b*beat,.17,pan=-.1,wrap=True)
        add(layers['boss'],modal(hz(root+(scale[5] if len(scale)>5 and bar%2 else 0)),beat*2,'horn'),at,.13,pan=-.3,wrap=True)
        if bar%2==0:
            add(layers['boss'],modal(hz(root+12),beat*2.8,'choir'),at,.055,pan=.35,wrap=True)
        for b in ([0,1,2.5,3] if theme['id']=='warrens' else [0,3]):
            add(layers['boss'],modal(51,beat*.6,'drum'),at+b*beat,.14,pan=.1,wrap=True)
        if theme['id']=='darkelf' and bar%4==2:
            add(layers['explore'],modal(hz(root+36+scale[4]),beat*2,'bell'),at,.02,.6,True)
        if theme['id']=='greyhold' and bar%4==1:
            add(layers['explore'],modal(950,beat*.2,'bell'),at,.018,-.55,True)
        if theme['id']=='marsh' and bar%4==3:
            add(layers['explore'],modal(125,beat*.4,'wood'),at,.02,-.4,True)
    # Measure integrated loudness of the FULL mix, then apply one common gain.
    full=sum(layers.values())
    with tempfile.TemporaryDirectory() as tmp:
        raw=Path(tmp)/'mix.f32';raw.write_bytes(full.astype('<f4').tobytes())
        p=command(['ffmpeg','-hide_banner','-f','f32le','-ar',str(SR),'-ac','2','-i',str(raw),
                   '-af','loudnorm=I=-18:TP=-1:LRA=11:print_format=json','-f','null','-'])
        text=p.stderr.decode(); report=json.loads(text[text.rfind('{'):text.rfind('}')+1])
    gain=10**((-18-float(report['input_i']))/20)
    ceiling=.82 if theme['id']=='sanctum' else .85
    gain=min(gain,ceiling/max(float(abs(full).max()),1e-9))
    for layer in layers.values(): layer*=gain
    result={'tier':theme['tier'],'bpm':theme['bpm'],'key':theme['key'],'bars':bars,'timeSignature':'4/4',
            'samples':frames,'sampleRate':SR,'seconds':frames/SR,'stems':{},'stemMetadata':{},
            'loopStartSample':0,'loopEndSample':frames,'motifScaleDegrees':motif,
            'mixGain':gain,'fullMixExpectedLufs':float(report['input_i'])+20*math.log10(gain)}
    for name in STEMS:
        base=f"music/{theme['id']}/{name}"
        result['stems'][name]=base
        result['stemMetadata'][name]=write_audio(base,layers[name],theme['tier'],'music',
                                               theme['character']+'; '+name,True)
    # Resolve is a standalone cue rather than a loop.
    y=np.zeros((4*SR,2))
    add(y,modal(hz(root+24+scale[4 if len(scale)>5 else 3]),2,'bell'),0,.1,-.2)
    add(y,modal(hz(root+24),3,'bell'),.7,.14,.2)
    add(y,modal(hz(root+12),3,'string'),.7,.08)
    result['resolve']=f"music/{theme['id']}/resolve"
    result['resolveMetadata']=write_audio(result['resolve'],y,theme['tier'],'resolve','return to home note')
    return result


def run(music_only=False):
    if music_only:
        previous=json.loads((ROOT/'manifest.json').read_text())
        MANIFEST['sfx']=previous['sfx']; MANIFEST['stingers']=previous['stingers']
        CATALOG.extend(a for a in previous['assets'] if a['file'].startswith(('sfx/','stingers/')))
    # Durations comply with the brief; distinct seeds produce independent variations.
    durations={'hit-blade':.36,'hit-blunt':.36,'hit-pierce':.28,'hit-fist':.28,'crit':.36,
      'swing':.33,'miss':.47,'block':.46,'glance':.46,'hurt':.56,'bow-shoot':.36,'arrow-hit':.36,
      'door-open':1.05,'door-close':.85,'door-locked':.63,'door-unlock':.65,'door-batter':.55,
      'door-splinter':1.35,'secret':1.6,'stairs':1.7,'trap':.73,'collapse':2.5,'fountain':1.35,
      'step-stone':.28,'step-water':.46,'bump':.27,'pickup':.36,'gold':.55,'drink':.9,'eat':.72,
      'read':.72,'rest':1.35,'ui-tap':.085,'ui-page':.36,'ui-error':.26}
    specs=[(s['id'],s['variations'],s['tier'],s['description'],durations[s['id']]) for s in CONFIG['sfx']]
    specs += [('voice-'+f,2,2,'wordless creature vocalisation: '+f,1.25) for f in CONFIG['voiceFamilies']]
    specs += [('death-'+k,2,2,'creature death material: '+k,.9) for k in CONFIG['deathKinds']]
    specs += [('far-'+k,n,2,'distant dungeon sound: '+k,1.8) for k,n in CONFIG['farSounds'].items()]
    for id_,count,tier,desc,seconds in ([] if music_only else specs):
        variations=[]
        for i in range(1,count+1):
            if id_=='bow-shoot':
                y=effect('swing',i,seconds)
                add(y,modal(330,seconds*.7,'string'),0,.2)
                y*=PEAK/abs(y).max()
            else: y=effect(id_,i,seconds)
            variations.append(write_audio(f'sfx/{id_}-{i}',y,tier,'sfx',desc))
        MANIFEST['sfx'][id_]={'files':[v['file'] for v in variations],'tier':tier,'variations':variations}
    for id_,seconds,desc in ([] if music_only else CONFIG['stingers']):
        y=np.zeros((round(seconds*SR),2))
        notes={'level-up':[62,65,69,74],'death':[50,49,38],'victory':[50,57,62,65,69,74],
               'champion':[38,39],'boss-fall':[48,43,38],'floor':[50,57,51]}[id_]
        for i,midi in enumerate(notes):
            at=i*(seconds*.45/max(1,len(notes)-1))
            add(y,modal(hz(midi),seconds-at,'bell' if id_ in ['level-up','victory','floor'] else 'horn'),at,.16,(-1)**i*.25)
        if id_=='champion': add(y,modal(55,.8,'drum'),0,.3)
        MANIFEST['stingers'][id_]=write_audio('stingers/'+id_,y,1,'stingers',desc)
    for theme in CONFIG['themes']:
        MANIFEST['music'][theme['id']]=music(theme)
        y,description=ambience(theme)
        MANIFEST['ambience'][theme['id']]=write_audio('ambience/'+theme['id'],y,2,'ambience',
                                                     description,True)
    y=np.zeros((38*SR,2))
    for repeat in range(3):
        for i,midi in enumerate([62,65,64,69]):
            at=3+repeat*8+i*1.3
            add(y,modal(hz(midi),5,'bell'),at,.14*(1-repeat*.15),(-1)**i*.35)
        add(y,modal(hz(38),7,'string'),2+repeat*8,.08)
    env=np.minimum(np.arange(len(y))/SR/2,1)*np.minimum((38-np.arange(len(y))/SR)/6,1)
    y*=env[:,None]
    MANIFEST['title']=write_audio('music/title',y,1,'title','38-second statement of four-note identity')
    MANIFEST['assets']=CATALOG
    (ROOT/'manifest.json').write_text(json.dumps(MANIFEST,indent=2)+'\n')
    sources=['# Deepdelve sound sources','',
      'Original procedural audio generated locally on 2026-10-10 for cisohabitat. This is a workaround authorised by the user: none of these assets is a live recording. No third-party recordings, instrument samples, voices or generated-service outputs were used.','',
      'Tool: Python 3 with NumPy and SciPy; FFmpeg renders FLAC, Vorbis and AAC-LC. Model: none. Exact generation instructions are the committed `render.py` recipes, SHA-256-derived seeds, and `production.json`. There were no text-to-audio model prompts.','',
      'Original work is delivered under the repository MIT licence ([../LICENSE](../LICENSE)). Author credit: original procedural composition and sound design generated by the OpenAI assistant for cisohabitat. OpenAI output terms: https://openai.com/policies/terms-of-use/.','',
      '## Processing','',
      'Effects use damped resonant modes, filtered contact/friction noise, timing patterns and pitch variation. Music uses modal bells, string-like resonances, drums, horn-like and wordless choir-like oscillations. These are synthetic approximations of acoustic timbres. Each theme uses 12 bars of 4/4 to fit both format budgets. One common gain balances the four stems; stems are not normalised separately. Loop events wrap circularly; no loop fades are added. One-shots have short end tapers.','',
      'SFX masters are normalised to -1 dBFS. Codec-specific attenuation prevents lossy overshoot. All masters are 48 kHz, 16-bit lossless FLAC. OGG is Vorbis quality 4; M4A is AAC-LC at 96 kbps mono / 128 kbps stereo. Exact decoded counts, encoding gains and SHA-256 values are in `manifest.json`. Vorbis exports receive a 128-frame silent guard to prevent short decoded output; AAC may decode extra trailing frames. Integrations must preserve encoder delay metadata and trim both formats to the specified loop sample count.','',
      '## Asset-by-asset provenance','',
      '| Logical asset | Game-ready exports | FLAC master | Origin and processing |',
      '| --- | --- | --- | --- |']
    for a in CATALOG:
        sources.append(f"| `{a['file']}` | `{a['file']}.ogg`, `{a['file']}.m4a` | `{a['master']}` | Original generated; {a['description']}; modal/filter render, 16-bit master, dual encode |")
    sources += ['', '## Attribution', '', 'No CC-BY assets are present. Preserve the repository MIT copyright and licence notice when redistributing this pack.', '',
                '## Limits', '', 'Automated measurements do not establish aesthetic approval, realistic recording quality, convincing creature voices, or performance in browser decoders. Audition the preview and final assets and test title/loop/ducking integration before release.']
    (ROOT/'SOURCES.md').write_text('\n'.join(sources)+'\n')
    print('COMPLETE',len(CATALOG),'logical assets',flush=True)


if __name__ == '__main__':
    import sys
    run('--music-only' in sys.argv)
