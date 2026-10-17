#!/usr/bin/env python3
"""Run full matched reward-policy comparisons and passive/sentinel regressions."""
import argparse, concurrent.futures, gzip, hashlib, json, os, pathlib, re, subprocess, time
p=argparse.ArgumentParser()
for name in ['baseline','changed','output']:p.add_argument('--'+name,type=pathlib.Path,required=True)
p.add_argument('--workers',type=int,default=4)
p.add_argument('--seeds',type=int,default=40)
a=p.parse_args(); root=a.output.resolve();root.mkdir(parents=True,exist_ok=True)
classes=['fighter','cleric','mage','thief','ranger','druid']
standard=[dict(set=s,diff=d,cls=c,levels=8,size='medium',rung=0) for s in ['bench','alt','third'] for d in ['normal','hard'] for c in classes]
sentinel=[dict(set='bench',diff=d,cls=c,levels=n,size=z,rung=r) for d,n,z,r in [('normal',2,'small',0),('hard',4,'large',0),('normal',12,'medium',0),('hard',16,'medium',0)]+[('hard',8,'medium',r) for r in range(1,6)] for c in classes]
observer=(a.changed/'test/playtest.js').read_bytes(); (a.baseline/'test/playtest.js').write_bytes(observer)
keys=set(re.findall(r'process\.env\.([A-Z_]+)',observer.decode()));env={k:v for k,v in os.environ.items() if k not in keys}
manifest=dict(nodeVersion=subprocess.check_output(['node','--version'],text=True).strip(),observerSha256=hashlib.sha256(observer).hexdigest(),observerSource=observer.decode(),seeds=a.seeds,
 revisions={k:subprocess.check_output(['git','rev-parse','HEAD'],cwd=r,text=True).strip() for k,r in [('baseline',a.baseline),('changed',a.changed)]},
 sources={k:hashlib.sha256(b''.join(p.name.encode()+b'\0'+p.read_bytes() for p in sorted((r/'js').glob('*.js')))).hexdigest() for k,r in [('baseline',a.baseline),('changed',a.changed)]})
marker=root/'inputs.json'
if marker.exists() and json.loads(marker.read_text())!=manifest:raise RuntimeError('Cached sources changed; use a new output directory')
marker.write_text(json.dumps(manifest,sort_keys=True)+'\n');started=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
def run(job):
 case,mode,sent=job;repo=a.baseline if mode in ['baseline','baseline-off'] else a.changed
 seeds=2 if sent else min(4,a.seeds) if mode in ['baseline-off','off','gold'] else a.seeds
 trials=2 if sent else 10
 name='-'.join(str(case[k]) for k in ['set','diff','rung','levels','size','cls'])+'-'+mode
 out=root/(name+'.json');log=root/(name+'.log')
 settings=dict(FIT='1',DIFF=case['diff']+(f"+{case['rung']}" if case['rung'] else ''),LEVELS=str(case['levels']),SIZE=case['size'],MONSTERS='normal',SEEDN=str(seeds),SEEDPFX=case['set'],EARLY='1',CAUSES='1',
 PUZZLES='' if mode in ['off','baseline-off'] else 'solve',PUZZLE_REWARD=mode if mode in ['potion','gear'] else 'gold',FP='1' if mode in ['off','baseline-off'] else '',JSON_OUT=str(out))
 if not (out.exists() and log.exists() and 'OVERALL win ' in log.read_text()):
  with log.open('w') as f:code=subprocess.run(['node','test/playtest.js',case['cls'],str(trials)],cwd=repo,env={**env,**settings},stdout=f,stderr=subprocess.STDOUT).returncode
  if code:raise RuntimeError(name)
 data=json.loads(out.read_text())
 if data['seeds']!=[case['set']+str(i) for i in range(seeds)] or data['trialsPerSeed']!=trials or len(data['results'][case['cls']])!=seeds*trials:raise RuntimeError('Incomplete cell: '+name)
 return dict(case=case,mode=mode,sentinel=sent,settings=settings,data=data,fingerprints=[l for l in log.read_text().splitlines() if l.startswith('FP ')])
jobs=[(c,m,False) for c in standard for m in ['baseline','potion','gear','baseline-off','off','gold']]+[(c,m,True) for c in sentinel for m in ['baseline','potion','gear']]
rows=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=a.workers) as pool:
 for task in concurrent.futures.as_completed([pool.submit(run,j) for j in jobs]):
  row=task.result();rows.append(row);count=sum(len(r['data']['results'][r['case']['cls']]) for r in rows)
  progress=dict(completedCells=len(rows),totalCells=len(jobs),completedRuns=count,last=row['case'],mode=row['mode'])
  (root/'progress.json').write_text(json.dumps(progress)+'\n');print(json.dumps(progress),flush=True)
manifest.update(startedUtc=started,finishedUtc=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),completedCells=len(rows),completedRuns=count)
(root/'runs.json.gz').write_bytes(gzip.compress((json.dumps(dict(provenance=manifest,measurements=rows),separators=(',',':'))+'\n').encode(),mtime=0))
