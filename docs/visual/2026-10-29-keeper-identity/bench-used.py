import concurrent.futures,hashlib,json,os,pathlib,re,subprocess,sys,time
ROOT=pathlib.Path('/workspace/aaa3b-audit')
stage=sys.argv[1]
classes=['fighter','cleric','mage','thief','ranger','druid','spellblade']
sets=['bench','alt'] if stage.startswith('pilot') else ['bench','alt','third']
seedn,trials=(2,2) if stage=='control' else (8,2) if stage.startswith('pilot') else (40,10)
variants=['baseline','presentation'] if stage=='control' else ['narrow'] if stage=='pilot-narrow' else ['baseline','narrow'] if stage=='final-narrow' else ['baseline','candidate']
jobs=[(v,c,d,s,l) for l in [8,12,16] for s in sets for d in ['normal','hard'] for c in classes for v in variants]
base_env=os.environ.copy()
switches=set(re.findall(r'process\.env\.([A-Z_0-9]+)',pathlib.Path('/workspace/aaa3b-baseline/test/playtest.js').read_text()))
for k in switches:base_env.pop(k,None)
out=ROOT/stage;out.mkdir(exist_ok=True)
records=[];started=time.time()
def run(job):
 v,c,d,s,l=job;key=f'{v}-{c}-{d}-{s}-{l}';wd=pathlib.Path('/workspace/aaa3b-'+v)
 env=base_env.copy();env.update(FIT='1',DIFF=d,SEEDN=str(seedn),SEEDPFX=s,LEVELS=str(l),JSON_OUT=str(out/(key+'.json')))
 if stage=='control':env['FP']='1'
 stamp=time.time()
 with (out/(key+'.log')).open('w') as f:r=subprocess.run(['node','test/playtest.js',c,str(trials)],cwd=wd,env=env,stdout=f,stderr=subprocess.STDOUT)
 result={'key':key,'variant':v,'class':c,'difficulty':d,'set':s,'levels':l,'returncode':r.returncode,'seconds':time.time()-stamp,'runs':0,'errors':0,'timeouts':0,'wins':0}
 if r.returncode==0:
  data=json.loads((out/(key+'.json')).read_text());rows=data['results'][c];result.update(runs=len(rows),errors=sum(str(x.get('cause','')).startswith('ERROR') for x in rows),timeouts=sum(bool(x.get('timedOut')) for x in rows),wins=sum(bool(x.get('won')) for x in rows))
 return result
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 futures=[pool.submit(run,j) for j in jobs]
 for f in concurrent.futures.as_completed(futures):
  row=f.result();records.append(row)
  state={'stage':stage,'started':started,'elapsed':time.time()-started,'seedn':seedn,'trials':trials,'total_jobs':len(jobs),'completed':len(records),'runs':sum(r['runs'] for r in records),'errors':sum(r['errors']+int(r['returncode']!=0) for r in records),'timeouts':sum(r['timeouts'] for r in records),'records':records}
  tmp=out/'progress.tmp';tmp.write_text(json.dumps(state,indent=2)+'\n');tmp.replace(out/'progress.json')
  print(row,flush=True)
  if row['returncode'] or row['errors'] or row['timeouts']:print('INVESTIGATE retained diagnostics; do not publish from this batch',flush=True)
print('ALL BATCHES COMPLETE',flush=True)
