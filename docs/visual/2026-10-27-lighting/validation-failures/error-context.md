# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: art.spec.js >> art >> pictures the title does not need wait to be painted, arrive whole when asked for, and are all painted soon after
- Location: test/browser/art.spec.js:8:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 0
Received: 26

Call Log:
- Timeout 25000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e8]:
    - generic [ref=e9]:
      - generic [ref=e11]: ✦
      - heading "DEEPDELVE" [level=1] [ref=e12]
      - paragraph [ref=e13]: Descend. Survive. Claim the Heart of the Mountain.
    - generic [ref=e14]:
      - paragraph [ref=e15]: First time here?
      - list [ref=e16]:
        - listitem [ref=e17]: "Go down. The Heart of the Mountain lies at the bottom: bring down what keeps it."
        - listitem [ref=e18]: Move with the pad or a swipe; tap the view to use a door, the stairs, a trader.
        - listitem [ref=e19]: "A mark over a monster means a blow is coming: step out of its way, or strike first."
      - generic [ref=e20]:
        - button "Start a ready hero" [ref=e21] [cursor=pointer]
        - button "Got it" [ref=e22] [cursor=pointer]
    - generic [ref=e23]:
      - button "New Game Roll a hero and pick a seed" [ref=e24] [cursor=pointer]:
        - generic [ref=e25]: New Game
        - generic [ref=e26]: Roll a hero and pick a seed
      - generic [ref=e27]:
        - button "Quick Start A random hero, straight in" [ref=e28] [cursor=pointer]:
          - generic [ref=e29]: Quick Start
          - generic [ref=e30]: A random hero, straight in
        - button "Daily Delve Today's dungeon, one try" [ref=e32] [cursor=pointer]:
          - generic [ref=e33]: Daily Delve
          - generic [ref=e34]: Today's dungeon, one try
      - generic [ref=e35]:
        - button "Hall of Heroes" [ref=e36] [cursor=pointer]
        - button "Bestiary" [ref=e37] [cursor=pointer]
        - button "Companions" [ref=e38] [cursor=pointer]
        - button "How to Play" [ref=e39] [cursor=pointer]
      - 'button "Weekly Challenge This week: Pauper''s Vow and Unaided Vow, a large delve, many monsters, scarce treasure" [ref=e41] [cursor=pointer]':
        - generic [ref=e42]: Weekly Challenge
        - generic [ref=e43]: "This week: Pauper's Vow and Unaided Vow, a large delve, many monsters, scarce treasure"
      - paragraph [ref=e44]:
        - button "Load a hero from a code" [ref=e45] [cursor=pointer]
  - button "Release and commit" [ref=e46] [cursor=pointer]: Release 0.9.48 · Commit d1eba99
```

# Test source

```ts
  1   | 'use strict';
  2   | // What the view draws: walls that match what the floor says of them, the
  3   | // weapon in the hero's hands, and a monster right in front of them.
  4   | const { test } = require('@playwright/test');
  5   | const { watchForErrors, startGame, clearBoons, faceOpenGround, placeMonster, killMonster, artReady, expect } = require('./helpers');
  6   |
  7   | test.describe('art', () => {
  8   |   test('pictures the title does not need wait to be painted, arrive whole when asked for, and are all painted soon after', async ({ page }) => {
  9   |     const errors = watchForErrors(page);
  10  |     await page.goto('/');
  11  |     await page.waitForSelector('#btn-new', { state: 'visible' });
  12  |     const waiting = () => page.evaluate(() => Object.keys(Assets.sprites).filter(k => typeof Object.getOwnPropertyDescriptor(Assets.sprites, k).get === 'function'));
  13  |     // the title keeps its start quick: the pack's pictures are not among what it painted
  14  |     const first = await waiting();
  15  |     expect(first.length, 'some pictures should still be waiting at the title').toBeGreaterThan(20);
  16  |     // one asked for early is painted there and then, whole
  17  |     const one = first.find(k => /sword/.test(k)) || first[0];
  18  |     const got = await page.evaluate(k => { const s = Assets.sprites[k]; return { w: s.w, h: s.h, url: typeof s.url === 'string' && s.url.length > 30, painted: typeof Object.getOwnPropertyDescriptor(Assets.sprites, k).get !== 'function' }; }, one);
  19  |     expect(got.w).toBeGreaterThan(0);
  20  |     expect(got).toMatchObject({ url: true, painted: true });
  21  |     // and the rest are painted in the time to spare, well before a first floor
  22  |     // (a creature a piece at a time, so frames stay smooth, takes a few seconds longer in all)
> 23  |     await expect.poll(async () => (await waiting()).length, { timeout: 25_000 }).toBe(0);
      |     ^ Error: expect(received).toBe(expected) // Object.is equality
  24  |     expect(errors).toEqual([]);
  25  |   });
  26  |
  27  |   test('a creature is painted a piece at a time, a floor\'s own kinds first, and drawn plain until its poses are ready', async ({ page }) => {
  28  |     test.setTimeout(120_000);
  29  |     const errors = watchForErrors(page);
  30  |     // slowed, so the painting is still under way while it is looked at
  31  |     const cdp = await page.context().newCDPSession(page);
  32  |     await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  33  |     await page.goto('/');
  34  |     await page.waitForSelector('#btn-new', { state: 'visible' });
  35  |     const painted = k => page.evaluate(k => typeof Object.getOwnPropertyDescriptor(Assets.sprites, k).get !== 'function', k);
  36  |     expect(await painted('wyrm'), 'the wyrm is among the last kinds in the queue').toBe(false);
  37  |     // asked for, its own picture comes at once, and its poses wait at the head of the queue
  38  |     const asked = await page.evaluate(() => { const s = Assets.sprites.wyrm, n = Assets.painting(); return { w: s.w, windup: !!s.windup, waiting: n }; });
  39  |     expect(asked.w).toBeGreaterThan(0);
  40  |     expect(asked.windup, 'a pose is its own piece, painted later').toBe(false);
  41  |     expect(asked.waiting).toBeGreaterThan(20);
  42  |     await expect.poll(() => page.evaluate(() => { const s = Assets.sprites.wyrm; return !!(s.windup && s.stepA && s.stepB && s.hurt); }), { timeout: 40_000 }).toBe(true);
  43  |     expect(await page.evaluate(() => Assets.painting()), 'the poses came before the rest').toBeGreaterThan(10);
  44  |     // a floor's kinds go to the head of what waits (behind the pieces of any creature already begun)
  45  |     expect(await painted('basilisk')).toBe(false);
  46  |     await page.evaluate(() => Assets.paintFirst(['basilisk']));
  47  |     await expect.poll(() => painted('basilisk'), { timeout: 40_000 }).toBe(true);
  48  |     expect(await page.evaluate(() => Assets.painting())).toBeGreaterThan(10);
  49  |     await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  50  |     expect(errors).toEqual([]);
  51  |   });
  52  |
  53  |   test('an elite colour keeps its cached picture, shades and pose links when first shown', async ({ page }) => {
  54  |     const errors = watchForErrors(page);
  55  |     await page.goto('/');
  56  |     await page.waitForSelector('#btn-new', { state: 'visible' });
  57  |     const shown = await page.evaluate(() => {
  58  |       const base = Assets.sprites.orc, elite = base.elite.Feral;
  59  |       // Exercise picture-first access as in the bestiary, then the view's
  60  |       // shaded canvases; repeated requests must keep the same cached objects.
  61  |       const url = elite.url, levels = elite.levels;
  62  |       const brightness = c => { const p = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let sum = 0; for (let i = 0; i < p.length; i += 4) sum += p[i] + p[i + 1] + p[i + 2]; return sum; };
  63  |       return { url: url.startsWith('data:image/png'), cached: elite.url === url && elite.levels === levels && base.elite.Feral === elite,
  64  |         sizes: levels.every(c => c.width === elite.w && c.height === elite.h), count: levels.length,
  65  |         darker: brightness(levels[levels.length - 1]) < brightness(levels[0]), flash: elite.flash === base.flash };
  66  |     });
  67  |     expect(shown).toEqual({ url: true, cached: true, sizes: true, count: 5, darker: true, flash: true });
  68  |     await expect.poll(() => page.evaluate(() => !!Assets.sprites.orc.windup), { timeout: 40000 }).toBe(true);
  69  |     expect(await page.evaluate(() => {
  70  |       const base = Assets.sprites.orc, own = base.elite.Feral, pose = base.windup.elite.Feral;
  71  |       const levels = pose.levels;
  72  |       return own.windup === pose && pose.levels === levels && levels.length === own.levels.length && pose.url.startsWith('data:image/png');
  73  |     })).toBe(true);
  74  |     expect(errors).toEqual([]);
  75  |   });
  76  |
  77  |   test('a struck monster is drawn reeling, and a named champion as itself, not its kind in another colour', async ({ page }) => {
  78  |     const errors = watchForErrors(page);
  79  |     await startGame(page);
  80  |     await artReady(page);
  81  |     await faceOpenGround(page);
  82  |     expect(await placeMonster(page, 'orc', 2, { hp: 300, maxHp: 300 })).not.toBeNull();
  83  |     // struck just now: the view is handed its flinching picture
  84  |     const drawn = await page.evaluate(() => {
  85  |       const m = Game.level().monsters.find(q => q.maxHp === 300), now = performance.now();
  86  |       m.flashAt = now; m.flashUntil = now + 130;
  87  |       const s = Game.renderState(now + 60).sprites.find(q => q.maxHp === 300);
  88  |       const later = Game.renderState(now + 900).sprites.find(q => q.maxHp === 300);
  89  |       return { reeling: s.img === Assets.sprites.orc.hurt, after: later.img === Assets.sprites.orc };
  90  |     });
  91  |     expect(drawn).toEqual({ reeling: true, after: true });
  92  |     // each champion has a picture of its own, poses and all; a wash of its kind
  93  |     // covers the same pixels, its own picture does not
  94  |     const champs = await page.evaluate(() => Object.keys(MONSTERS).filter(id => MONSTERS[id].named).map(id => {
  95  |       const kind = Assets.sprites[MONSTERS[id].sprite], own = kind.elite[id];
  96  |       const opaque = c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; };
  97  |       return { id, own: !!own && opaque(own.levels[0]) !== opaque(kind.levels[0]), poses: !!own && !!own.windup && !!own.hurt && kind.windup.elite[id] === own.windup };
  98  |     }));
  99  |     expect(champs.length).toBeGreaterThanOrEqual(7);
  100 |     for (const c of champs) expect(c, c.id).toEqual({ id: c.id, own: true, poses: true });
  101 |     expect(errors).toEqual([]);
  102 |   });
  103 |
  104 |   test('what is upon a monster is drawn on it, and each kind dies its own way', async ({ page }) => {
  105 |     const errors = watchForErrors(page);
  106 |     await startGame(page);
  107 |     await artReady(page);
  108 |     await faceOpenGround(page);
  109 |     // burning, it is drawn burning; when the fire is out, it is not
  110 |     expect(await placeMonster(page, 'orc', 2, { hp: 300, maxHp: 300 })).not.toBeNull();
  111 |     await page.evaluate(() => { const m = Game.level().monsters.find(q => q.maxHp === 300); m.dot = { kind: 'burning', until: Game.state().t + 1e7, next: 1e12 }; });
  112 |     await expect.poll(() => page.evaluate(() => Renderer.afflicted), { timeout: 3000 }).toBeGreaterThan(0);
  113 |     await page.evaluate(() => { Game.level().monsters.find(q => q.maxHp === 300).dot = null; });
  114 |     await expect.poll(() => page.evaluate(() => Renderer.afflicted), { timeout: 3000 }).toBe(0);
  115 |     await page.evaluate(() => { Game.level().monsters.length = 0; Game.player().xp = -1e7; });
  116 |     // a wraith cut down rises thin into mist; a slime bursts out flat
  117 |     for (const [id, check] of [['wraith', 'mist'], ['slime', 'splat']]) {
  118 |       // the last one's body gone first: on a slow machine the wraith's mist was still
  119 |       // thinning when the slime fell, and was the body found
  120 |       await expect.poll(() => page.evaluate(() => Game.renderState(performance.now()).sprites.some(q => q.death)), { timeout: 15_000 }).toBe(false);
  121 |       const uid = await placeMonster(page, id, 1, { hp: 1, maxHp: 30 });
  122 |       expect(uid).not.toBeNull();
  123 |       const m = await page.evaluate(id => Game.level().monsters.find(q => q.id === id).uid, id);
```
