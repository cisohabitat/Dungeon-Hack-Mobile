#!/usr/bin/env python3
"""Summarise retained raw outcomes; fingerprint comparisons fail closed."""
import collections
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def summary(path):
    data = json.loads(path.read_text())
    rows = [r for values in data['results'].values() for r in values]
    expected = len(data['seeds']) * data['trialsPerSeed'] * len(data['results'])
    assert len(rows) == expected, path.name
    errors = [r for r in rows if 'ERROR' in r.get('cause', '')]
    timeouts = [r for r in rows if r.get('timedOut')]
    assert not errors and not timeouts, (path.name, errors, timeouts)
    casts = collections.Counter()
    for r in rows:
        casts.update(r.get('casts', {}))
    return {
        'runs': len(rows), 'wins': sum(r['won'] for r in rows),
        'winPercent': round(100 * sum(r['won'] for r in rows) / len(rows), 2),
        'meanDepth': round(sum(r['deepest'] for r in rows) / len(rows), 2),
        'earlyDeaths': sum(r['died'] and r['level'] < 5 for r in rows),
        'meanPotionsAttempted': round(sum(r['potionsDrunk'] for r in rows) / len(rows), 2),
        'meanPotionsRemaining': round(sum(r['potsAtEnd'] for r in rows) / len(rows), 2),
        'meanCashRemaining': round(sum(r['goldFound'] for r in rows) / len(rows), 2),
        'deaths': dict(collections.Counter(r['cause'] for r in rows if r['died'])),
        'casts': dict(casts), 'errors': len(errors), 'timeouts': len(timeouts)
    }

def fingerprints(stem):
    return [line for line in (ROOT / (stem + '.log')).read_text().splitlines()
            if line.startswith('FP ')]

out = {p.stem: summary(p) for p in sorted(ROOT.glob('*.json')) if p.name not in ['summary.json', 'scheduling.json']}
comparisons = {}
for before, after, label, expected in [
    ('baseline-public', 'working-public', 'public', 36),
    ('prototype-8', 'final-8', 'eightFloorCompatibility', 20)
]:
    count = 0
    for seed in ['bench', 'alt', 'third']:
        for diff in ['normal', 'hard']:
            a, b = f'{before}-{diff}-{seed}', f'{after}-{diff}-{seed}'
            if a not in out or b not in out:
                continue
            left, right = fingerprints(a), fingerprints(b)
            assert len(left) == expected and left == right, (a, b, len(left), len(right))
            count += len(left)
    comparisons[label] = {'identicalFinalStatesAndLogs': count}
print(json.dumps({'cells': out, 'comparisons': comparisons}, indent=2))
