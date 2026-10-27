"""Verify actual workflow commands against Playwright's complete case inventory.

Review-only tool: Python3 + PyYAML, project Node/Playwright; no browser install.
This discovers declarations, not test results. Required CI verifies execution.
"""
import argparse
import collections
import hashlib
import itertools
import json
import os
from pathlib import Path
import shlex
import subprocess

import yaml

parser = argparse.ArgumentParser()
parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[4])
parser.add_argument('--output', type=Path, default=Path('/tmp/ci-execution-inventory.json'))
args = parser.parse_args()
root = args.root.resolve()
baseline = '1c6fb9431012f002469b375b7678a05b773e236f'
git = lambda *a: subprocess.check_output(['git', *a], cwd=root, text=True)
assert not git('diff', baseline, '--name-only', '--', 'test/browser', 'playwright.config.js', 'package.json', 'package-lock.json').strip(), 'Test/config inputs must be unchanged for this workflow-only comparison.'
original = git('show', baseline + ':.github/workflows/test.yml')
current = (root / '.github/workflows/test.yml').read_text()
plans = {name: yaml.safe_load(source)['jobs'] for name, source in [('before', original), ('after', current)]}
package = json.loads((root / 'package.json').read_text())
cli = root / 'node_modules/@playwright/test/cli.js'
cache = {}


def inventory(flags):
    key = tuple(flags)
    if key not in cache:
        command = ['node', str(cli), 'test', *flags, '--list', '--reporter=json']
        result = subprocess.run(command, cwd=root, env={**os.environ, 'CI': '1'}, capture_output=True, text=True)
        assert result.returncode == 0, result.stderr + result.stdout
        report = json.loads(result.stdout)
        assert not report.get('errors'), report.get('errors')
        cases = []

        def walk(suites, parents=()):
            for suite in suites:
                trail = (*parents, suite['title'])
                for spec in suite.get('specs', []):
                    for test in spec['tests']:
                        cases.append(json.dumps([test['projectName'], spec['file'], spec['line'], spec['column'], *trail, spec['title']], separators=(',', ':')))
                walk(suite.get('suites', []), trail)

        walk(report['suites'])
        assert len(set(cases)) == len(cases), 'Duplicate declaration identity'
        cache[key] = cases
    return cache[key]


def command_flags(command):
    words = shlex.split(command)
    if words[:3] == ['npm', 'run', 'test:webkit']:
        rest = words[3:]
        if rest[:1] == ['--']:
            rest = rest[1:]
        words = shlex.split(package['scripts']['test:webkit']) + rest
        assert words[:2] == ['playwright', 'test']
        return words[2:]
    assert words[:3] == ['npx', 'playwright', 'test'], command
    return words[3:]


projects = {'browser': 'phone', 'small': 'small', 'safari': 'safari', 'perf': 'perf'}
full = {project: inventory(['--project=' + project]) for project in projects.values()}
results = {}
for label, jobs in plans.items():
    assert set(jobs['release']['needs']) == {'rules', *projects}, 'Every matrix group must gate publication.'
    for name in ('rules', 'release'):
        assert jobs[name]['steps'][0]['with'] == plans['before'][name]['steps'][0]['with'], 'Retain release history and credential policy.'
    assert jobs['release']['permissions'] == plans['before']['release']['permissions']
    assert jobs['release']['if'] == plans['before']['release']['if']
    rows = []
    for name, project in projects.items():
        job = jobs[name]
        matrix = job.get('strategy', {}).get('matrix', {})
        assert not set(matrix) - {'shard'}, 'Unexpected matrix axis requires explicit review.'
        shards = matrix.get('shard', [None])
        assert len(shards) == len(set(shards))
        if matrix:
            assert job['strategy']['fail-fast'] is False
        commands = [s['run'] for s in job['steps'] if 'run' in s and ('playwright test' in s['run'] or 'npm run test:webkit' in s['run'])]
        assert commands, name
        # Adding shard selection must not alter assertions, retries, workers,
        # project filters, or the separate offline-install command.
        normalize = lambda c: [w for w in command_flags(c.replace('${{ matrix.shard }}', '1')) if not w.startswith('--shard=')]
        old_commands = [s['run'] for s in plans['before'][name]['steps'] if 'run' in s and ('playwright test' in s['run'] or 'npm run test:webkit' in s['run'])]
        assert [normalize(c) for c in commands] == [normalize(c) for c in old_commands]
        observed = []
        pieces = []
        for shard, template in itertools.product(shards, commands):
            command = template.replace('${{ matrix.shard }}', str(shard))
            flags = command_flags(command)
            cases = inventory(flags)
            observed.extend(cases)
            pieces.append({'shard': shard, 'command': command, 'count': len(cases), 'caseKeys': cases})
        assert collections.Counter(observed) == collections.Counter(full[project]), (label, name, 'Missing or duplicate cases')
        assert all(n == 1 for n in collections.Counter(observed).values())
        rows.append({'job': name, 'project': project, 'matrixJobs': len(shards), 'total': len(observed), 'pieces': pieces})
    results[label] = rows

data = {'baseline': baseline, 'root': str(root), 'workflowSHA256': hashlib.sha256(current.encode()).hexdigest(),
        'scope': 'Actual workflow YAML/aliases expanded; exact project/file/line/suite/title inventory from pinned Playwright --list. Declaration coverage, not browser execution. Workers, filters, offline separation and release dependencies checked unchanged apart from shard selection.',
        'totals': {p: len(cases) for p, cases in full.items()}, 'plans': results}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(data, indent=2) + '\n')
print(json.dumps({'output': str(args.output), 'totals': data['totals'], 'beforeJobs': sum(r['matrixJobs'] for r in results['before']) + 1,
                  'afterJobs': sum(r['matrixJobs'] for r in results['after']) + 1, 'missing': 0, 'duplicate': 0}))
