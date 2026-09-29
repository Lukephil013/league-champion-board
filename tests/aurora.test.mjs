import test from 'node:test';
import assert from 'node:assert/strict';
import {WORLD,SPELLS,createDrill,fire,step,shotPosition,predictedAim,sweptHit} from '../dist/aurora-sim.mjs';
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-6,`${actual} != ${expected}`);

test('Q waits 250 ms, travels at 1600, then returns at 2000 units per second',()=>{
  const drill=createDrill({speed:0});fire(drill,'Q',{x:1000,y:0});
  step(drill,0.25);close(shotPosition(drill.shot).y,WORLD.player.y);assert.equal(drill.shot.hit,false);
  step(drill,450/1600);close(shotPosition(drill.shot).y,WORLD.player.y-450);
  step(drill,450/1600);close(shotPosition(drill.shot).y,WORLD.player.y-900);
  step(drill,0.1);close(shotPosition(drill.shot).y,WORLD.player.y-700);
  step(drill,0.35);assert.equal(drill.shot,null);assert.deepEqual(drill.results.Q,{shots:1,hits:1,returns:1});
});
test('leading a steady moving target hits; aiming at its cast-time location misses',()=>{
  const direct=createDrill(),led=createDrill();
  fire(direct,'Q',{x:direct.target.x,y:direct.target.y});
  const aim=predictedAim(led,'Q');assert.ok(aim.x>led.target.x);fire(led,'Q',aim);
  step(direct,1.3);step(led,1.3);assert.equal(direct.last.hit,false);assert.equal(led.last.hit,true);
});
test('E checks the moving target exactly at 350 ms, not when cast',()=>{
  const drill=createDrill({speed:500}),ahead=createDrill({speed:500});
  fire(drill,'E',{x:1000,y:430});fire(ahead,'E',predictedAim(ahead,'E'));
  step(drill,0.349);assert.equal(drill.results.E.shots,0);
  step(drill,0.001);step(ahead,0.35);
  assert.equal(drill.last.hit,false);assert.equal(ahead.last.hit,true);assert.equal(drill.shot,null);
});
test('swept collision catches a target crossed entirely between two projectile positions',()=>{
  assert.equal(sweptHit({x:0,y:0},{x:200,y:0},{x:100,y:0},{x:100,y:0},20),true);
  assert.equal(sweptHit({x:0,y:0},{x:200,y:0},{x:100,y:100},{x:100,y:100},20),false);
});
test('Q has finite range and an active shot cannot be overwritten',()=>{
  const drill=createDrill({speed:0,distance:1200});assert.equal(fire(drill,'Q',drill.target),true);
  assert.equal(fire(drill,'E',drill.target),false);step(drill,2);
  assert.equal(drill.last.hit,false);assert.equal(drill.last.returnHit,false);assert.equal(drill.results.Q.shots,1);
  assert.equal(fire(drill,'Q',WORLD.player),false);assert.equal(fire(drill,'X',drill.target),false);
});
test('target movement and shot results are independent of render frame length',()=>{
  const small=createDrill(),large=createDrill();const aim=predictedAim(small,'Q');fire(small,'Q',aim);fire(large,'Q',aim);
  for(let i=0;i<156;i++)step(small,1/120);
  for(let i=0;i<26;i++)step(large,0.05);
  close(small.target.x,large.target.x);assert.deepEqual(small.results,large.results);
  close(SPELLS.Q.delay+900/SPELLS.Q.speed,0.8125);
});
