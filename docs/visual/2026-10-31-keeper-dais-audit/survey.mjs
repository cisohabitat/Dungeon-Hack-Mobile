import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const baseline=process.env.KEEPER_BASELINE_ROOT,candidate=process.env.KEEPER_CANDIDATE_ROOT;
assert.ok(baseline&&candidate,'Set both worktree roots');
const {Dungeon:B}=await import(pathToFileURL(baseline+'/js/dungeon.js'));
const {Dungeon:C}=await import(pathToFileURL(candidate+'/js/dungeon.js'));
const {MONSTERS}=await import(pathToFileURL(baseline+'/js/data.js'));
const rows=[],examples={};let moves=0,nonfinal=0;
for(const levels of[8,12,16])for(const route of['crypts','warrens'])for(const size of['small','medium','large'])for(let n=0;n<30;n++){
 const seed='bench'+n,opts={levels,route,size,monsters:'normal',treasure:'normal',lockedDoors:true,traps:true};
 const a=B.generate(seed,levels,opts),b=C.generate(seed,levels,opts),positions=[];
 assert.equal(a.monsters.length,b.monsters.length);const hall=a.rooms.find(r=>r.shape==='sanctum');
 const heart=Object.entries(a.items).find(([,v])=>v.some(it=>it.t==='artifact'))[0].split(',').map(Number);
 for(let i=0;i<a.monsters.length;i++){
  const old=a.monsters[i],m=b.monsters[i];
  if(old.x!==m.x||old.y!==m.y){
   assert.ok(!MONSTERS[m.id].boss&&!MONSTERS[m.id].named&&!m.elite&&!m.leader&&!m.follows);
   assert.ok(old.x>=heart[0]-2&&Math.abs(old.y-heart[1])<=1);
   assert.ok(m.x>=hall.x&&m.x<hall.x+hall.w&&m.y>=hall.y&&m.y<hall.y+hall.h&&Math.abs(m.y-heart[1])>=2);
   assert.equal(b.tiles[m.y*b.w+m.x],C.T.FLOOR);assert.ok(!b.items[m.x+','+m.y]&&!b.traps[m.x+','+m.y]&&!b.features[m.x+','+m.y]);
   assert.ok(!b.dressing.some(d=>d.x===m.x&&d.y===m.y)&&!b.npcs.some(q=>q.x===m.x&&q.y===m.y));
   positions.push({uid:m.uid,id:m.id,from:[old.x,old.y],to:[m.x,m.y]});
  }
 }
 const normalized={...b,monsters:b.monsters.map((m,i)=>({...m,...Object.fromEntries(['x','y','rx','ry','fromX','fromY'].map(k=>[k,a.monsters[i][k]]))}))};
 assert.deepEqual(normalized,a,'Only allowed monster coordinates may change');
 const keeper=B.keeperOf(levels,route),row={seed,opts,keeper,moves:positions};rows.push(row);moves+=positions.length;
 if(size==='medium'&&positions.length&&!examples[keeper])examples[keeper]=row;
 if(n<10){assert.deepEqual(C.generate(seed,levels-1,opts),B.generate(seed,levels-1,opts));nonfinal++;}
}
const result={baseline:'10247658291babf7520975a0edbf707552e05b86',candidate:'isolated ordinary-only dais prototype; preserve elite/leader/follower/nave positions',cases:rows.length,moves,nonfinal_identical:nonfinal,examples,rows};fs.writeFileSync(process.env.KEEPER_SURVEY_OUT||'/tmp/keeper-generation-survey.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({cases:rows.length,moves,nonfinal,examples}));
