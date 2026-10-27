# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: interface.spec.js >> interface >> a crowded level still renders inside a 60fps budget
- Location: test/browser/interface.spec.js:260:3

# Error details

```
Error: one frame must fit well inside 16.7ms

expect(received).toBeLessThan(expected)

Expected: < 8
Received:   10.327499999850989
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - log [ref=e4]:
    - paragraph [ref=e5]: Cold stone halls stretch into darkness.
    - paragraph [ref=e6]: Welcome, Hale the Fighter. 8 floors lie below. Find the Heart of the Mountain.
    - paragraph [ref=e7]: "Bestiary: Giant Rat added."
    - paragraph [ref=e8]: The Giant Rat misses you from your left.
  - generic [ref=e9]:
    - generic [ref=e10]:
      - generic [ref=e11]:
        - generic [ref=e12]:
          - generic [ref=e13]: Hale
          - generic [ref=e14]: Fighter 1
        - generic [ref=e15]:
          - img "Life 21 of 21" [ref=e16]:
            - generic [ref=e18]: HP 21/21
          - img "Fed" [ref=e19]:
            - generic [ref=e21]: Fed
        - button "Quaff a healing draught (1 carried)" [ref=e22] [cursor=pointer]:
          - img [ref=e24]
          - generic [ref=e26]: Drink ×1
        - generic [ref=e27]:
          - generic [ref=e28]: Floor 1/8
          - generic [ref=e29]: 0 gold
          - generic [ref=e30]: S
      - generic [ref=e31]:
        - 'img "The dungeon. Facing south. Right in front of you: Giant Rat, awake." [ref=e32]'
        - status
        - generic:
          - generic: Floor 1 of 8
          - generic: Grey Halls
        - generic "Open map" [ref=e33]
      - status [ref=e34]: Giant Rat · Drawing back to strike
      - button "Message history" [ref=e35] [cursor=pointer]: ≡ Log
      - generic [ref=e36]:
        - generic [ref=e37]: Welcome, Hale the Fighter. 8 floors lie below. Find the Heart of the Mountain.
        - generic [ref=e38]: The Giant Rat misses you from your left.
    - generic [ref=e39]:
      - generic [ref=e40]:
        - generic [ref=e41]:
          - button "Turn left" [ref=e42] [cursor=pointer]:
            - img [ref=e44]
          - button "Forward" [ref=e47] [cursor=pointer]:
            - img [ref=e49]
          - button "Turn right" [ref=e51] [cursor=pointer]:
            - img [ref=e53]
          - button "Step left" [ref=e56] [cursor=pointer]:
            - img [ref=e58]
          - button "Back" [ref=e60] [cursor=pointer]:
            - img [ref=e62]
          - button "Step right" [ref=e64] [cursor=pointer]:
            - img [ref=e66]
        - generic [ref=e68]:
          - 'button "Attack: ready" [ref=e69] [cursor=pointer]':
            - img [ref=e71]
            - generic [ref=e80]: Attack
            - generic [ref=e81]: Ready
          - button "Use" [ref=e82] [cursor=pointer]:
            - img [ref=e84]
            - generic [ref=e89]: Use
          - 'button "Bash: break the blow in front of you and set it reeling" [ref=e90] [cursor=pointer]':
            - img [ref=e92]
            - generic [ref=e94]: Bash
      - generic [ref=e95]:
        - button "Map" [ref=e96] [cursor=pointer]
        - button "Pack" [ref=e97] [cursor=pointer]
        - button "Hero" [ref=e98] [cursor=pointer]
        - button "Journal" [ref=e99] [cursor=pointer]
        - 'button "Rest: not with foes near" [ref=e100] [cursor=pointer]':
          - text: Rest
          - generic [ref=e101]: foes near
        - button "Menu" [ref=e102] [cursor=pointer]
```

# Test source

```ts
  181 |       L.monsters.push({ uid: 94, id: 'goblin', x: p.x + dx * 3, y: p.y + dy * 3, hp: 500, maxHp: 500, awake: true, spoke: true, nextAct: G.t + 1e9, rx: p.x + dx * 3, ry: p.y + dy * 3, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
  182 |     });
  183 |     await expect(btn).toBeVisible({ timeout: 2000 });
  184 |     await expect(btn).toContainText('Bolt');
  185 |     await btn.click();
  186 |     expect(await page.evaluate(() => Game.player().inv.some(i => i.t === 'scroll_lightning'))).toBe(false);
  187 |     expect(await page.evaluate(() => Game.level().monsters.every(m => m.hp < 500)), 'the bolt went through both').toBe(true);
  188 |     await expect(btn).toBeHidden({ timeout: 2000 });
  189 |     // a bare blade, an emberling coming, and two oils in the pack: the frost is offered first
  190 |     await page.evaluate(() => {
  191 |       const p = Game.player(), L = Game.level(), G = Game.state(), [dx, dy] = Dungeon.DIRS[p.dir];
  192 |       L.monsters.length = 0; p.coating = null;
  193 |       p.inv.push({ t: 'oil_fire', q: 1, e: 0 }, { t: 'oil_frost', q: 1, e: 0 });
  194 |       L.monsters.push({ uid: 95, id: 'emberling', x: p.x + dx * 2, y: p.y + dy * 2, hp: 500, maxHp: 500, awake: true, spoke: true, nextAct: G.t + 1e9, rx: p.x + dx * 2, ry: p.y + dy * 2, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
  195 |     });
  196 |     await expect(btn).toBeVisible({ timeout: 2000 });
  197 |     await expect(btn).toContainText('Coat');
  198 |     await btn.click();
  199 |     await expect(page.locator('#hud-status .coat')).toHaveText('Frost oil \u00d720');
  200 |     expect(errors).toEqual([]);
  201 |   });
  202 |
  203 |   test('a scroll worth reading now is one tap away at the end of the log, and gone when it is not', async ({ page }) => {
  204 |     const errors = watchForErrors(page);
  205 |     await page.addInitScript(() => localStorage.setItem('deepdelve.tipsSeen', JSON.stringify(['controls', 'monster', 'trick'])));
  206 |     await startGame(page, { tips: true, seed: 'quick-scroll' });
  207 |     await clearBoons(page);
  208 |     const btn = page.locator('#quick-scroll');
  209 |     await page.evaluate(() => {
  210 |       const p = Game.player(), G = Game.state();
  211 |       Game.level().monsters.length = 0;
  212 |       p.inv.push({ t: 'scroll_fire', q: 1, e: 0 }); G.known.scroll_fire = 1;
  213 |     });
  214 |     await expect(btn).toBeHidden();
  215 |     await page.evaluate(() => {
  216 |       const p = Game.player(), L = Game.level(), G = Game.state(), [dx, dy] = Dungeon.DIRS[p.dir];
  217 |       for (let i = 1; i <= 2; i++) L.tiles[(p.y + dy * i) * L.w + p.x + dx * i] = Dungeon.T.FLOOR;
  218 |       L.monsters.push({ uid: 93, id: 'goblin', x: p.x + dx * 2, y: p.y + dy * 2, hp: 500, maxHp: 500, awake: true, spoke: true, nextAct: G.t + 1e9, rx: p.x + dx * 2, ry: p.y + dy * 2, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
  219 |     });
  220 |     await expect(btn).toBeVisible({ timeout: 2000 });
  221 |     await expect(btn).toContainText('Fire');
  222 |     // the first time, a tip says where it is
  223 |     await expect(page.locator('#tip')).toContainText('one tap', { timeout: 2000 });
  224 |     const b = await btn.boundingBox();
  225 |     expect(b.width >= 44 && b.height >= 44, 'the button is big enough for a thumb').toBe(true);
  226 |     await btn.click();
  227 |     expect(await page.evaluate(() => Game.player().inv.some(i => i.t === 'scroll_fire'))).toBe(false);
  228 |     // none left: the button goes
  229 |     await expect(btn).toBeHidden({ timeout: 2000 });
  230 |     expect(errors).toEqual([]);
  231 |   });
  232 |
  233 |   test('the text a player reads clears the 4.5:1 contrast minimum', async ({ page }) => {
  234 |     await startGame(page, { seed: 'ui-contrast' });
  235 |     await clearBoons(page);
  236 |     // the dice are set in a dimmer tone than the line they sit on, and they are
  237 |     // the part being read, so make sure there is one on screen to measure
  238 |     await page.evaluate(() => Game.log('You hit the Goblin for 7. (d20 14+5 vs AC 13)'));
  239 |     await page.waitForTimeout(200);
  240 |     const samples = await page.evaluate(() => {
  241 |       const pick = sel => {
  242 |         const el = document.querySelector(sel);
  243 |         if (!el) return null;
  244 |         const cs = getComputedStyle(el);
  245 |         return { sel, color: cs.color, bg: cs.backgroundColor };
  246 |       };
  247 |       return ['#log div', '#log .roll', '.hud-name', '#hud-depth', '.bottombar button', '#hud-gold']
  248 |         .map(pick).filter(Boolean);
  249 |     });
  250 |     expect(samples.length).toBeGreaterThan(3);
  251 |     expect(samples.some(x => x.sel === '#log .roll'), 'no roll on screen to measure').toBe(true);
  252 |     const page_bg = [14, 13, 20];
  253 |     for (const s of samples) {
  254 |       const bg = /, 0\)$/.test(s.bg) || rgb(s.bg).length < 3 ? page_bg : rgb(s.bg);
  255 |       const ratio = contrast(rgb(s.color), bg);
  256 |       expect(ratio, `${s.sel} contrast`).toBeGreaterThanOrEqual(4.5);
  257 |     }
  258 |   });
  259 |
  260 |   test('a crowded level still renders inside a 60fps budget', async ({ page }) => {
  261 |     await startGame(page, { seed: 'ui-perf' });
  262 |     await clearBoons(page);
  263 |     const perf = await page.evaluate(() => {
  264 |       const p = Game.player(), L = Game.level();
  265 |       const seed = L.monsters[0];
  266 |       if (seed) {
  267 |         for (let i = 0; i < 40; i++) {
  268 |           const m = JSON.parse(JSON.stringify(seed));
  269 |           m.uid = 7000 + i;
  270 |           m.x = p.x + (i % 7) - 3; m.y = p.y + ((i / 7) | 0) - 3;
  271 |           m.rx = m.x; m.ry = m.y; m.awake = true;
  272 |           L.monsters.push(m);
  273 |         }
  274 |       }
  275 |       const rs = Game.renderState(performance.now());
  276 |       const t0 = performance.now();
  277 |       for (let i = 0; i < 40; i++) Renderer.render(rs.level, rs.cam, rs.sprites, rs.fx, performance.now());
  278 |       return { monsters: L.monsters.length, ms: (performance.now() - t0) / 40 };
  279 |     });
  280 |     expect(perf.monsters).toBeGreaterThan(30);
> 281 |     expect(perf.ms, 'one frame must fit well inside 16.7ms').toBeLessThan(8);
      |                                                              ^ Error: one frame must fit well inside 16.7ms
  282 |   });
  283 |
  284 |   test('the title screen animates and survives a round trip into a game', async ({ page }) => {
  285 |     const errors = watchForErrors(page);
  286 |     await page.goto('/');
  287 |     await expect(page.locator('#screen-title')).toBeVisible();
  288 |
  289 |     // the key art drifts and embers rise through it, so successive frames must differ
  290 |     const frames = await page.evaluate(async () => {
  291 |       const c = document.querySelector('#title-art');
  292 |       const g = c.getContext('2d');
  293 |       const seen = [];
  294 |       for (let i = 0; i < 4; i++) {
  295 |         const d = g.getImageData(40, 40, 60, 60).data;
  296 |         let h = 0;
  297 |         for (let k = 0; k < d.length; k += 97) h = (h * 31 + d[k]) >>> 0;
  298 |         seen.push(h);
  299 |         await new Promise(r => setTimeout(r, 320));
  300 |       }
  301 |       return new Set(seen).size;
  302 |     });
  303 |     expect(frames, 'the title should be moving').toBeGreaterThan(1);
  304 |
  305 |     await startGame(page, { seed: 'ui-title' });
  306 |     await clearBoons(page);
  307 |     await page.click('[data-open="menu"]');
  308 |     await page.click('#m-quit');
  309 |     await expect(page.locator('#screen-title')).toBeVisible();
  310 |     await expect(page.locator('#save-summary')).toContainText(/level/i);
  311 |     expect(errors).toEqual([]);
  312 |   });
  313 |
  314 |   test('the message panel keeps scrolling after the log fills up', async ({ page }) => {
  315 |     const errors = watchForErrors(page);
  316 |     await startGame(page, { seed: 'log-cap' });
  317 |     await clearBoons(page);
  318 |
  319 |     // the log is capped at 80 entries, so push well past that: a panel that
  320 |     // watches the array's length instead of counting messages freezes here
  321 |     const read = () => page.locator('#log').innerText();
  322 |     await page.evaluate(() => { for (let i = 1; i <= 120; i++) Game.log(`filler ${i}`); });
  323 |     await page.waitForTimeout(150);
  324 |     const full = await read();
  325 |     expect(full, 'the newest message should be on screen').toContain('filler 120');
  326 |
  327 |     await page.evaluate(() => Game.log('the message after the cap'));
  328 |     await page.waitForTimeout(150);
  329 |     const after = await read();
  330 |     expect(after, 'a message written past the cap must still appear')
  331 |       .toContain('the message after the cap');
  332 |     expect(after, 'the panel should have moved on').not.toBe(full);
  333 |
  334 |     // and the capped array itself is still doing its job
  335 |     const size = await page.evaluate(() => Game.state().log.length);
  336 |     expect(size, 'the log should stay capped').toBeLessThanOrEqual(80);
  337 |     // one message taller than the panel shows from its start, not its middle
  338 |     await page.evaluate(() => Game.log('BEGINNING of a very long message. ' + 'It goes on and on, far longer than the panel is tall, as a shade\'s arrival does. '.repeat(6) + 'END'));
  339 |     await expect.poll(() => page.evaluate(() => {
  340 |       const el = document.querySelector('#log'), first = el.firstElementChild;
  341 |       return first && first.textContent.startsWith('BEGINNING') && first.getBoundingClientRect().top >= el.getBoundingClientRect().top;
  342 |     })).toBe(true);
  343 |     expect(errors).toEqual([]);
  344 |   });
  345 |
  346 |   for (const [label, vp] of Object.entries({
  347 |     'small phone': { width: 360, height: 640 },
  348 |     'iPhone SE': { width: 375, height: 667 },
  349 |     'tall phone': { width: 393, height: 851 },
  350 |     'landscape phone': { width: 844, height: 390 },
  351 |     'small landscape': { width: 740, height: 360 },
  352 |     desktop: { width: 1280, height: 800 },
  353 |   })) {
  354 |     test(`every control can be reached on a ${label}`, async ({ page }) => {
  355 |       // A landscape phone once had Cast below the bottom edge: a spellcaster
  356 |       // playing sideways could not cast at all, and nothing noticed.
  357 |       const errors = watchForErrors(page);
  358 |       await page.setViewportSize(vp);
  359 |       await startGame(page, { seed: 'reach' });
  360 |       await clearBoons(page);
  361 |       await page.waitForTimeout(250);
  362 |       const out = await page.evaluate(() => [...document.querySelectorAll('#screen-game .ctl, #screen-game .bottombar button')]
  363 |         // a button this hero has no use for (Spells, for a fighter) is not shown at all
  364 |         .filter(b => getComputedStyle(b).display !== 'none')
  365 |         .filter(b => { const r = b.getBoundingClientRect(); return r.bottom > innerHeight + 1 || r.right > innerWidth + 1 || r.top < -1 || r.height < 30; })
  366 |         .map(b => b.getAttribute('aria-label') || b.textContent.trim()));
  367 |       expect(out, 'controls off screen or too small to press').toEqual([]);
  368 |       expect(errors).toEqual([]);
  369 |     });
  370 |   }
  371 |
  372 |   test('a phone held sideways puts the view beside the controls, filled and with nothing off the edge', async ({ page }) => {
  373 |     // Sideways the view was a short 16:10 picture with black bars down both
  374 |     // sides, and the seven buttons of the bottom bar were each under 44px wide.
  375 |     const errors = watchForErrors(page);
  376 |     await page.setViewportSize({ width: 851, height: 393 });
  377 |     await startGame(page, { seed: 'sideways', cls: 'Mage' });
  378 |     await clearBoons(page);
  379 |     await page.waitForTimeout(250);
  380 |     const v = await page.evaluate(() => {
  381 |       const c = document.getElementById('view'), box = c.parentElement.getBoundingClientRect();
```
