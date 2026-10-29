'use strict';
const { test, expect } = require('@playwright/test');
const { startGame, faceOpenGround, placeMonster, artReady, watchForErrors } = require('./helpers');

// Supplied threats/resources isolate layout. Native frames, condition clocks,
// controls and overlays keep running; these are not unassisted combat outcomes.
for (const textSize of ['3','4']) for (const hand of ['right', 'left']) test(`${textSize==='3'?'Larger':'Double'} text ${hand}-handed combat keeps messages and quick actions clear of the controls @mobile`, async ({ page }, info) => {
  const errors = watchForErrors(page);
  await page.addInitScript(({hand,textSize}) => {
    localStorage.setItem('deepdelve.hand', hand);
    for (const [k, v] of Object.entries({ textSize, calm: '1', sound: 'off', samples: 'off', prelude: 'off' })) localStorage.setItem('deepdelve.' + k, v);
  }, {hand,textSize});
  await startGame(page, { seed: 'combat-clarity', name: 'Keeper approach', levels: '12' });
  await page.evaluate(() => { Game.testFloor(12, 'crypts'); Game.level().monsters = []; });
  expect(await faceOpenGround(page, 3)).toBeGreaterThanOrEqual(3);
  await placeMonster(page, 'heartforged', 2, { hp: 999, maxHp: 999, awake: true, spoke: true, nextAct: 1e12 });
  await artReady(page);
  await page.evaluate(() => {
    const G = Game.state(), p = G.player, m = Game.level().monsters[0];
    m.windup = { kind: 'melee', at: G.t - 500, until: G.t + 1e6 };
    p.webbed = p.dazzled = G.t + 1e6; p.hexed = { kind: 'slow', until: G.t + 1e6 };
    p.effects.ac = p.effects.might = { amount: 2, until: G.t + 1e6 };
    p.inv.push({ t: 'scroll_fire', q: 1, e: 0 }); G.known.scroll_fire = 1;
    G.log.push({ m: 'The Rabid Blink Hound snaps at the air where you stood.', c: 'bad', at: 0 }); G.logSeq++;
  });
  await expect(page.locator('#combat-intent')).toContainText('Drawing back to strike');
  await expect(page.locator('#quick-scroll')).toBeVisible();
  await expect(page.locator('.view-wrap')).toHaveClass(/boss-up/);
  for (const [width, height] of [[320,667], [320,568], [390,844], [740,360]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(landscape => { const p=Game.player(), L=Game.level(), key=p.x+','+p.y; if(landscape)L.items[key]=[{t:'potion_heal',q:1,e:0}];else delete L.items[key]; }, width > height);
    await expect(page.locator('#feet'))[width > height ? 'toBeVisible' : 'toBeHidden']();
    await expect.poll(() => page.evaluate(fontSize => {
      const box = s => { const e = document.querySelector(s), r = e.getBoundingClientRect(); return { l:r.left, r:r.right, t:r.top, b:r.bottom, w:r.width, h:r.height }; };
      const overlap = (a,b) => a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1;
      const log = box('#log'), controls = box('.controls'), scroll = box('#quick-scroll'), more = box('#log-more'), intent = box('#combat-intent'), feet = box('#feet');
      return { logClear: !overlap(log, controls), scrollClear: !overlap(scroll, intent) && !overlap(scroll, controls) && !overlap(scroll, more), historyClear: !overlap(more, controls), feetClear: !feet.h || !overlap(feet,intent) && !overlap(feet,scroll) && !overlap(feet,more) && !overlap(feet,controls),
        actionsInLog: scroll.t >= log.t && scroll.b <= log.b + 1 && more.t >= log.t && more.b <= log.b + 1,
        noOverflow: document.documentElement.scrollWidth <= innerWidth + 1, view: box('#view').h > 40,
        conditionsBounded: box('#hud-status').h <= 44, conditionsClear: !overlap(box('#hud-status'),intent) && box('#hud-status').b <= box('#view').b + 1, mapContained: box('#minimap').b <= box('#view').b + 1 && !overlap(box('#minimap'), box('#hud-status')), type: getComputedStyle(document.documentElement).fontSize === fontSize };
    }, textSize==='3'?'24px':'32px'), { message: `${width}x${height} combat layout` }).toEqual({ logClear:true, scrollClear:true, historyClear:true, feetClear:true, actionsInLog:true, noOverflow:true, view:true, conditionsBounded:true, conditionsClear:true, mapContained:true, type:true });
    await page.screenshot({ path: info.outputPath(`combat-${width}x${height}.png`) });
  }
  await page.setViewportSize({ width:320, height:667 });
  const viewBefore = await page.locator('#view').boundingBox(), reserveHeight = (await page.locator('.combat-intent-slot').boundingBox()).height;
  await page.evaluate(() => { Game.level().monsters[0].windup = null; });
  await expect(page.locator('#combat-intent')).toBeHidden();
  await expect(page.locator('.combat-intent-slot')).toHaveClass(/reserved/);
  await expect.poll(async () => (await page.locator('#view').boundingBox()).height).toBeCloseTo(viewBefore.height, 0);
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.combat-intent-slot')).not.toHaveClass(/reserved/);
  await expect.poll(async () => (await page.locator('#view').boundingBox()).height).toBeGreaterThan(viewBefore.height + reserveHeight - 1);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.combat-intent-slot')).toHaveClass(/reserved/);
  const last = page.locator('#hud-status button').last(); await last.focus();
  const before = await last.textContent(); await expect(last).not.toHaveText(before); await expect(last).toBeFocused();
  expect(await page.evaluate(() => { const e=document.querySelector('#hud-status'), b=e.lastElementChild, r=b.getBoundingClientRect(), s=e.getBoundingClientRect(); return e.scrollLeft > 0 && r.left >= s.left - 1 && r.right <= s.right + 1; })).toBe(true);
  await page.locator('#log-more').click(); await expect(page.locator('#ov-log')).toHaveClass(/open/);
  await expect(page.locator('#log-history')).toContainText('The Rabid Blink Hound snaps at the air where you stood.');
  await page.keyboard.press('Escape'); await expect(page.locator('#log-more')).toBeFocused();
  expect(errors).toEqual([]);
});

test('enlarged vital bars keep full large numbers when they wrap @mobile', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('deepdelve.textSize', '4'));
  await startGame(page, { seed:'combat-clarity', cls:'mage', name:'A long hero name' });
  await page.evaluate(() => { Game.level().monsters=[]; const p=Game.player(); p.hp=p.maxHp=9999; p.sp=p.maxSp=9999; p.food=0; });
  for (const [width,height] of [[320,667],[390,844]]) {
    await page.setViewportSize({width,height});
    await expect(page.locator('#txt-hp')).toHaveText('HP 9999/9999');
    await expect(page.locator('#txt-sp')).toHaveText('SP 9999/9999');
    expect(await page.evaluate(() => [...document.querySelectorAll('.hud-bars .bar')].every(e => { const s=e.querySelector('span'), r=document.createRange();r.selectNodeContents(s);const a=e.getBoundingClientRect(), b=r.getBoundingClientRect(); return b.left>=a.left && b.right<=a.right && b.top>=a.top && b.bottom<=a.bottom; }))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
});

for (const textSize of ['1','4']) test(`combat log fits bursts before paint at text size ${textSize} and retains history @mobile`, async ({page}) => {
  const errors=watchForErrors(page);
  await page.addInitScript(textSize => { localStorage.setItem('deepdelve.textSize', textSize); localStorage.setItem('deepdelve.sound','off');localStorage.setItem('deepdelve.prelude','off'); },textSize);
  await startGame(page,{seed:'combat-clarity'});await page.evaluate(()=>{Game.level().monsters=[];});await artReady(page);
  for (const [width,height] of [[320,667],[390,844],[740,360]]) {
    await page.setViewportSize({width,height});
    const result=await page.evaluate(() => new Promise((resolve,reject) => {
      const el=document.querySelector('#log'), tag='Before-paint burst'; let timer;
      const done=(error,result)=>{clearTimeout(timer);mutation.disconnect();probe.disconnect();error?reject(error):resolve(result);};
      // This observer is created after the game's fitting observer. Its first
      // delivery sees the same layout before the browser paints the new lines.
      const probe=new ResizeObserver(()=>{
        const r=el.getBoundingClientRect(), cs=getComputedStyle(el), children=[...el.children], top=r.top+parseFloat(cs.paddingTop)-.5;
        const long=el.classList.contains('long');
        done(null,{last:children.at(-1).textContent,whole:long?children.length===1&&children[0].getBoundingClientRect().top>=top:children.every(e=>e.getBoundingClientRect().top>=top&&e.getBoundingClientRect().bottom<=r.bottom+1),long});
      });
      const mutation=new MutationObserver(()=>{const last=el.lastElementChild;if(last?.textContent.includes(tag+' 4'))probe.observe(last);});
      mutation.observe(el,{childList:true});timer=setTimeout(()=>done(Error('No fitted burst before paint')),5000);
      for(let i=1;i<=4;i++)Game.log(`${tag} ${i}: the archer releases an arrow for 5 damage.`);
    }));
    expect(result.last).toContain('Before-paint burst 4');expect(result.whole,`${width}x${height} first layout`).toBe(true);
  }
  await page.locator('#log-more').click();await expect(page.locator('#log-history')).toContainText('Before-paint burst 1');await expect(page.locator('#log-history')).toContainText('Before-paint burst 4');
  expect(errors).toEqual([]);
});
