#!/usr/bin/env python3
"""Compare optional treasure catches with the unchanged rules on matching inputs.
Use --seeds 40 for the usual 400-trial cells; default 4 targets exact regression
parity, not a new statistical win-rate estimate. Never changes combat decisions.
"""
import argparse, concurrent.futures, gzip, hashlib, json, os, pathlib, re, subprocess, time
p = argparse.ArgumentParser()
p.add_argument('--baseline', type=pathlib.Path, required=True)
p.add_argument('--baseline-revision', default='98813a3a384ff8de3f77849144c2ee4d190b7c25')
p.add_argument('--changed', type=pathlib.Path, required=True)
p.add_argument('--output', type=pathlib.Path, required=True)
p.add_argument('--seeds', type=int, default=4)
p.add_argument('--workers', type=int, default=4)
a = p.parse_args()
root = a.output.resolve(); root.mkdir(parents=True, exist_ok=True)
classes = ['fighter', 'cleric', 'mage', 'thief', 'ranger', 'druid']
cases = [{'set': s, 'diff': d, 'cls': c, 'levels': 8, 'size': 'medium', 'rung': 0}
         for s in ['bench', 'alt', 'third'] for d in ['normal', 'hard'] for c in classes]
# Travel lengths, floor sizes and the economy on the ladder: sentinel comparisons,
# kept separate from the standard cells rather than pooled into a win-rate table.
sentinels = [{'set': 'bench', 'diff': d, 'cls': c, 'levels': n, 'size': size, 'rung': r}
             for d, n, size, r in [('normal', 2, 'small', 0), ('hard', 4, 'large', 0), ('normal', 12, 'medium', 0), ('hard', 16, 'medium', 0),
                                    ('hard', 8, 'medium', 1), ('hard', 8, 'medium', 2), ('hard', 8, 'medium', 3), ('hard', 8, 'medium', 4), ('hard', 8, 'medium', 5)]
             for c in classes]
manifest = {'nodeVersion': subprocess.check_output(['node', '--version'], text=True).strip(), 'startedUtc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'seedsPerCell': a.seeds, 'trialsPerSeed': 10,
            'baselineRevision': subprocess.check_output(['git', 'rev-parse', a.baseline_revision], cwd=a.changed, text=True).strip(),
            'changedRevision': subprocess.check_output(['git', 'log', '-1', '--format=%H', '--', 'js', 'css', 'index.html', 'sw.js', 'test/playtest.js'], cwd=a.changed, text=True).strip()}
# The same observer code must run on both snapshots. Default/off is passive;
# only PUZZLES=solve explicitly answers the extra catches in the on variant.
observer = (a.changed / 'test/playtest.js').read_bytes()
manifest['rulesSha256'] = {name: hashlib.sha256(b''.join(p.name.encode() + b'\0' + p.read_bytes() for p in sorted((repo / 'js').glob('*.js')))).hexdigest() for name, repo in [('baseline', a.baseline), ('changed', a.changed)]}
manifest['observerSha256'] = hashlib.sha256(observer).hexdigest()
keys = set(re.findall(r'process\.env\.([A-Z_]+)', observer.decode()))
base_env = {k: v for k, v in os.environ.items() if k not in keys}
(a.baseline / 'test/playtest.js').write_bytes(observer)
cache_key = {'rules': manifest['rulesSha256'], 'observer': manifest['observerSha256'], 'seeds': a.seeds}
marker = root / 'inputs.json'
if marker.exists() and json.loads(marker.read_text()) != cache_key:
    raise RuntimeError('Use a new output directory: the cached source or settings changed.')
marker.write_text(json.dumps(cache_key, sort_keys=True) + '\n')
def run(job):
    case, mode, sentinel = job
    repo = a.baseline if mode == 'baseline' else a.changed
    prefix = f"{case['set']}-{case['diff']}{case['rung']}-{case['levels']}-{case['size']}-{case['cls']}-{mode}"
    path = root / (prefix + '.json')
    settings = {'FIT': '1', 'DIFF': case['diff'] + (f"+{case['rung']}" if case['rung'] else ''), 'SEEDN': '2' if sentinel else str(a.seeds),
                'SEEDPFX': case['set'], 'LEVELS': str(case['levels']), 'SIZE': case['size'], 'MONSTERS': 'normal',
                'EARLY': '1', 'CAUSES': '1', 'FP': '1', 'JSON_OUT': str(path), 'PUZZLES': 'solve' if mode == 'on' else ''}
    # Sentinels have two trials per seed, standard cells keep ten backgrounds/path rotations.
    trials = '2' if sentinel else '10'
    log_path = root / (prefix + '.log')
    cached = path.exists() and log_path.exists() and 'OVERALL win ' in log_path.read_text()
    if not cached:
        with log_path.open('w') as log:
            code = subprocess.run(['node', 'test/playtest.js', case['cls'], trials], cwd=repo, env={**base_env, **settings}, stdout=log, stderr=subprocess.STDOUT).returncode
        if code: raise RuntimeError(prefix)
    data = json.loads(path.read_text())
    expected = [case['set'] + str(i) for i in range(int(settings['SEEDN']))]
    if data['seeds'] != expected or data['trialsPerSeed'] != int(trials) or not data['fit'] or len(data['results'][case['cls']]) != len(expected) * int(trials):
        raise RuntimeError('cached cell has different settings: ' + prefix)
    print(prefix, len(data['results'][case['cls']]), flush=True)
    return {'case': case, 'mode': mode, 'sentinel': sentinel, 'cached': cached, 'settings': settings, 'trialsPerSeed': int(trials), 'data': data,
            'fingerprints': [s for s in (root / (prefix + '.log')).read_text().splitlines() if s.startswith('FP ')]}
jobs = [(case, mode, sentinel) for sentinel, group in [(False, cases), (True, sentinels)] for case in group for mode in ['baseline', 'off', 'on']]
rows = []
with concurrent.futures.ThreadPoolExecutor(max_workers=a.workers) as pool:
    for row in pool.map(run, jobs):
        rows.append(row)
        (root / 'progress.json').write_text(json.dumps({'completed': len(rows), 'total': len(jobs)}))
manifest['completedCells'] = len(rows)
manifest['completedRuns'] = sum(len(r['data']['results'][r['case']['cls']]) for r in rows)
manifest['finishedUtc'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
(root / 'runs.json.gz').write_bytes(gzip.compress((json.dumps({'provenance': manifest, 'measurements': rows}, separators=(',', ':')) + '\n').encode(), mtime=0))
print('Finished', len(rows), 'cells', flush=True)
