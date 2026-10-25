'use strict';
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { startGame, faceOpenGround, placeMonster, watchForErrors } = require('./helpers');

async function lamp(page) {
  await startGame(page, {seed:'mythic-vigil',cls:'Fighter',permadeath:false});
  await page.evaluate(() => {
    Game.testFloor(8);const L=Game.level(),p=Game.player();L.monsters=[];L.traps={};p.hp=p.maxHp=999;
    const n=L.npcs.find(n=>n.id==='vigil');if(!n)throw new Error('missing generated Vigil');
    const dir=Dungeon.DIRS.findIndex(([dx,dy])=>L.tiles[(n.y-dy)*L.w+n.x-dx]===Dungeon.T.FLOOR);
    const [dx,dy]=Dungeon.DIRS[dir];p.x=n.x-dx;p.y=n.y-dy;p.dir=dir;Game.input('use');
  });
  await expect(page.locator('#ov-encounter')).toBeVisible();
}
async function answer(page, text) {
  const button=page.locator('#enc-choices button').filter({hasText:text});
  await expect(button).not.toHaveClass(/arming/);await button.click();
  if (await page.evaluate(()=>!!Game.currentEncounter()?.preparing && !Game.currentEncounter()?.result)) {
    await expect(page.locator('#enc-text')).toContainText('usual aid');
    const next=page.locator('#enc-choices button').filter({hasText:/Go on without/});
    await expect(next).not.toHaveClass(/arming/);await next.click();
  }
  const done=page.locator('#enc-choices button.primary');await expect(done).toBeVisible();
  // The encounter's existing double-tap guard releases with the game clock.
  await expect(async()=>{await done.click();await expect(page.locator('#ov-encounter')).not.toBeVisible({timeout:500});}).toPass({timeout:5000});
}

test('optional Mythic trial saves its guardian and grants one persistent class reward @mobile', async ({page})=>{
  const errors=watchForErrors(page);await lamp(page);
  await expect(page.locator('#enc-text')).toContainText('Only one Mythic');
  await expect(page.locator('#enc-text')).toContainText('Armour class');
  await answer(page,/Face the lamp/);
  expect(await page.evaluate(()=>Game.level().mythicTrial)).toBe('active');
  await page.evaluate(()=>Game.save(true));await page.reload();await page.click('#btn-continue');
  await expect(page.locator('#screen-game')).toBeVisible();
  const result=await page.evaluate(()=>{
    const L=Game.level(),m=L.monsters.find(m=>m.mythicGuard);if(!m)throw new Error('lost guardian');
    Game.hurtMonster(m,10000);const drops=Object.values(L.items).flat().filter(i=>i.u==='last_gate');
    Game.save(true);return {won:L.mythicTrial,drops:drops.length};
  });expect(result).toEqual({won:'won',drops:1});
  await page.reload();await page.click('#btn-continue');
  expect(await page.evaluate(()=>({won:Game.level().mythicTrial,drops:Object.values(Game.level().items).flat().filter(i=>i.u==='last_gate').length}))).toEqual({won:'won',drops:1});
  expect(errors).toEqual([]);
});

test('the trial explains its bargain accessibly and can be declined without spawning a guardian',async({page})=>{
  const errors=watchForErrors(page);await page.addInitScript(()=>localStorage.setItem('deepdelve.textSize','4'));await lamp(page);
  const scan=await new AxeBuilder({page}).include('#ov-encounter').withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
  expect(scan.violations.filter(v=>v.impact==='serious'||v.impact==='critical')).toEqual([]);
  const trial=page.locator('#enc-choices button').filter({hasText:/Face the lamp/});
  await expect(trial).not.toHaveClass(/arming/);await trial.click();
  const preparation=await new AxeBuilder({page}).include('#ov-encounter').withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
  expect(preparation.violations.filter(v=>v.impact==='serious'||v.impact==='critical')).toEqual([]);
  const cancel=page.locator('#enc-choices button').filter({hasText:/Cancel the trial/});
  await expect(cancel).not.toHaveClass(/arming/);await cancel.click();
  await expect(page.locator('#enc-text')).toContainText('Only one Mythic');
  await answer(page,/Go on without/);
  expect(await page.evaluate(()=>!!Game.level().mythicTrial||Game.level().monsters.some(m=>m.mythicGuard))).toBe(false);
  expect(errors).toEqual([]);
});

for(const [cls,id] of [['Fighter','last_gate'],['Cleric','mercys_oath'],['Mage','bloodstar'],['Thief','nightglass'],['Ranger','horizon'],['Druid','elderseed']])test(`${cls} Mythic shows its own art and drawback, equips and survives a save`,async({page})=>{
  const errors=watchForErrors(page);await startGame(page,{seed:'mythic-pack-'+id,cls,permadeath:false});
  const expected=await page.evaluate(async id=>{
    const {RELICS}=await import('/js/relics.js'),r=RELICS[id],p=Game.player();Game.level().monsters=[];p.eq.weapon=null;p.eq.shield=null;p.eq.amulet=null;
    p.inv=[{t:r.t,u:id,e:r.e,q:1}];Game.state().known[r.t]=true;
    const key=Game.spriteFor(p.inv[0]);void Assets.sprites[key].url;return {key,portrait:`img/relics/${id}.webp`};
  },id);
  await page.click('[data-open="inv"]');await page.locator('#inv-grid .slot.g-mythic').click();
  await expect(page.locator('#item-detail .grade-word')).toHaveText('Mythic');
  await expect.poll(()=>page.evaluate(key=>Assets.sprites[key].w,expected.key)).toBe(256);
  const sprite=await page.evaluate(key=>Assets.sprites[key].url,expected.key);
  await expect(page.locator('#inv-grid .slot.g-mythic img')).toHaveAttribute('src',sprite);
  await expect(page.locator('#item-detail .item-showcase img')).toHaveAttribute('src',expected.portrait);
  await expect.poll(()=>page.locator('#item-detail .item-showcase img').evaluate(img=>img.complete&&img.naturalWidth===512)).toBe(true);
  await expect(page.locator('#item-detail .relic-powers')).toContainText(/Armour class|cost|longer|less/);
  await page.locator('#item-detail button').filter({hasText:/^(Equip|Put on)$/}).click();
  expect(await page.evaluate(id=>Object.values(Game.player().eq).some(it=>it?.u===id),id)).toBe(true);
  await page.evaluate(()=>Game.save(true));await page.reload();await page.click('#btn-continue');
  expect(await page.evaluate(id=>Object.values(Game.player().eq).some(it=>it?.u===id),id)).toBe(true);
  expect(errors).toEqual([]);
});


test('Last Gate charges from a real blow survive fractional-clock saves and native reload @mobile',async({page})=>{
  const errors=watchForErrors(page);await startGame(page,{seed:'mythic-fractional-save',cls:'Fighter',permadeath:false});
  await page.evaluate(()=>{Game.level().monsters=[];Game.level().traps={};});
  expect(await faceOpenGround(page,2)).toBeGreaterThanOrEqual(2);
  await placeMonster(page,'ogre',1,{hp:999,maxHp:999,nextAct:0,awake:true});
  const result=await page.evaluate(()=>{
    const G=Game.state(),p=Game.player(),m=Game.level().monsters[0];
    p.hp=p.maxHp=9999;p.eq.armor=null;p.eq.ring=null;p.eq.ring2=null;p.eq.cloak=null;
    p.eq.shield={t:'shield',u:'last_gate',q:1,e:1};p.stats.dex=3;G.graceUntil=0;G.t=0.125;
    for(let n=0;n<1000&&!p.mythicCharge;n++)Game.update(G.t+100,100);
    if(!p.mythicCharge)throw new Error('no close blow landed');
    m.nextAct=1e12;
    return {charge:p.mythicCharge,until:p.mythicChargeUntil,saved:Game.save(true)};
  });
  expect(result.charge).toBeGreaterThan(0);expect(Number.isInteger(result.until)).toBe(false);expect(result.saved).toBe(true);
  await page.reload();await page.click('#btn-continue');
  expect(await page.evaluate(()=>({charge:Game.player().mythicCharge,until:Game.player().mythicChargeUntil}))).toEqual({charge:result.charge,until:result.until});
  expect(errors).toEqual([]);
});
