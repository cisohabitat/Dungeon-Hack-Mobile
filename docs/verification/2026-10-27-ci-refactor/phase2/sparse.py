"""Compare a real sparse Git worktree with the full candidate (Python3/PyYAML)."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
from urllib.parse import unquote, urlsplit

import yaml

parser = argparse.ArgumentParser()
parser.add_argument('--full', type=Path, default=Path(__file__).resolve().parents[4])
parser.add_argument('--sparse', type=Path, required=True)
parser.add_argument('--output', type=Path, default=Path('/tmp/ci-execution-sparse.json'))
args = parser.parse_args()
full, sparse = args.full.resolve(), args.sparse.resolve()
workflow = (full / '.github/workflows/test.yml').read_text()
jobs = yaml.safe_load(workflow)['jobs']
settings = jobs['browser']['steps'][0]['with']
for name in ('perf', 'safari', 'small'):
    assert jobs[name]['steps'][0]['with'] == settings, 'Shared checkout settings diverged.'
assert settings['persist-credentials'] is False and settings['sparse-checkout-cone-mode'] is False
patterns = subprocess.check_output(['git', 'sparse-checkout', 'list'], cwd=sparse, text=True)
assert patterns.strip() == settings['sparse-checkout'].strip(), 'Worktree must use the actual workflow patterns.'
assert not (sparse / 'docs').exists() and not (sparse / 'sound/masters').exists()
assert (sparse / 'art/creatures/generation-batch-ab-named.json').is_file()
tracked = subprocess.check_output(['git', 'ls-files', '-t', '-z'], cwd=sparse, text=True).split('\0')
selected = [row[2:] for row in tracked if row.startswith('H ')]
all_paths = {row[2:] for row in tracked if row}
required = {p for p in all_paths if '/' not in p or p.split('/')[0] in {'api', 'js', 'css', 'img', 'icons', 'test', 'tools'} or (p.startswith('sound/') and not p.startswith('sound/masters/'))}
assert required <= set(selected), sorted(required - set(selected))
hashes = {}
for name in selected:
    data = (sparse / name).read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    assert digest == hashlib.sha256((full / name).read_bytes()).hexdigest(), name
    hashes[name] = {'bytes': len(data), 'sha256': digest}

# Evaluate only the repository's static ASSETS array, not the worker or any
# network handler. Check every actual precache URL against selected file bytes.
extract = "const fs=require('node:fs'),vm=require('node:vm');const s=fs.readFileSync(process.argv[1],'utf8');console.log(JSON.stringify(vm.runInNewContext(s.match(/const ASSETS = (\\[[\\s\\S]*?\\]);/)[1],{}, {timeout:1000})));"
assets = json.loads(subprocess.check_output(['node', '-e', extract, str(full / 'sw.js')], text=True))
for asset in assets:
    url = urlsplit(asset)
    assert not url.scheme and not url.netloc
    name = unquote(url.path).removeprefix('./')
    if name in ('', '/'):
        name = 'index.html'
    target = (sparse / name).resolve()
    assert target.is_relative_to(sparse) and target.is_file(), asset
    assert name in hashes, asset

baseline = '1c6fb9431012f002469b375b7678a05b773e236f'
tree = subprocess.check_output(['git', 'ls-tree', '-rlz', baseline], cwd=full, text=True)
baseline_bytes = sum(int(row.split('\t', 1)[0].split()[-1]) for row in tree.split('\0') if row and row.split('\t', 1)[0].split()[-1] != '-')
data = {'baseline': baseline, 'workflowSHA256': hashlib.sha256(workflow.encode()).hexdigest(),
        'scope': 'Real local non-cone sparse worktree using actual workflow patterns, compared byte-for-byte with full candidate. Tracked working-tree payload; not compressed network bytes or checkout time.',
        'baselineTrackedBytes': baseline_bytes, 'selectedBytes': sum(v['bytes'] for v in hashes.values()),
        'selectedFiles': len(selected), 'byteDifferences': 0, 'serviceWorkerAssetURLs': len(assets),
        'requiredRuntimeAndTestPaths': len(required), 'creatureMetadataFiles': len(list((sparse / 'art/creatures').glob('*.json'))),
        'files': hashes}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(data, indent=2) + '\n')
print(json.dumps({k: v for k, v in data.items() if k != 'files'}))
