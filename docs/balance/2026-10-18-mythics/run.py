#!/usr/bin/env python3
"""Matched Mythic audit, with recorded observer versions and an explicit trial policy."""
import argparse,concurrent.futures,gzip,hashlib,json,os,pathlib,re,subprocess,time
p=argparse.ArgumentParser();p.add_argument('--repo',type=pathlib.Path,required=True);p.add_argument('--output',type=pathlib.Path,required=True);p.add_argument('--suite',choices=['standard','explore','sentinel','passive','tuning','observer'],default='standard');p.add_argument('--workers',type=int,default=4);p.add_argument('--classes',nargs='+',choices=['fighter','cleric','mage','thief','ranger','druid']);a=p.parse_args();root=a.output.resolve();root.mkdir(parents=True,exist_ok=True)
classes=['fighter','cleric','mage','thief','ranger','druid'];repo=a.repo.resolve();observer=(repo/'test/playtest.js').read_text();keys=set(re.findall(r'process\.env\.([A-Z_]+)',observer));env={k:v for k,v in os.environ.items() if k not in keys};seeds=40 if a.suite=='standard' else 4 if a.suite=='passive' else 2;trials=10 if a.suite in ['standard','passive','tuning','observer'] else 2
cases=[dict(prefix=s,diff=d,cls=c,levels=8,size='medium') for s in (['bench','alt','third'] if a.suite in ['standard','passive'] else ['bench','alt']) for d in ['normal','hard'] for c in classes]
if a.suite=='sentinel':cases=[dict(prefix='bench',diff=d,cls=c,levels=n,size=z) for d,n,z in [('normal',4,'small'),('normal',12,'medium'),('hard',16,'medium')]+[(f'hard+{r}',8,'medium') for r in [1,3,5]] for c in classes]
if a.classes:cases=[c for c in cases if c['cls'] in a.classes]
manifest=dict(classes=a.classes or classes,revision=subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip(),suite=a.suite,seeds=seeds,trials=trials,node=subprocess.check_output(['node','--version'],text=True).strip(),observerSha256=hashlib.sha256(observer.encode()).hexdigest(),sourceSha256=hashlib.sha256(b''.join(f.name.encode()+b'\0'+f.read_bytes() for f in sorted((repo/'js').glob('*.js')))).hexdigest(),started=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()))
(root/'inputs.json').write_text(json.dumps(manifest,indent=2)+'\n')
def run(c):
 name='-'.join(str(c[k]) for k in ['prefix','diff','levels','size','cls']);out=root/(name+'.json');log=root/(name+'.log');settings=dict(FIT='1',DIFF=c['diff'],LEVELS=str(c['levels']),SIZE=c['size'],MONSTERS='normal',SEEDPFX=c['prefix'],SEEDN=str(seeds),EARLY='1',CAUSES='1',MYTHIC='off' if a.suite=='passive' else 'trial',EXPLORE='0.8' if a.suite=='explore' else '0',FP='1' if a.suite in ['passive','observer'] else '',JSON_OUT=str(out));start=time.monotonic()
 with log.open('w') as f:status=subprocess.run(['node','test/playtest.js',c['cls'],str(trials)],cwd=repo,env={**env,**settings},stdout=f,stderr=subprocess.STDOUT).returncode
 if status:raise RuntimeError(name)
 data=json.loads(out.read_text());rows=data['results'][c['cls']]
 if len(rows)!=seeds*trials or any(r.get('timedOut') or r.get('cause','').startswith('ERROR') for r in rows):raise RuntimeError('invalid cell '+name)
 return dict(case=c,settings=settings,seconds=round(time.monotonic()-start,2),data=data,fingerprints=[s for s in log.read_text().splitlines() if s.startswith('FP ')])
results=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=a.workers) as pool:
 for f in concurrent.futures.as_completed([pool.submit(run,c) for c in cases]):
  r=f.result();results.append(r);progress=dict(cells=len(results),total=len(cases),runs=sum(len(x['data']['results'][x['case']['cls']]) for x in results),last=r['case']);(root/'progress.json').write_text(json.dumps(progress)+'\n');print(json.dumps(progress),flush=True)
manifest['finished']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime());(root/'runs.json.gz').write_bytes(gzip.compress((json.dumps(dict(provenance=manifest,measurements=results),separators=(',',':'))+'\n').encode(),mtime=0))
