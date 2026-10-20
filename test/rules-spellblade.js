// The hidden hero stays outside public challenges; its powers use the normal clocks.
module.exports = async h => {
  const { test, newContext, evenStats, OPTS } = h;
  const create = async (seed = 'bench') => {
    const c = await newContext();
    c.Game.newGame({name:'Wayfarer', cls:'spellblade', stats:{...evenStats,int:16},seed,opts:{...OPTS,levels:8}});
    const p=c.Game.player(), L=c.Game.level();
    L.monsters=[]; L.npcs=[]; L.props=[]; L.traps={}; L.items={};
    p.x=4;p.y=4;p.dir=1;
    for(let x=3;x<=7;x++){ L.tiles[4*L.w+x]=c.Dungeon.T.FLOOR;L.explored[4*L.w+x]=1; }
    return c;
  };
  const cast=(c,id)=>c.Game.castSpell(c.SPELLS.spellblade.find(s=>s.id===id));
  await test('the Spellblade carries its own lantern, uses Intelligence and stays outside shared challenges', async()=>{
    const c=await create(), G=c.Game, p=G.player();
    if(p.eq.weapon.t!=='longsword'||p.eq.shield.t!=='wayfarer_lantern'||!p.maxSp||G.knownSpells().length!==5)return 'missing kit or spell list';
    const hit=G.toHit();p.stats.int+=4;if(G.toHit()!==hit+2)return 'Intelligence did not guide sword';
    const before=JSON.stringify(G.state());
    for(const kind of ['daily','weekly']){try{G.newGame({name:'Forbidden',cls:'spellblade',stats:evenStats,seed:'shared',opts:{...OPTS,[kind]:'2026-10-20'}});return 'entered '+kind;}catch{}}
    if(JSON.stringify(G.state())!==before)return 'rejected challenge changed the run';
    return true;
  });
  await test('Runic Edge spends points and recovery, replaces one rune and rejects empty hands or other classes',async()=>{
    const c=await create(), G=c.Game,p=G.player(),s=p.sp;
    if(!cast(c,'runic_fire')||p.sp!==s-2||p.nextAttack<=G.state().t)return 'free or missing enchantment';
    if(cast(c,'runic_frost'))return 'cast during recovery';
    G.state().t=p.nextAttack;
    if(!cast(c,'runic_frost')||p.effects.runicEdge.src!=='runic_frost')return 'rune did not replace fire';
    G.state().t=p.nextAttack;const w=p.eq.weapon;p.eq.weapon=null;const points=p.sp;
    if(cast(c,'runic_fire')||p.sp!==points)return 'enchanted empty hand';p.eq.weapon=w;
    const mage=await h.start('mage','cannot-borrow');
    return !mage.Game.castSpell(c.SPELLS.spellblade[0])||'mage borrowed secret magic';
  });
  await test('Lantern Step uses only clear explored ground and never crosses walls, hidden ground, creatures or webs',async()=>{
    for(const obstacle of ['wall','unexplored','monster','web','npc','companion','grabbed']){
      const c=await create(),G=c.Game,p=G.player(),L=G.level(),i=4*L.w+5;
      if(obstacle==='wall')L.tiles[i]=c.Dungeon.T.WALL;
      if(obstacle==='unexplored')L.explored[i]=0;
      if(obstacle==='monster')L.monsters.push({id:'rat',x:5,y:4,hp:4});
      if(obstacle==='web')p.webbed=5000;
      if(obstacle==='grabbed')p.grabbed={until:5000};
      if(obstacle==='npc')L.npcs.push({x:5,y:4,kind:'trader'});
      if(obstacle==='companion')G.state().companion={kind:'hound',name:'Brindle',hp:4,maxHp:4,mode:'follow',depth:1,x:5,y:4};
      const before=JSON.stringify([p.sp,p.x,p.y,p.nextAttack,c.Dice.s]);
      if(cast(c,'lantern_step')||JSON.stringify([p.sp,p.x,p.y,p.nextAttack,c.Dice.s])!==before)return 'crossed/spent against '+obstacle;
    }
    const c=await create(),G=c.Game,p=G.player(),s=p.sp;
    if(!cast(c,'lantern_step')||p.x!==6||p.y!==4||p.sp!==s-3)return 'clear two-square step failed';
    return true;
  });
  await test('Spellguard absorbs one hit, expires on the game clock, and lets poison and hunger through',async()=>{
    const c=await create(),G=c.Game,p=G.player();
    if(!cast(c,'spellguard'))return 'guard did not cast';
    const hp=p.hp;G.hurtPlayer(1,'poison',null,'poison');
    if(p.hp!==hp-1||!p.effects.spellguard)return 'poison spent the guard';
    G.hurtPlayer(8,'hit',null,'test');
    if(p.hp!==hp-3||p.effects.spellguard||p.effects.runicReturn?.amount!==3)return 'wrong guard absorption or return';
    G.hurtPlayer(1,'next hit',null,'test');if(p.hp!==hp-4)return 'guard caught a second hit';
    G.state().t=p.nextAttack;p.sp=99;cast(c,'spellguard');G.state().t+=2201;
    const before=p.hp;G.hurtPlayer(1,'late',null,'test');return p.hp===before-1||'expired guard caught hit';
  });
  await test('Spellblade runes and clocks survive save/load and forged magnitudes are rejected',async()=>{
    const c=await create(),G=c.Game;
    cast(c,'runic_fire');G.state().t=G.player().nextAttack;cast(c,'spellguard');
    const before=JSON.stringify(G.player().effects);G.save();
    if(!G.load()||JSON.stringify(G.player().effects)!==before)return 'lost runes on load';
    const raw=JSON.parse(c.store.get('deepdelve.save'));raw.player.effects.runicEdge.amount=999;
    c.store.set('deepdelve.save',JSON.stringify(raw));
    return !G.load()||'accepted forged runic damage';
  });
  await test('rune damage and the guarded return happen only on landed close blade hits',async()=>{
    const c=await create(),G=c.Game,p=G.player(),L=G.level();
    const m={id:'ogre',uid:123,x:5,y:4,rx:5,ry:4,hp:10000,maxHp:10000,nextAct:1e9,awake:true};L.monsters=[m];
    p.effects.runicEdge={amount:2,until:1e6,src:'runic_frost'};p.effects.runicReturn={amount:3,until:1e6,src:'spellguard'};
    // Replay the same attack with the same dice, isolating the rune contribution.
    let state, hp, first;
    for(let i=0;i<20;i++){ state=c.Dice.s;hp=m.hp;G.state().t=p.nextAttack;G.input('attack');first=hp-m.hp;
      if(first)break; if(!p.effects.runicReturn)return 'miss spent return';
    }
    if(!first)return 'no landed hit to verify';
    if(p.effects.runicReturn)return 'landed hit kept return';
    G.state().t=p.nextAttack;p.effects={};m.hp=hp;c.Dice.s=state;G.input('attack');
    return first-(hp-m.hp)===5||`rune/return contribution was ${first-(hp-m.hp)}`;
  });
  await test('Spellblade recorded casts and guarded hits replay identically without the device unlock',async()=>{
    const c=await h.loadGame(),G=c.Game;
    c.store.set('deepdelve.wayfarer','1');G.recordRuns(true);
    G.newGame({name:'Wayfarer',cls:'spellblade',stats:{...evenStats,int:16},seed:'rune-replay',opts:{...OPTS,levels:8}});
    cast(c,'runic_fire');G.tick(700);cast(c,'spellguard');G.hurtPlayer(5,'a recorded hit');G.hurtPlayer(99999,'the last blow');
    const rec=G.recording();if(!rec||!rec.final)return 'no finished recording';
    if(rec.header.store['deepdelve.wayfarer'])return 'unlock leaked into recording';
    c.store.delete('deepdelve.wayfarer');G.startReplay(rec);
    for(const event of rec.events)G.replayCall(event);
    const {recordingPrint}=await import('../js/recording.js');
    return recordingPrint(G.state())===rec.final.print||'rune replay diverged';
  });

  await test('the hidden hero records its wins without claiming an absent mastery stage',async()=>{
    const c=await create(),before=c.Progress.trophyCount(),earned=c.Progress.recordWin('spellblade','hard',{levels:8});
    if(c.Progress.trophyCount().won!==before.won||c.Progress.trophyCount().total!==before.total)return 'hidden class changed public trophies';
    return c.Progress.hasWon('spellblade','hard')&&c.Progress.stage('spellblade')===0&&!earned.stageReached||'hidden win claimed public mastery';
  });

  await test('Lantern Step lands on the first trap and runs its normal tile interaction',async()=>{
    const c=await create(),G=c.Game,L=G.level();L.traps['5,4']='dart';
    if(!cast(c,'lantern_step'))return 'step refused the visible floor';
    return G.player().x===5&&!L.traps['5,4']||'step skipped the trapped square';
  });

  await test('the final Vigil Lamp never offers or starts a nonexistent Spellblade Mythic',async()=>{
    const c=await create(),G=c.Game.state(),L=c.Game.level(),p=c.Game.player();G.depth=8;L.isFinal=true;
    const {makeMythics}=await import('../js/mythics.js');
    const M=makeMythics({G,P:()=>p,lvl:()=>L}),def={text:'The Vigil Lamp',choices:[]},npc={id:'vigil',x:4,y:4};
    if(M.offer(npc,def)!==def)return 'offered a nonexistent Mythic';
    M.begin(npc);return !L.mythicTrial||'started a nonexistent trial';
  });

  await test('Cloistered public heroes keep their old knowledge; only the Wayfarer knows the private lantern',async()=>{
    for(const cls of ['fighter','cleric','mage','thief','ranger','druid','spellblade']){
      const c=await h.loadGame();c.Game.newGame({name:'Bookkeeper',cls,bg:'cloistered',stats:evenStats,seed:'private-flame',opts:OPTS});
      if(!!c.Game.state().known.wayfarer_lantern!==(cls==='spellblade')||!c.Game.state().known.longsword)return 'wrong catalogue for '+cls;
    }
    return true;
  });

  await test('a new hero level can renew a rune that has grown weaker than the spell',async()=>{
    const c=await create(),G=c.Game,p=G.player();cast(c,'runic_fire');
    G.state().t=p.nextAttack;p.level=4;
    return cast(c,'runic_fire')&&p.effects.runicEdge.amount===3||'could not strengthen an old rune';
  });

  await test('Deepward stays absent through floor eight, grows only with the lantern, and caps at four',async()=>{
    const c=await create(),G=c.Game,p=G.player(),L=G.level(),base=G.playerAC(),dice=c.Dice.s;
    for(let depth=1;depth<=32;depth++){
      G.state().levels[depth]=L;G.state().depth=depth;
      const bonus=Math.min(4,Math.max(0,Math.ceil((depth-8)/2)));
      if(G.deepward()!==bonus||G.playerAC()!==base+bonus)return 'wrong ward at floor '+depth;
    }
    p.eq.shield=null;
    return G.deepward()===0&&G.playerAC()===base-1&&c.Dice.s===dice||'ward survived losing the lantern or consumed dice';
  });
  await test('Deepward gives no armour to any public class, on any floor',async()=>{
    for(const cls of ['fighter','cleric','mage','thief','ranger','druid']){
      const c=await h.start(cls,'no-private-ward'),G=c.Game,L=G.level(),base=G.playerAC();
      for(let depth=1;depth<=32;depth++){G.state().levels[depth]=L;G.state().depth=depth;if(G.deepward()||G.playerAC()!==base)return 'private ward on '+cls;}
    }
    return true;
  });

};
