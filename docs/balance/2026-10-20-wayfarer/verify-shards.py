#!/usr/bin/env python3
"""Recheck that per-seed processes preserve the retained twenty-run pilot."""
import concurrent.futures
import json
import os
from pathlib import Path
import subprocess

OUT = Path(__file__).resolve().parent
REPO = OUT.parents[2]
DEST = OUT / 'shards' / 'scheduling-check'
DEST.mkdir(parents=True, exist_ok=True)

def run(index):
    seed = f'bench{index}'
    env = {**os.environ, 'FIT': '1', 'LEVELS': '16', 'DIFF': 'normal',
           'SEEDN': '4', 'SEEDPFX': 'bench', 'SEEDONLY': seed,
           'JSON_OUT': str(DEST / (seed + '.json'))}
    with (DEST / (seed + '.log')).open('w') as log:
        subprocess.run(['node', 'test/playtest.js', 'spellblade', '5'],
                       cwd=REPO, env=env, stdout=log, stderr=subprocess.STDOUT,
                       check=True)
    data = json.loads((DEST / (seed + '.json')).read_text())
    rows = data['results']['spellblade']
    assert len(rows) == 5 and all(r['seed'] == seed for r in rows), seed
    return rows

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    rows = [r for cell in pool.map(run, range(4)) for r in cell]
pilot = json.loads((OUT / 'deepward-pilot-16-normal-bench.json').read_text())
assert rows == pilot['results']['spellblade'], 'Sharding changed recorded outcomes'
message = ('20/20 complete outcome records exactly match the retained unsharded '
           'Deepward pilot, including backgrounds, resources, every death cause '
           'and actual casts. Four SEEDONLY processes kept SEEDN=4 and five trials; '
           'the global background/trial index was preserved.\n')
(OUT / 'sharding-check.txt').write_text(message)
print(message, end='')
