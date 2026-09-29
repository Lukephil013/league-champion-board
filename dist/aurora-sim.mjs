// User-supplied timings; hitboxes and recoil distance are practice geometry.
export const SPELLS = Object.freeze({
  Q: { delay: 0.25, speed: 1600, range: 900, radius: 30 },
  E: { delay: 0.35, range: 900, radius: 45, recoil: 250 }
});
export const WORLD = { width: 2000, height: 1300, player: { x: 1000, y: 1080 }, playerSpeed: 350, targetRadius: 55, laneHalfWidth: 340 };
const EPS=1e-9;
export function segmentDistance(point,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;
  const t=den?Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/den)):0;
  return Math.hypot(point.x-a.x-t*dx,point.y-a.y-t*dy);
}
export function sweptHit(a,b,targetA,targetB,radius){
  return segmentDistance({x:0,y:0},{x:a.x-targetA.x,y:a.y-targetA.y},{x:b.x-targetB.x,y:b.y-targetB.y})<=radius;
}
export function createDrill({distance=650,speed=350,pattern='strafe'}={}){
  return {distance,speed,pattern,time:0,player:{...WORLD.player},destination:null,recoil:null,
    target:{x:1000,y:1080-distance,direction:1,nextJuke:1},shots:[],last:null,lastBySpell:{},
    results:{Q:{shots:0,hits:0},E:{shots:0,hits:0}}};
}
export function boundedPoint(point){return {x:Math.max(85,Math.min(WORLD.width-85,point.x)),y:Math.max(85,Math.min(WORLD.height-85,point.y))};}
export function moveTo(drill,point){
  if(!Number.isFinite(point.x)||!Number.isFinite(point.y))return;
  drill.destination=boundedPoint(point);
}
export function stopMoving(drill){drill.destination=null;}
export function canFire(drill,spell){return Boolean(SPELLS[spell])&&!drill.shots.some(s=>s.spell===spell)&&!(spell==='E'&&drill.recoil);}
export function fire(drill,spell,aim){
  if(!canFire(drill,spell))return false;
  const dx=aim.x-drill.player.x,dy=aim.y-drill.player.y,length=Math.hypot(dx,dy);
  if(!Number.isFinite(length)||length<1)return false;
  drill.shots.push({spell,elapsed:0,phase:'cast',origin:{...drill.player},position:{...drill.player},
    direction:{x:dx/length,y:dy/length},aim:{...aim},targetAtCast:{x:drill.target.x,y:drill.target.y},hit:false,travelled:0});
  return true;
}
export function shotPosition(shot){return {...shot.position};}
function moveTarget(drill,dt,random){
  if(drill.pattern==='jukes'&&drill.time>=drill.target.nextJuke){drill.target.direction*=-1;drill.target.nextJuke=drill.time+0.45+random()*1.1;}
  const target=drill.target,low=WORLD.player.x-WORLD.laneHalfWidth,high=WORLD.player.x+WORLD.laneHalfWidth;
  target.x+=target.direction*drill.speed*dt;
  if(target.x>high){target.x=2*high-target.x;target.direction=-1;}
  if(target.x<low){target.x=2*low-target.x;target.direction=1;}
}
function movePlayer(drill,dt){
  if(drill.shots.some(s=>s.phase==='cast'))return;
  if(drill.recoil){
    const recoil=drill.recoil,travel=Math.min(recoil.remaining,(150+2*WORLD.playerSpeed)*dt);
    drill.player=boundedPoint({x:drill.player.x+recoil.direction.x*travel,y:drill.player.y+recoil.direction.y*travel});
    recoil.remaining-=travel;if(recoil.remaining<=EPS)drill.recoil=null;return;
  }
  if(!drill.destination)return;
  const dx=drill.destination.x-drill.player.x,dy=drill.destination.y-drill.player.y,length=Math.hypot(dx,dy),travel=WORLD.playerSpeed*dt;
  if(length<=travel){drill.player={...drill.destination};drill.destination=null;}
  else{drill.player.x+=dx/length*travel;drill.player.y+=dy/length*travel;}
}
function complete(drill,shot){
  const result=drill.results[shot.spell];result.shots++;if(shot.hit)result.hits++;
  drill.last={...shot,finishedAt:drill.time,targetAtFinish:{x:drill.target.x,y:drill.target.y}};
  drill.lastBySpell[shot.spell]=drill.last;shot.done=true;
}
export function step(drill,dt,random=Math.random){
  if(!Number.isFinite(dt)||dt<=0)return;
  let remaining=dt;
  while(remaining>EPS){
    // Exact phase boundaries, then swept collision in steps <= 1/120 second.
    let delta=Math.min(remaining,1/120);
    for(const shot of drill.shots){const spec=SPELLS[shot.spell];
      if(shot.phase==='cast')delta=Math.min(delta,spec.delay-shot.elapsed);
      if(shot.phase==='out')delta=Math.min(delta,(spec.range-shot.travelled)/spec.speed);
    }
    const targetBefore={x:drill.target.x,y:drill.target.y};
    movePlayer(drill,delta);moveTarget(drill,delta,random);drill.time+=delta;remaining-=delta;
    for(const shot of drill.shots){
      const spec=SPELLS[shot.spell],before={...shot.position};shot.elapsed+=delta;
      if(shot.phase==='cast'){
        if(shot.elapsed<spec.delay-EPS)continue;
        if(shot.spell==='Q'){shot.phase='out';continue;}
        const end={x:shot.origin.x+shot.direction.x*spec.range,y:shot.origin.y+shot.direction.y*spec.range};
        shot.hit=segmentDistance(drill.target,shot.origin,end)<=spec.radius+WORLD.targetRadius;
        drill.recoil={direction:{x:-shot.direction.x,y:-shot.direction.y},remaining:spec.recoil};complete(drill,shot);continue;
      }
      if(shot.phase==='out'){
        shot.travelled=Math.min(spec.range,shot.travelled+spec.speed*delta);
        shot.position={x:shot.origin.x+shot.direction.x*shot.travelled,y:shot.origin.y+shot.direction.y*shot.travelled};
        if(sweptHit(before,shot.position,targetBefore,drill.target,spec.radius+WORLD.targetRadius))shot.hit=true;
        if(shot.travelled>=spec.range-EPS)complete(drill,shot);
      }
    }
    drill.shots=drill.shots.filter(s=>!s.done);
  }
}
export function predictedAim(drill,spell){
  const spec=SPELLS[spell],velocity=drill.target.direction*drill.speed;let time=spec.delay;
  for(let i=0;i<12&&spell==='Q';i++)time=spec.delay+Math.hypot(drill.target.x+velocity*time-drill.player.x,drill.target.y-drill.player.y)/spec.speed;
  return {x:drill.target.x+velocity*time,y:drill.target.y,time};
}
