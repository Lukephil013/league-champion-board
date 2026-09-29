import test from 'node:test';
import assert from 'node:assert/strict';
import {WORLD,SPELLS,createDrill,fire,step,shotPosition,predictedAim,sweptHit,moveTo,stopMoving,canFire} from '../dist/aurora-sim.mjs';
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-6,`${actual} != ${expected}`);

test('Q waits 250 ms, travels at 1600, and ends at maximum range',()=>{
  const drill=createDrill({speed:0});fire(drill,'Q',{x:1000,y:0});
  step(drill,0.25);close(shotPosition(drill.shots[0]).y,WORLD.player.y);assert.equal(drill.shots[0].hit,false);
  step(drill,450/1600);close(shotPosition(drill.shots[0]).y,WORLD.player.y-450);
  step(drill,450/1600);close(drill.last.position.y,WORLD.player.y-900);
  assert.equal(drill.shots.length,0);assert.deepEqual(drill.results.Q,{shots:1,hits:1});
  assert.equal(canFire(drill,'Q'),true);close(drill.last.finishedAt,0.8125);
});
test('enemy waits for low minion health, walks into CS range, last-hits, and retreats',()=>{
  const drill=createDrill();const startingY=drill.target.y;
  step(drill,1);assert.equal(drill.target.phase,'waiting');assert.equal(drill.results.enemyCs,0);
  step(drill,1);assert.equal(drill.target.phase,'approaching');assert.ok(drill.target.y>startingY);
  step(drill,1);assert.equal(drill.target.phase,'windup');
  step(drill,0.2);assert.equal(drill.results.enemyCs,1);assert.equal(drill.minions[0].alive,false);
  assert.equal(drill.target.phase,'retreating');
  const lastHitY=drill.target.y;step(drill,0.25);assert.ok(drill.target.y<lastHitY);
});
test('E hit counts as a CS punish only during the enemy approach or windup',()=>{
  const idle=createDrill(),contest=createDrill();
  fire(idle,'E',idle.target);step(idle,0.35);
  assert.equal(idle.results.E.hits,1);assert.equal(idle.results.punishes,0);
  step(contest,2);assert.equal(contest.target.phase,'approaching');
  fire(contest,'E',predictedAim(contest,'E'));step(contest,0.35);
  assert.equal(contest.results.E.hits,1);assert.equal(contest.results.punishes,1);
});
test('swept collision catches a target crossed entirely between two projectile positions',()=>{
  assert.equal(sweptHit({x:0,y:0},{x:200,y:0},{x:100,y:0},{x:100,y:0},20),true);
  assert.equal(sweptHit({x:0,y:0},{x:200,y:0},{x:100,y:100},{x:100,y:100},20),false);
});
test('Q has finite range and an active shot cannot be overwritten',()=>{
  const drill=createDrill({speed:0,distance:1200});assert.equal(fire(drill,'Q',drill.target),true);
  assert.equal(fire(drill,'Q',drill.target),false);step(drill,2);
  assert.equal(drill.last.hit,false);assert.equal(drill.results.Q.shots,1);
  assert.equal(fire(drill,'Q',WORLD.player),false);assert.equal(fire(drill,'X',drill.target),false);
});
test('Q and E can start together and resolve on independent timelines',()=>{
  const drill=createDrill({speed:0});
  assert.equal(fire(drill,'Q',drill.target),true);assert.equal(fire(drill,'E',drill.target),true);
  assert.equal(drill.shots.length,2);step(drill,0.25);
  assert.equal(drill.shots.find(s=>s.spell==='Q').phase,'out');
  assert.equal(drill.shots.find(s=>s.spell==='E').phase,'cast');
  step(drill,0.1);assert.equal(drill.results.E.shots,1);assert.equal(drill.results.E.hits,1);assert.equal(drill.results.Q.shots,0);
  assert.equal(drill.shots.length,1);assert.equal(drill.shots[0].spell,'Q');
  step(drill,2);assert.equal(drill.results.Q.hits,1);assert.equal(drill.results.Q.shots,1);
});
test('E can be cast while Q is in flight without replacing the Q projectile',()=>{
  const drill=createDrill({speed:0});fire(drill,'Q',drill.target);step(drill,0.4);
  const q=drill.shots[0],position=shotPosition(q);assert.equal(canFire(drill,'E'),true);fire(drill,'E',drill.target);
  step(drill,0.2);assert.ok(shotPosition(q).y<position.y);assert.equal(drill.shots.length,2);
  step(drill,2);assert.equal(drill.results.Q.shots,1);assert.equal(drill.results.E.shots,1);
});
test('click movement has fixed speed, clamps to the arena and stops at its destination',()=>{
  const drill=createDrill();moveTo(drill,{x:1350,y:1080});step(drill,0.5);close(drill.player.x,1175);
  step(drill,1);close(drill.player.x,1350);assert.equal(drill.destination,null);
  moveTo(drill,{x:9999,y:-500});assert.deepEqual(drill.destination,{x:1915,y:85});
  stopMoving(drill);const stopped={...drill.player};step(drill,1);assert.deepEqual(drill.player,stopped);
});
test('windup pauses walking, retains move orders and anchors the outgoing shot',()=>{
  const drill=createDrill();moveTo(drill,{x:1500,y:1080});fire(drill,'Q',drill.target);
  step(drill,0.25);close(drill.player.x,1000);const q=drill.shots[0];assert.deepEqual(q.origin,WORLD.player);
  step(drill,0.2);close(drill.player.x,1070);close(q.position.x,1000);close(q.position.y,760);
});
test('moving Aurora does not create a returning projectile or a second score',()=>{
  const drill=createDrill({speed:0});fire(drill,'Q',drill.target);
  moveTo(drill,{x:1400,y:1080});step(drill,0.8125);
  assert.equal(drill.shots.length,0);assert.ok(drill.player.x>1000);
  const result=structuredClone(drill.last);step(drill,2);
  assert.deepEqual(drill.last,result);assert.equal(drill.shots.length,0);
  assert.deepEqual(drill.results.Q,{shots:1,hits:1});
});
test('E resolves from its cast origin before recoil and hop ends inside the arena',()=>{
  const drill=createDrill({speed:0});drill.player={x:1000,y:800};fire(drill,'E',{x:1000,y:0});step(drill,0.35);
  close(drill.player.y,800);assert.deepEqual(drill.last.origin,{x:1000,y:800});assert.equal(canFire(drill,'E'),false);
  step(drill,250/850);close(drill.player.y,1050);assert.equal(drill.recoil,null);assert.equal(canFire(drill,'E'),true);
});
test('enemy CS and shot results are independent of render frame length',()=>{
  const small=createDrill(),large=createDrill();const aim=predictedAim(small,'Q');fire(small,'Q',aim);fire(large,'Q',aim);
  for(let i=0;i<420;i++)step(small,1/120);
  for(let i=0;i<70;i++)step(large,0.05);
  close(small.target.x,large.target.x);close(small.target.y,large.target.y);
  assert.deepEqual(small.results,large.results);assert.equal(small.results.enemyCs,1);
  close(SPELLS.Q.delay+900/SPELLS.Q.speed,0.8125);
});
