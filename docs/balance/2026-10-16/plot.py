#!/usr/bin/env python3
"""Rebuild balance.svg from summary.json (requires matplotlib)."""
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

root = Path(__file__).resolve().parent
summary = json.loads((root / 'summary.json').read_text())
classes = ['cleric', 'fighter', 'mage', 'thief', 'ranger', 'druid']
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 11,
                     'svg.hashsalt': summary['datasetOutcomeSha256']})
fig, ax = plt.subplots(figsize=(9.2, 5.2))
fig.set_facecolor('white')
for difficulty, colour, offset in [('normal', '#2563a6', -.13), ('hard', '#bd5b18', .13)]:
    records = [summary['difficulty'][difficulty]['classes'][cls] for cls in classes]
    rates = [r['winRate'] * 100 for r in records]
    lower = [(r['winRate'] - r['seedCluster95'][0]) * 100 for r in records]
    upper = [(r['seedCluster95'][1] - r['winRate']) * 100 for r in records]
    ax.errorbar(rates, [i + offset for i in range(len(classes))],
                xerr=[lower, upper], fmt='o', color=colour, markersize=6,
                capsize=3, linewidth=1.6, label=difficulty.title())
ax.set_yticks(range(len(classes)), [c.title() for c in classes])
ax.invert_yaxis()
ax.set_xlim(40, 100)
ax.set_xticks(range(40, 101, 10))
ax.set_xlabel('Bot win rate (%)')
ax.set_axisbelow(True)
ax.grid(axis='x', color='#dddddd', linewidth=.7)
for edge in ['top', 'right', 'left']:
    ax.spines[edge].set_visible(False)
ax.spines['bottom'].set_color('#888888')
ax.tick_params(axis='y', length=0)
ax.legend(frameon=False, loc='upper right')
fig.suptitle('Deepdelve: eight-floor balance audit', x=.13, ha='left',
             fontsize=17, fontweight='bold')
fig.text(.13, .88, '16 October 2026 · 1,200 runs per class and difficulty · 14,400 runs total',
         color='#444444', fontsize=10)
fig.text(.13, .035, 'Whiskers: 95% intervals resampled by dungeon seed within each of three seed sets.\n'
         'Frozen game revision 143d6b5 (Build 3). These are bot outcomes, not player win rates.',
         color='#555555', fontsize=9)
fig.subplots_adjust(left=.13, right=.97, top=.82, bottom=.2)
fig.savefig(root / 'balance.svg', metadata={'Date': None})
# Matplotlib pads path lines; trim those spaces in the generated text.
svg = root / 'balance.svg'
svg.write_text('\n'.join(line.rstrip() for line in svg.read_text().splitlines()) + '\n')
plt.close(fig)
