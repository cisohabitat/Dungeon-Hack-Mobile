#!/usr/bin/env python3
"""Reproduction runner. Uses Node for every simulation; Python only schedules
four independent batches and records their commands and exact result hashes.
No game rule or bot decision is changed by this script.
"""
import argparse, concurrent.futures, gzip, hashlib, json, os, pathlib, re, subprocess, time
parser=argparse.ArgumentParser(description='Repeat the fixed 2026-10-16 audit (36 batches, 14,400 runs).')
parser.add_argument('--repo',required=True,type=pathlib.Path,help='detached snapshot with bench-export.patch applied')
parser.add_argument('--output',required=True,type=pathlib.Path,help='new directory for results and progress')
args=parser.parse_args()
repo=args.repo.resolve()
root=args.output.resolve()
revision=subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip()
assert revision=='143d6b5bcdac3dd40d43ae58ac1b3643ac833497', 'wrong snapshot revision'
assert hashlib.sha256((repo/'test/playtest.js').read_bytes()).hexdigest()=='c0b0b031e3aac6ee2bfac8870cabc425dfb04aaf750169568955a0b6281b1b99', 'apply the supplied export patch'
assert subprocess.check_output(['git','diff','--name-only'],cwd=repo,text=True).splitlines()==['test/playtest.js'], 'snapshot has other edits'
root.mkdir(parents=True,exist_ok=False)
classes=['fighter','cleric','mage','thief','ranger','druid']
keys=set(re.findall(r'process\.env\.([A-Z_]+)',(repo/'test/playtest.js').read_text()))
base={k:v for k,v in os.environ.items() if k not in keys}
cells=[(prefix,diff,cls) for prefix in ['bench','alt','third'] for diff in ['normal','hard'] for cls in classes]
manifest={'revision':revision,'nodeVersion':subprocess.check_output(['node','--version'],text=True).strip(),'rulesTree':subprocess.check_output(['git','rev-parse','HEAD:js'],cwd=repo,text=True).strip(),'observerSha256':hashlib.sha256((repo/'test/playtest.js').read_bytes()).hexdigest(),'startedUtc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'workers':4,'plannedRuns':14400,'cells':[]}
(root/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
start=time.monotonic()
def run(cell):
 prefix,diff,cls=cell
 stem=f'{prefix}-{diff}-{cls}'
 settings={'FIT':'1','DIFF':diff,'SEEDN':'40','SEEDPFX':prefix,'LEVELS':'8','SIZE':'medium','MONSTERS':'normal','EARLY':'1','CAUSES':'1','DEATHS':'1','LICH':'1','JSON_OUT':str(root/(stem+'.json'))}
 t0=time.monotonic()
 with (root/(stem+'.log')).open('w') as out:
  p=subprocess.run(['node','test/playtest.js',cls,'10'],cwd=repo,env={**base,**settings},stdout=out,stderr=subprocess.STDOUT)
 if p.returncode: raise RuntimeError(f'{stem} exited {p.returncode}; see its log')
 data=json.loads((root/(stem+'.json')).read_text())
 rows=data['results'][cls]
 assert len(rows)==400,(stem,len(rows))
 assert len(set(r['seed'] for r in rows))==40,stem
 errs=sum((r.get('cause') or '').startswith('ERROR') for r in rows)
 stuck=sum(bool(r.get('timedOut')) for r in rows)
 won=sum(bool(r.get('won')) for r in rows)
 died=sum(bool(r.get('died')) for r in rows)
 result={'prefix':prefix,'difficulty':diff,'cls':cls,'runs':len(rows),'won':won,'died':died,'errors':errs,'timedOut':stuck,'seconds':round(time.monotonic()-t0,3),'settings':settings,'file':stem+'.json','sha256':hashlib.sha256((root/(stem+'.json')).read_bytes()).hexdigest()}
 return result
failed=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 futures={pool.submit(run,c):c for c in cells}
 for future in concurrent.futures.as_completed(futures):
  try:
   cell=future.result()
   manifest['cells'].append(cell)
   manifest['completedRuns']=sum(x['runs'] for x in manifest['cells'])
   manifest['elapsedSeconds']=round(time.monotonic()-start,3)
   (root/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
   print(f"{len(manifest['cells'])}/36 ({manifest['completedRuns']}/14400 runs) {cell['prefix']} {cell['difficulty']} {cell['cls']}: {cell['won']}/400 wins, {cell['timedOut']} timeouts, {cell['errors']} errors; {cell['seconds']}s",flush=True)
  except Exception as e:
   failed.append(str(e)); print('FAILED '+str(e),flush=True)
manifest['finishedUtc']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
manifest['failures']=failed
manifest['elapsedSeconds']=round(time.monotonic()-start,3)
(root/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
if failed: raise SystemExit(1)
print(f"Finished {manifest['completedRuns']} runs in {manifest['elapsedSeconds']}s",flush=True)

# Save every observed outcome, not just rounded console rates. The analysis
# sorts measurements before hashing them, so worker completion order is immaterial.
measurements=[]
for cell in manifest['cells']:
 data=json.loads((root/cell['file']).read_text())
 measurements.append({'prefix':cell['prefix'],'difficulty':cell['difficulty'],'cls':cell['cls'],**data})
archive={'format':1,'provenance':manifest,'measurements':measurements}
(root/'runs.json.gz').write_bytes(gzip.compress((json.dumps(archive,separators=(',',':'))+'\n').encode(),mtime=0))
