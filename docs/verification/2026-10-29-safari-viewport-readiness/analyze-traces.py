from pathlib import Path
import zipfile,json,io,re,hashlib,argparse
parser=argparse.ArgumentParser(description='Inspect warning-height baselines in the blocked Safari CI artifact.');parser.add_argument('artifact',type=Path);parser.add_argument('--output',type=Path);args=parser.parse_args();p=args.artifact;out=[]
with zipfile.ZipFile(p) as z:
 report=json.loads(z.read(next(n for n in z.namelist() if n.endswith('-results.json'))))
 def tests(ss):
  for s in ss:
   for spec in s.get('specs',[]):
    for t in spec['tests']:yield spec,t
   yield from tests(s.get('suites',[]))
 for spec,test in tests(report['suites']):
  if test['status']!='unexpected':continue
  for result in test['results']:
   error=re.sub(r'\x1b\[[0-9;]*m','',result['errors'][0]['message']);expected=float(re.search(r'Expected: ([0-9.]+)',error)[1]);received=float(re.search(r'Received: ([0-9.]+)',error)[1]);path=next(a['path'] for a in result['attachments'] if a['name']=='trace');member='test-results/'+path.split('/test-results/',1)[1];raw=z.read(member);events=[]
   with zipfile.ZipFile(io.BytesIO(raw)) as trace:
    for n in trace.namelist():
     if n.endswith('.trace'):events.extend(json.loads(l) for l in trace.read(n).decode().splitlines())
   clears=[e for e in events if e.get('type')=='before' and e.get('method')=='evaluateExpression' and re.search(r'windup\s*=\s*null',e.get('params',{}).get('expression',''))];assert len(clears)==1,len(clears);clear=clears[0]['startTime'];observed=[]
   for e in events:
    if e.get('type')!='frame-snapshot':continue
    s=e['snapshot'];at=s.get('timestamp',0)
    if not clear-400<at<clear:continue
    def walk(x):
     if isinstance(x,list):
      if len(x)>1 and isinstance(x[1],dict) and x[1].get('id')=='view' and '__playwright_bounding_rect__' in x[1]:
       b=json.loads(x[1]['__playwright_bounding_rect__']);observed.append({'timestamp':at,'snapshot':s.get('snapshotName'),'height':b['bottom']-b['top'],'top':b['top'],'canvas_buffer_height':x[1].get('height')})
      for y in x:walk(y)
    walk(s.get('html',[]))
   prior=sorted(observed,key=lambda x:x['timestamp'])[-1] if observed else None
   out.append({'title':spec['title'],'retry':result['retry'],'trace_member':member,'trace_sha256':hashlib.sha256(raw).hexdigest(),'cached_baseline':expected,'after_warning_clear':received,'clear_action_start':clear,'last_canvas_snapshot_before_clear':prior,'already_at_later_height_before_clear':bool(prior and abs(prior['height']-received)<.01)})
encoded=json.dumps(out,indent=2)+'\n'
if args.output:args.output.write_text(encoded)
else:print(encoded,end='')
