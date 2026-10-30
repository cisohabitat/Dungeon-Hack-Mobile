"""Prove the real before/after CI commands select each Chromium case once."""
import collections, json, pathlib, shlex, subprocess
ROOT = pathlib.Path(__file__).resolve().parents[3]
BASE = '0f79e40e3a5687da46b0696a05de8df847535841'
def git(path):
    return subprocess.check_output(['git', 'show', BASE + ':' + path], cwd=ROOT, text=True)
def commands(text, project, shard):
    lines = [line.strip()[7:] for line in text.splitlines() if line.strip().startswith('- run: sh tools/run-browser-ci.sh ' + project + '-')]
    assert len(lines) == 2
    return [shlex.split(line.replace('${{ matrix.shard }}', str(shard)))[3:] for line in lines]
def discovery(args):
    data = json.loads(subprocess.check_output(['node', 'node_modules/@playwright/test/cli.js', 'test', *args, '--list', '--reporter=json'], cwd=ROOT, text=True))
    assert not data['errors']
    rows = []
    def walk(suites, parents=()):
        for suite in suites:
            parent = (*parents, suite['title'])
            for spec in suite.get('specs', []):
                for test in spec['tests']:
                    rows.append((test['projectName'], spec['file'], *parent, spec['title']))
            walk(suite.get('suites', []), parent)
    walk(data['suites'])
    return rows
before = git('.github/workflows/test.yml')
after = (ROOT / '.github/workflows/test.yml').read_text()
assert git('playwright.config.js') == (ROOT / 'playwright.config.js').read_text()
proof = {'baseline': BASE, 'policiesUnchanged': True, 'projects': {}}
for project, shards in [('phone', 3), ('small', 2)]:
    inventories = {}
    for label, source in [('before', before), ('after', after)]:
        rows = []
        for shard in range(1, shards + 1):
            for args in commands(source, project, shard):
                rows.extend(discovery(args))
        assert len(rows) == len(set(rows)), (project, label, 'duplicated case')
        inventories[label] = set(rows)
    assert inventories['before'] == inventories['after'], project
    proof['projects'][project] = {'cases': len(inventories['after']), 'identical': True, 'duplicates': 0}
# WebKit and the isolated performance command stay byte-identical.
for prefix in ['safari ', 'perf ']:
    selected = lambda text: [line for line in text.splitlines() if '- run: sh tools/run-browser-ci.sh ' + prefix in line]
    assert selected(before) == selected(after)
proof['webkitAndPerfCommandsUnchanged'] = True
(ROOT / 'docs/verification/2026-10-30-ci-reliability/coverage.json').write_text(json.dumps(proof, indent=2) + '\n')
print(json.dumps(proof, indent=2))
