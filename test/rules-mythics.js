'use strict';
module.exports = async function(h) {
  const { test, start, seedDice, wearRelic, beside, meetAndChoose } = h;
  const factory = async cls => {
    const ctx = await start(cls, 'mythic-rules', { levels: 8 });
    const { makeMythics } = await import('../js/mythics.js');
    const { Game, ITEMS } = ctx, p = Game.player(), G = Game.state(), L = Game.level();
    const kit = { get G() { return G; }, P: () => p, lvl: () => L, hasPower: Game.hasPower, key: (x,y) => `${x},${y}`, log: () => {}, floatText: () => {}, companionAt: () => false, relicItem: id => ({t:ctx.RELICS[id].t,u:id,q:1,e:0}), newMonster: (id,x,y,hp) => { const m={id,x,y,hp};L.monsters.push(m);return m; }, hurtPlayer: n => {p.hp-=n;} };
    return { ...ctx, p, G, L, M: makeMythics(kit), ITEMS };
  };
  await test('Mythics: one per class, outside ordinary relic deals, shops, Collector and mastery starts', async () => {
    const { Game, RELICS, CLASSES, Progress } = await start('fighter', 'mythic-pools');
    const { relicPlan, toCollect, relicUsableBy } = await import('../js/relics.js');
    for (const cls of Object.keys(CLASSES).filter(id => !CLASSES[id].hidden)) {
      const ids = Object.keys(RELICS).filter(id => RELICS[id].mythic === cls);
      if (ids.length !== 1) return cls;
      const id = ids[0];
      if (Game.grade({t:RELICS[id].t,u:id,q:1}) !== 'mythic' || toCollect().includes(id)) return 'grade/collector';
      for (const other of Object.keys(CLASSES)) if (relicUsableBy(id,other)!==(other===cls)) return 'class use';
      for (let n=0;n<20;n++) { const plan=relicPlan('mythic'+n,cls,16); if ([...Object.values(plan.floor),...plan.shop].some(x=>RELICS[x].mythic)) return 'dealt a Mythic'; }
      if (Progress.codexStarts(cls,{relics:[id],won:{},feats:{},rungs:{[cls]:5},paths:{}}).includes(id)) return 'mastery start';
    }
    return true;
  });
  await test('Mythics: real equip rejects the wrong class and a second worn Mythic, but permits replacement', async () => {
    const {Game,RELICS}=await start('fighter','mythic-equip');const p=Game.player();
    const give=id=>{const it={t:RELICS[id].t,u:id,e:0,q:1};p.inv.push(it);return it;};
    const a=give('last_gate'),wrong=give('nightglass');
    if (Game.equip(wrong,true) || !Game.equip(a,true)) return 'class/equip';
    const replacement=give('last_gate');if(!Game.equip(replacement,true)) return 'replacement';
    // Imported duplicate in another slot is never a route to stacking.
    p.eq.amulet={...a};const b=give('last_gate');return !Game.equip(b,true);
  });
  await test('Mythics: trial is optional and final-floor only, absent from Daily, Weekly, short and repeated offers', async () => {
    const {G,L,M}=await factory('fighter'),{ENCOUNTERS}=await import('../js/encounters.js');
    const npc={id:'vigil',x:2,y:2};const base=ENCOUNTERS.vigil;
    if(M.offer(npc,base)!==base)return 'early offer';G.depth=8;L.isFinal=true;
    if(M.offer(npc,base).choices.length!==base.choices.length+1)return 'missing trial';
    for(const flag of ['daily','weekly']){G.opts[flag]='fixed';if(M.offer(npc,base)!==base)return flag;delete G.opts[flag];}
    G.opts.levels=4;G.depth=4;if(M.offer(npc,base)!==base)return 'short';G.opts.levels=8;G.depth=8;
    L.monsters=[];M.begin(npc);const m=L.monsters[0];M.begin(npc);if(L.monsters.length!==1||!m.mythicGuard||L.mythicTrial!=='active')return 'repeat start';
    M.felled(m);M.felled(m);return L.mythicTrial==='won'&&L.items['2,2'].filter(i=>i.u==='last_gate').length===1&&M.offer(npc,base)===base;
  });
  await test('Mythics: Last Gate counter is capped, expires, spends once and clears when removed; Nightglass has its cost', async () => {
    const {p,G,M}=await factory('fighter');p.eq.shield={t:'shield',u:'last_gate',q:1,e:0};
    if(M.armour()!==-1)return 'armour';for(let i=0;i<10;i++)if(M.guard(5)!==3)return 'guard';
    if(M.blow(false,false)!==3||M.blow(false,false)!==0)return 'cap/spend';M.guard(5);G.t+=5001;if(M.blow(false,false)!==0)return 'expiry';
    M.guard(5);p.eq.shield=null;M.equipment();if(p.mythicCharge!==undefined)return 'unequip';
    const thief=await factory('thief');thief.p.eq.amulet={t:'amulet_mind',u:'nightglass',q:1,e:0};return thief.M.blow(false,true)===6&&thief.M.blow(false,false)===2&&thief.M.blow(true,true)===0&&thief.M.armour()===-1;
  });
  await test('Mythics: a Last Gate charge saves fractional frame clocks while rejecting invalid timers and charges', async () => {
    const {G,p,M}=await factory('fighter');p.eq.shield={t:'shield',u:'last_gate',q:1,e:1};
    G.t=123.125;M.guard(5);const {checkSave}=await import('../js/savecheck.js');
    checkSave(JSON.parse(JSON.stringify(G)));if(p.mythicChargeUntil!==5123.125)return 'clock rounded';
    for(const [key,value] of [['mythicCharge',1.5],['mythicCharge',4],['mythicChargeUntil',-1],['mythicChargeUntil',1e12+1],['mythicChargeUntil','5123.125']]){
      const bad=JSON.parse(JSON.stringify(G));bad.player[key]=value;let refused=false;try{checkSave(bad);}catch{refused=true;}
      if(!refused)return 'accepted invalid '+key;
    }
    return true;
  });
  await test('Mythics: caster bargains and druid/ranger tradeoffs apply only while worn', async () => {
    const c=await factory('cleric');c.p.eq.shield={t:'holy_symbol',u:'mercys_oath',q:1,e:0};
    if(c.M.healing(20)!==25||c.M.spellCost({kind:'bolt'})!==1||c.M.spellCost({kind:'heal'})!==0)return 'cleric';
    const m=await factory('mage');m.p.eq.shield={t:'crystal_orb',u:'bloodstar',q:1,e:0};m.p.hp=10;m.M.cast({kind:'bolt'});
    if(m.p.hp!==8||m.M.spellDamage(20)!==24)return 'mage';m.p.hp=2;if(!m.M.spellBlocked({kind:'bolt'}))return 'low life';m.M.cast({kind:'buff'});if(m.p.hp!==2)return 'non-damage';
    const d=await factory('druid');d.p.eq.amulet={t:'amulet_ward',u:'elderseed',q:1,e:0};if(d.M.hide()!==4||d.M.roots()!==1000||d.M.healing(20)!==16)return 'druid';
    const r=await factory('ranger');r.p.eq.weapon={t:'longbow',u:'horizon',q:1,e:0};return r.M.blow(true,false)===4&&r.M.blow(false,false)===0&&r.M.pace(r.p.eq.weapon)===1.15;
  });
  await test('Mythics: live casts charge life after validation, ignore wards, preserve spell timing and apply the damage bonus', async () => {
    const ctx=await start('mage','mythic-live-cast'),{Game}=ctx,p=Game.player(),G=Game.state();
    p.level=9;p.sp=p.maxSp=999;p.hp=p.maxHp=999;p.effects={};Game.level().dressing=[];Game.level().npcs=[];
    const spell=Game.knownSpells().find(s=>s.id==='magic_missile');
    const target=beside(ctx,'orc',{hp:999,maxHp:999,nextAct:1e12});
    p.eq.shield={t:'crystal_orb',q:1,e:0};seedDice(ctx,'blood-hit');p.nextAttack=0;const before=target.hp;
    if(!Game.castSpell(spell))return 'plain refused';const plain=before-target.hp;
    p.eq.shield={t:'crystal_orb',u:'bloodstar',q:1,e:0};target.hp=999;seedDice(ctx,'blood-hit');p.nextAttack=0;p.aegis={hp:40,until:G.t+1e6};const hp=p.hp;
    if(!Game.castSpell(spell)||p.hp!==hp-2||p.aegis.hp!==40)return 'life price bypass';
    if(999-target.hp!==Math.round(plain*1.2))return 'damage bonus';
    const sp=p.sp;p.hp=2;p.nextAttack=0;target.hp=999;
    if(Game.castSpell(spell)||p.hp!==2||p.sp!==sp||target.hp!==999)return 'low life spent something';
    p.hp=30;p.nextAttack=0;Game.level().monsters=[];if(Game.castSpell(spell)||p.hp!==30||p.sp!==sp)return 'empty target price';
    return true;
  });
  await test('Mythics: real encounter trial rewards once, preserves a full-pack reward on the floor, and survives save validation', async () => {
    const ctx=await start('fighter','mythic-live-trial',{levels:8}),{Game}=ctx,p=Game.player(),G=Game.state(),L=Game.level();
    G.depth=8;G.levels[8]=L;L.isFinal=true;L.monsters=[];L.npcs=[];
    // Open normally, with the original choice indexes preserved before the new trial.
    const r=meetAndChoose(ctx,'vigil',4);if(!r?.preparing||L.mythicTrial)return 'trial preview committed';
    Game.chooseEncounter(Game.encounterOptions().length-1);if(L.mythicTrial!=='active')return 'trial not started';Game.closeEncounter();
    const guard=L.monsters.find(m=>m.mythicGuard);if(!guard)return 'guardian absent';
    p.inv=Array.from({length:Game.INV_MAX},()=>({t:'dagger',q:1,e:0}));Game.hurtMonster(guard,10000);
    if(L.mythicTrial!=='won')return 'reward not won';
    const drops=Object.values(L.items).flat().filter(it=>it.u==='last_gate');if(drops.length!==1)return 'reward count';
    const {checkSave}=await import('../js/savecheck.js');checkSave(JSON.parse(JSON.stringify(G)));
    const bad=JSON.parse(JSON.stringify(G));bad.player.mythicCharge=4;let refused=false;try{checkSave(bad);}catch{refused=true;}
    return refused;
  });

  await test('Mythics: the preview cancels freely and normal paid aid is applied before the guardian wakes', async () => {
    const ctx=await start('fighter','mythic-preparation',{levels:8}),{Game}=ctx,p=Game.player(),G=Game.state(),L=Game.level();
    G.depth=8;G.levels[8]=L;L.isFinal=true;L.monsters=[];p.gold=1000;p.hp=1;
    meetAndChoose(ctx,'vigil',4);const before=JSON.stringify(G);
    const cancel=Game.currentEncounter().def.choices.findIndex(ch=>ch.outcome?.effects.some(e=>e.mythicBack));
    Game.chooseEncounter(cancel);if(JSON.stringify(G)!==before||Game.currentEncounter().preparing)return 'cancel changed state';
    Game.chooseEncounter(4);if(!Game.currentEncounter().preparing||p.gold!==1000||L.mythicTrial)return 'preview spent resources';
    Game.chooseEncounter(2);
    return p.gold===640&&p.hp===p.maxHp&&L.mythicTrial==='active'&&L.monsters.filter(m=>m.mythicGuard).length===1&&G.metEncounters.filter(id=>id==='vigil').length===1;
  });
  await test('Mythics: a resumed trial records preview, cancellation, victory and equipment for exact replay', async () => {
    const { recordingPrint, replayHeadless, replayStorage } = await import('../js/recording.js');
    const { Game: G, Dungeon } = await h.loadGame();
    G.recordRuns(true);G.newGame({name:'Recorded trial',cls:'fighter',stats:{...h.evenStats},seed:'mythic-replay',opts:{...h.OPTS,levels:8}});
    // Resume a valid final-floor save, then use only recorded public actions.
    const state=G.state(),L=G.level(),p=G.player(),[dx,dy]=Dungeon.DIRS[p.dir];
    state.depth=8;state.levels[8]=L;L.isFinal=true;L.monsters=[];L.traps={};p.hp=p.maxHp=999;
    L.tiles[(p.y+dy)*L.w+p.x+dx]=Dungeon.T.FLOOR;
    L.npcs=[{id:'vigil',kind:'encounter',x:p.x+dx,y:p.y+dy}];
    G.giveItem({t:'shortsword',q:1,e:100});G.equip(p.inv.find(it=>it.e===100));
    G.save(true);if(!G.load())return 'resume failed';
    G.input('use');G.chooseEncounter(4);
    G.chooseEncounter(G.currentEncounter().def.choices.findIndex(ch=>ch.outcome?.effects.some(e=>e.mythicBack)));
    G.chooseEncounter(4);G.chooseEncounter(G.encounterOptions().length-1);G.closeEncounter();
    for(let t=0;t<5000&&G.level().mythicTrial!=='won';t+=50){G.input('attack');G.update(t,50);}
    if(G.level().mythicTrial!=='won')return 'trial not won';
    G.input('forward');G.input('take');
    const reward=G.player().inv.find(it=>it.u==='last_gate');if(!reward||!G.equip(reward))return 'reward not worn';
    G.hurtPlayer(99999,'The trial replay check');
    const data=G.recording(),print=recordingPrint(G.state());if(!data)return G.recordingReason();
    const ctx=await h.loadGame(),storage=globalThis.localStorage;globalThis.localStorage=replayStorage(data);
    try{replayHeadless(ctx.Game,data);return recordingPrint(ctx.Game.state())===print||'trial replay diverged';}
    finally{globalThis.localStorage=storage;}
  });

};
