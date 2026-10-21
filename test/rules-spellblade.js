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

  await test('Wayfarer level-ups offer only exclusive talents and lantern lessons through level twelve',async()=>{
    const c=await create(),G=c.Game,p=G.player();p.perkHit=60;
    for(let level=2;level<=c.MAX_LEVEL;level++){
      p.xp=c.XP_TABLE[level-1];
      const m=h.beside(c,'rat',{uid:8000+level,hp:1,maxHp:1,nextAct:1e12});
      for(let i=0;i<8&&G.level().monsters.includes(m);i++){G.state().t=p.nextAttack;G.input('attack');}
      const offer=G.pendingBoons();
      if(!offer?.length||offer.some(id=>!id.startsWith('wf_')))return 'ordinary or missing choice at '+level+': '+offer;
      if(level%2===0&&!offer.every(id=>c.TALENTS.spellblade.some(t=>t.id===id)))return 'missing class talent at '+level;
      if(level%2===1&&!offer.every(id=>c.BOONS.some(b=>b.id===id)))return 'missing lantern lesson at '+level;
      const before={hp:p.hp,maxHp:p.maxHp,sp:p.sp,maxSp:p.maxSp};
      if(!G.chooseBoon(offer[0]))return 'cannot learn '+offer[0];
      if(level%2===0&&(p.maxHp!==before.maxHp+5||p.hp!==before.hp+5||p.maxSp!==before.maxSp+2||p.sp!==Math.min(p.maxSp,before.sp+2)))return 'missing memory gift at '+level;
      if(G.pendingBoons())return 'unexpected extra offer';
    }
    if(new Set(p.talents).size!==6)return 'repeated talents';
    G.save();return G.load()||'new progression did not load';
  });
  await test('Wayfarer inscriptions and ward talents change actual casts and validate their saved limits',async()=>{
    const c=await create(),G=c.Game,p=G.player();
    p.talents=['wf_long_edge','wf_deep_cut','wf_patient_guard','wf_requital'];p.boons=['wf_ember','wf_glass','wf_oath','wf_echo'];
    cast(c,'runic_fire');const e=p.effects.runicEdge;
    if(e.amount!==4||e.until-G.state().t!==65000)return 'wrong learned rune';
    G.state().t=p.nextAttack;p.sp=99;cast(c,'spellguard');
    if(p.effects.spellguard.amount!==7||p.effects.spellguard.until-G.state().t!==3500)return 'wrong learned ward';
    G.hurtPlayer(1,'test',null,'test');
    if(p.effects.runicReturn.amount!==5||p.effects.runicReturn.until-G.state().t!==7000)return 'wrong learned return';
    G.save();if(!G.load())return 'learned magic rejected';
    const raw=JSON.parse(c.store.get('deepdelve.save'));raw.player.effects.runicEdge.amount=5;c.store.set('deepdelve.save',JSON.stringify(raw));
    if(G.load())return 'forged rune accepted';
    return true;
  });
  await test('Wayfarer road talents extend a legal crossing and raise one ward without refreshing existing protection',async()=>{
    const c=await create(),G=c.Game,p=G.player();p.talents=['wf_long_step','wf_step_guard'];
    if(!cast(c,'lantern_step')||p.x!==7||p.effects.spellguard?.amount!==3||p.effects.spellguard.until-G.state().t!==1200)return 'missing road or ward';
    G.save();if(!G.load())return 'travelling ward rejected';
    const loaded=G.player();loaded.x=4;loaded.effects.spellguard={amount:6,until:G.state().t+2000,src:'spellguard'};
    G.state().t=loaded.nextAttack;loaded.sp=99;const until=loaded.effects.spellguard.until;
    if(!cast(c,'lantern_step')||loaded.effects.spellguard.amount!==6||loaded.effects.spellguard.until!==until)return 'step replaced or refreshed existing ward';
    return true;
  });
  await test('Wayfarer memories reject unknown or duplicated powers and cannot be imported onto ordinary heroes',async()=>{
    for(const kind of ['unknown','duplicate','other-class']){
      const c=await create(),G=c.Game;G.save();const raw=JSON.parse(c.store.get('deepdelve.save'));
      raw.player.talents=kind==='unknown'?['wf_invented']:kind==='duplicate'?['wf_long_edge','wf_long_edge']:['wf_long_edge'];
      if(kind==='other-class')raw.player.cls='fighter';c.store.set('deepdelve.save',JSON.stringify(raw));
      if(G.load())return 'accepted '+kind;
    }
    const c=await create(),G=c.Game;G.player().boons=['vigor','focus'];G.save();
    return G.load()||'old Wayfarer lessons no longer load';
  });

  await test('Wayfarer Sever the Veil guides an active runed blade without helping empty hands or changing dice',async()=>{
    const c=await create(),G=c.Game,p=G.player(),base=G.toHit();p.talents=['wf_deep_cut'];
    if(G.toHit()!==base)return 'accuracy without a rune';
    cast(c,'runic_fire');const dice=c.Dice.s;
    if(G.toHit()!==base+1||!G.spellDesc(c.SPELLS.spellblade[0]).includes('+1 to hit'))return 'missing runed accuracy or description';
    const sword=p.eq.weapon;p.eq.weapon=null;if(G.toHit()!==base)return 'accuracy with an empty hand';p.eq.weapon=sword;
    G.state().t=p.effects.runicEdge.until;
    if(G.toHit()!==base||c.Dice.s!==dice)return 'expired rune or changed dice';
    return true;
  });

};
