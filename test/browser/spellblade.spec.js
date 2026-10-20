'use strict';
const {test,expect}=require('@playwright/test');
const AxeBuilder=require('@axe-core/playwright').default;
const {watchForErrors,startGame}=require('./helpers');

async function unlock(page,keyboard=false,navigate=true){
  if(navigate) await page.goto('/');
  const release=page.locator('#release-info');
  await release.scrollIntoViewIfNeeded();
  if(keyboard){await release.focus();for(let i=0;i<5;i++)await page.keyboard.press('Enter');}
  else for(let i=0;i<5;i++)await release.click();
  await expect(page.locator('#wayfarer-unlocked')).toBeVisible();
}

test('five title taps reveal the Wayfarer, persist on this device, and leave the six public classes unchanged @mobile',async({page})=>{
 const errors=watchForErrors(page);
 await page.goto('/');await page.click('#btn-new');await expect(page.locator('.class-card')).toHaveCount(6);await page.click('#c-back');
 for(let i=0;i<4;i++)await page.click('#release-info');
 await expect(page.locator('#wayfarer-unlocked')).toBeHidden();
 await page.click('#release-info');await expect(page.locator('#wayfarer-unlocked')).toBeVisible();
 await page.click('#btn-new');await expect(page.locator('.class-card')).toHaveCount(7);await page.click('[data-cls="spellblade"]');
 await expect(page.locator('#c-class-title')).toHaveText('Spellblade');
 await expect(page.locator('#c-name')).toHaveValue('The Wayfarer');
 await expect(page.locator('.class-backstory')).toContainText('The oldest kneel.');
 await expect(page.locator('#c-portrait')).toHaveAttribute('src','img/portraits/spellblade.webp');
 await expect.poll(()=>page.locator('#c-portrait').evaluate(i=>i.complete&&i.naturalWidth===512)).toBe(true);
 await expect(page.locator('#c-class-more .create-mastery')).toHaveCount(0);
 await page.locator('#c-customise > summary').click();
 await expect(page.locator('#c-start')).not.toContainText('last stage');
 await page.reload();await page.click('#btn-new');await expect(page.locator('[data-cls="spellblade"]')).toBeVisible();
 expect(errors).toEqual([]);
});

test('keyboard unlock is accessible with double text and never replaces an existing save @mobile',async({page})=>{
 const errors=watchForErrors(page);
 await startGame(page,{seed:'wayfarer-save-guard'});await page.evaluate(()=>Game.save());
 await page.addInitScript(()=>localStorage.setItem('deepdelve.textSize','4'));
 await page.goto('/');
 const saved=await page.evaluate(()=>localStorage.getItem('deepdelve.save'));
 await unlock(page,true,false);
 expect(await page.evaluate(()=>localStorage.getItem('deepdelve.save'))).toBe(saved);
 await expect(page.locator('#btn-continue')).toBeVisible();
 expect(await page.evaluate(()=>document.querySelector('#screen-title').scrollWidth<=innerWidth)).toBe(true);
 const axe=await new AxeBuilder({page}).include('#screen-title').analyze();
 expect(axe.violations.filter(v=>['serious','critical'].includes(v.impact))).toEqual([]);
 expect(errors).toEqual([]);
});

test('the hidden hero descends with a sword and lantern, casts runes, and resumes its own saved class @mobile',async({page})=>{
 const errors=watchForErrors(page);
 await page.addInitScript(()=>{localStorage.setItem('deepdelve.tipsOff','1');localStorage.setItem('deepdelve.firstSeen','1');});
 await unlock(page);
 await startGame(page,{cls:'Spellblade',name:'The Wayfarer',seed:'wayfarer-live',permadeath:false});
 await page.evaluate(()=>{Game.skipPrelude();Game.level().monsters=[];});
 expect(await page.evaluate(()=>({cls:Game.player().cls,weapon:Game.player().eq.weapon.t,lantern:Game.player().eq.shield.t}))).toEqual({cls:'spellblade',weapon:'longsword',lantern:'wayfarer_lantern'});
 await page.click('[data-open="inv"]');
 await expect(page.locator('[data-hand="left"]')).toHaveAccessibleName(/Left hand: Silver Lantern, Lantern/);
 await page.click('#ov-inv [data-close]');
 await page.click('[data-open="spells"]');
 await expect(page.locator('#spell-list .spell')).toHaveCount(5);
 await expect(page.locator('#spell-list .spell').filter({hasText:'Runic Edge: Lightning'})).toBeDisabled();
 await page.locator('#spell-list .spell').filter({hasText:'Runic Edge: Fire'}).click();
 expect(await page.evaluate(()=>Game.player().effects.runicEdge.src)).toBe('runic_fire');
 await page.click('[data-open="journal"]');await page.click('[data-jtab="effects"]');
 await expect(page.locator('#journal-list')).toContainText('Runic Edge: Fire');
 await page.click('#ov-journal [data-close]');
 await page.evaluate(()=>Game.save());await page.reload();await page.click('#btn-continue');
 expect(await page.evaluate(()=>[Game.player().cls,Game.player().effects.runicEdge.src])).toEqual(['spellblade','runic_fire']);
 expect(errors).toEqual([]);
});
