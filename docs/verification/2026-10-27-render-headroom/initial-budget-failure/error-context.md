# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: perf.spec.js >> the view holds its frame rate on a slow processor
- Location: test/browser/perf.spec.js:53:1

# Error details

```
Error: painted: {"fps":28.9,"scriptMs":21.3}

expect(received).toBeGreaterThanOrEqual(expected)

Expected: >= 30
Received:    28.9
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - log [ref=e4]:
    - paragraph [ref=e5]: Cold stone halls stretch into darkness.
    - paragraph [ref=e6]: Welcome, Doran the Fighter. 8 floors lie below. Find the Heart of the Mountain.
  - generic [ref=e7]:
    - generic [ref=e8]:
      - generic [ref=e9]:
        - generic [ref=e10]:
          - generic [ref=e11]: Doran
          - generic [ref=e12]: Fighter 1
        - generic [ref=e13]:
          - img "Life 19 of 19" [ref=e14]:
            - generic [ref=e16]: HP 19/19
          - img "Fed" [ref=e17]:
            - generic [ref=e19]: Fed
        - button "Quaff a healing draught (1 carried)" [ref=e20] [cursor=pointer]:
          - img [ref=e22]
          - generic [ref=e24]: Drink ×1
        - generic [ref=e25]:
          - generic [ref=e26]: Floor 1/8
          - generic [ref=e27]: 0 gold
          - generic [ref=e28]: E
      - generic [ref=e29]:
        - generic [ref=e30]:
          - paragraph [ref=e31]: Cold stone halls stretch into darkness.
          - button "Pause narration" [ref=e32] [cursor=pointer]: Pause
          - button "Skip narration" [ref=e33] [cursor=pointer]: Skip
        - img "The dungeon. Facing east. Open floor, then a wall four squares ahead." [ref=e34]
        - status
        - generic:
          - generic: Floor 1 of 8
          - generic: Grey Halls
        - generic "Open map" [ref=e35]
      - button "Message history" [ref=e36] [cursor=pointer]: ≡ Log
      - generic [ref=e37]:
        - generic [ref=e38]: Cold stone halls stretch into darkness.
        - generic [ref=e39]: Welcome, Doran the Fighter. 8 floors lie below. Find the Heart of the Mountain.
    - generic [ref=e40]:
      - generic [ref=e41]:
        - generic [ref=e42]:
          - button "Turn left" [ref=e43] [cursor=pointer]:
            - img [ref=e45]
          - button "Forward" [ref=e48] [cursor=pointer]:
            - img [ref=e50]
          - button "Turn right" [ref=e52] [cursor=pointer]:
            - img [ref=e54]
          - button "Step left" [ref=e57] [cursor=pointer]:
            - img [ref=e59]
          - button "Back" [ref=e61] [cursor=pointer]:
            - img [ref=e63]
          - button "Step right" [ref=e65] [cursor=pointer]:
            - img [ref=e67]
        - generic [ref=e69]:
          - 'button "Attack: ready" [ref=e70] [cursor=pointer]':
            - img [ref=e72]
            - generic [ref=e81]: Attack
            - generic [ref=e82]: Ready
          - button "Use" [ref=e83] [cursor=pointer]:
            - img [ref=e85]
            - generic [ref=e90]: Use
          - 'button "Bash: break the blow in front of you and set it reeling" [ref=e91] [cursor=pointer]':
            - img [ref=e93]
            - generic [ref=e95]: Bash
      - generic [ref=e96]:
        - button "Map" [ref=e97] [cursor=pointer]
        - button "Pack" [ref=e98] [cursor=pointer]
        - button "Hero" [ref=e99] [cursor=pointer]
        - button "Journal" [ref=e100] [cursor=pointer]
        - 'button "Rest: recover up to two thirds of maximum life and spell points. Costs food; danger may interrupt." [ref=e101] [cursor=pointer]':
          - text: Rest
          - generic [ref=e102]: +⅔ life
        - button "Menu" [ref=e103] [cursor=pointer]
```

# Test source

```ts
  45  |   }), ms);
  46  |   const s1 = await script();
  47  |   return { fps: Math.round(frames.n / frames.secs * 10) / 10, scriptMs: Math.round((s1 - s0) / frames.n * 10) / 10 };
  48  | }
  49  |
  50  | /** Wait for what is painted in spare moments (a close-up of a creature come near) to be done. */
  51  | const settled = page => page.waitForFunction(() => Assets.painting() === 0, null, { timeout: 90_000, polling: 250 });
  52  |
  53  | test('the view holds its frame rate on a slow processor', async ({ page }) => {
  54  |   test.skip(process.env.PERF !== '1', 'the frame-rate budget runs alone: PERF=1 --project=perf --workers=1');
  55  |   test.setTimeout(240_000);
  56  |   await startGame(page, { seed: 'perf-budget' });
  57  |   await clearBoons(page);
  58  |   await page.waitForFunction(() => Assets.painting() === 0, null, { timeout: 120_000, polling: 250 });
  59  |   // the hero cannot die, and the monsters wake at once
  60  |   await page.evaluate(() => { Game.setTesting({ hp: true }); Game.testFloor(7); });
  61  |   await faceOpenGround(page);
  62  |   await page.evaluate(() => {
  63  |     const p = Game.player(), L = Game.level(), T = Dungeon.T;
  64  |     let k = 0;
  65  |     for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
  66  |       const x = p.x + dx, y = p.y + dy;
  67  |       if ((dx || dy) && k < 8 && L.tiles[y * L.w + x] === T.FLOOR && !L.monsters.some(m => m.x === x && m.y === y)) {
  68  |         L.monsters.push({ uid: 95000 + k++, id: 'orc', x, y, hp: 999, maxHp: 999, awake: true, nextAct: 0, rx: x, ry: y, fromX: x, fromY: y, moveT0: 0, moveT1: 0, flashUntil: 0 });
  69  |       }
  70  |     }
  71  |   });
  72  |   const cdp = await page.context().newCDPSession(page);
  73  |   await cdp.send('Performance.enable');
  74  |   await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
  75  |   const out = {};
  76  |   // the first seconds of a fight paint the orcs finely as they come near, a
  77  |   // piece at a time in spare moments: once, and not what the budget is for
  78  |   await measure(page, cdp, 3000);
  79  |   await settled(page);
  80  |   out.fight = await measure(page, cdp, 4000);
  81  |   // the same fight on a wide screen (a laptop, a tablet on its side): the map docked beside the view
  82  |   const phone = page.viewportSize();
  83  |   await page.setViewportSize({ width: 1280, height: 800 });
  84  |   await measure(page, cdp, 1000);
  85  |   out.wide = await measure(page, cdp, 4000);
  86  |   await page.setViewportSize(phone);
  87  |   await measure(page, cdp, 500);
  88  |   // the same floor flooded: water over every floor square
  89  |   await page.evaluate(() => { Game.level().twist = 'flooded'; });
  90  |   await measure(page, cdp, 1000);
  91  |   out.flooded = await measure(page, cdp, 4000);
  92  |   // The same crowd using painted poses: their cached shades must hold the
  93  |   // existing budget too, including ordinary combat motion and warning marks.
  94  |   await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  95  |   await page.evaluate(() => {
  96  |     Game.level().twist = null;
  97  |     const kinds=['drow_warrior','hound','wyrm','skarrow','troll','minotaur','archer','moth'];
  98  |     let i=0;for (const m of Game.level().monsters) if (m.id === 'orc') m.id = kinds[i++%kinds.length];
  99  |   });
  100 |   await page.evaluate(async()=>{window.__paintedCreature=(await import('/js/paintedcreatures.js')).paintedCreature;});
  101 |   await page.waitForFunction(() => {
  102 |     const paintedCreature = window.__paintedCreature;
  103 |     return ['drow_warrior','hound','wyrm','skarrow','troll','minotaur','archer','moth'].map(k=>k==='skarrow'?Assets.sprites.wyrm.elite.skarrow:Assets.sprites[k]).map(art=>art&&paintedCreature(art)!==art).every(Boolean);
  104 |   });
  105 |   await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
  106 |   await measure(page, cdp, 3000);
  107 |   out.painted = await measure(page, cdp, 4000);
  108 |   // the last floor, the lich awake two squares ahead and working its rite
  109 |   await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  110 |   await page.evaluate(() => { Game.level().twist = null; Game.testFloor(Game.state().opts.levels || 8); });
  111 |   await faceOpenGround(page);
  112 |   await page.evaluate(() => {
  113 |     const L = Game.level(), lich = L.monsters.find(m => m.id === 'lich'), p = Game.player(), D = Dungeon.DIRS[p.dir];
  114 |     if (!lich) return;
  115 |     lich.awake = true; lich.spoke = true;
  116 |     lich.x = p.x + D[0] * 2; lich.y = p.y + D[1] * 2; lich.rx = lich.x; lich.ry = lich.y;
  117 |     lich.windup = { move: 'rite', at: Game.state().t, until: Game.state().t + 1e9 };
  118 |   });
  119 |   await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
  120 |   await measure(page, cdp, 3000);
  121 |   await settled(page);
  122 |   out.rite = await measure(page, cdp, 4000);
  123 |   await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  124 |   // a new run's opening, slowed the same: from Begin on the prologue to the dungeon's first frame
  125 |   // (the pictures painted in spare moments are done by now; it is the floor's making and the first
  126 |   // paint of the view that this measures)
  127 |   // (the hero above cannot die, and a page left mid-run saves the run on its way out: the save
  128 |   // is taken away once the title is up, and the title opened again without it)
  129 |   await page.goto('/');
  130 |   await page.evaluate(() => localStorage.removeItem('deepdelve.save'));
  131 |   await page.goto('/');
  132 |   await page.click('#btn-new'); await customiseCreation(page);
  133 |   await page.fill('#c-seed', 'perf-start');
  134 |   await page.click('#c-begin');
  135 |   await expect(page.locator('#screen-prologue')).toBeVisible();
  136 |   await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
  137 |   const t0 = Date.now();
  138 |   await page.click('#pro-begin');
  139 |   await expect(page.locator('#screen-game')).toBeVisible();
  140 |   await page.evaluate(() => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res))));
  141 |   const start = { ms: Date.now() - t0 };
  142 |   await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  143 |   console.log(`frame budget at ${RATE}x slower (need ${MIN_FPS} fps):`, JSON.stringify(out), 'start', JSON.stringify(start));
  144 |   if (REPORT_ONLY) return;
> 145 |   for (const [scene, m] of Object.entries(out)) expect(m.fps, `${scene}: ${JSON.stringify(m)}`).toBeGreaterThanOrEqual(scene === 'wide' ? MIN_FPS_WIDE : MIN_FPS);
      |                                                                                                 ^ Error: painted: {"fps":28.9,"scriptMs":21.3}
  146 |   expect(start.ms, `a run opens within ${MAX_START_MS} ms of Begin`).toBeLessThanOrEqual(MAX_START_MS);
  147 | });
  148 |
```
