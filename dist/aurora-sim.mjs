// User-supplied spell timings; lane geometry and enemy CS timing are practice approximations.
export const SPELLS = Object.freeze({
  Q: { delay: 0.25, speed: 1600, range: 900, radius: 30 },
  E: { delay: 0.35, range: 900, radius: 45, recoil: 250 }
});
export const WORLD = { width: 2000, height: 1300, player: { x: 1000, y: 1080 }, playerSpeed: 350, targetRadius: 55, laneHalfWidth: 340, creepY: 730, creepRadius: 34, creepDecay: 0.3, csRange: 125, csWindup: 0.55, csThreshold: 1.15 };
const EPS=1e-9;
export function segmentDistance(point,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;
  const t=den?Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/den)):0;
  return Math.hypot(point.x-a.x-t*dx,point.y-a.y-t*dy);
}
export function sweptHit(a,b,targetA,targetB,radius){
  return segmentDistance({x:0,y:0},{x:a.x-targetA.x,y:a.y-targetA.y},{x:b.x-targetB.x,y:b.y-targetB.y})<=radius;
}
function freshWave(){return [820,1000,1180].map((x,i)=>({x,y:WORLD.creepY,hp:1.7+i*0.9,maxHp:3.5,alive:true}));}
export function createDrill({distance=650,speed=350,pattern='predictable'}={}){
  return {distance,speed,pattern,time:0,player:{...WORLD.player},destination:null,recoil:null,
    target:{x:1000,y:WORLD.player.y-distance,vx:0,vy:0,phase:'waiting',csIndex:null,windup:0,stand:null},
    minions:freshWave(),wave:1,shots:[],last:null,lastBySpell:{},
    results:{Q:{shots:0,hits:0},E:{shots:0,hits:0},punishes:0,enemyCs:0}};
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
    direction:{x:dx/length,y:dy/length},aim:{...aim},targetAtCast:{x:drill.target.x,y:drill.target.y},hit:false,punishHit:false,travelled:0});
  return true;
}
export function shotPosition(shot){return {...shot.position};}
function advanceEnemy(drill,dt,random){
  const enemy=drill.target;
  for(const minion of drill.minions){
    if(!minion.alive)continue;
    minion.hp=Math.max(0,minion.hp-WORLD.creepDecay*dt);
    if(minion.hp<=EPS)minion.alive=false;
  }
  if(enemy.csIndex!==null&&!drill.minions[enemy.csIndex].alive){enemy.phase='retreating';enemy.csIndex=null;}
  if(enemy.phase==='waiting'){
    const index=drill.minions.findIndex(m=>m.alive&&m.hp<=WORLD.csThreshold);
    if(index!==-1){
      enemy.csIndex=index;enemy.phase='approaching';
      const minion=drill.minions[index],offset=drill.pattern==='variable'?(random()<0.5?-45:45):0;
      enemy.stand={x:minion.x+offset,y:minion.y-110};
    }
  }
  const before={x:enemy.x,y:enemy.y};
  if(enemy.phase==='approaching'||enemy.phase==='retreating'){
    const goal=enemy.phase==='approaching'?enemy.stand:{x:WORLD.player.x,y:WORLD.player.y-drill.distance};
    const dx=goal.x-enemy.x,dy=goal.y-enemy.y,length=Math.hypot(dx,dy),travel=drill.speed*dt;
    if(length<=travel+EPS){enemy.x=goal.x;enemy.y=goal.y;
      if(enemy.phase==='approaching'){enemy.phase='windup';enemy.windup=0;}
      else{enemy.phase='waiting';enemy.stand=null;}
    }else if(length){enemy.x+=dx/length*travel;enemy.y+=dy/length*travel;}
  }else if(enemy.phase==='windup'){
    enemy.windup+=dt;
    if(enemy.windup>=WORLD.csWindup-EPS){
      const minion=drill.minions[enemy.csIndex];
      if(minion?.alive&&Math.hypot(enemy.x-minion.x,enemy.y-minion.y)<=WORLD.csRange+1){
        minion.hp=Math.max(0,minion.hp-1);
        if(minion.hp<=EPS){minion.alive=false;drill.results.enemyCs++;}
      }
      enemy.phase='retreating';enemy.csIndex=null;
    }
  }
  enemy.vx=(enemy.x-before.x)/dt;enemy.vy=(enemy.y-before.y)/dt;
  if(enemy.phase==='waiting'&&drill.minions.every(m=>!m.alive)){
    drill.minions=freshWave();drill.wave++;
  }
}
function movePlayer(drill,dt){
  if(drill.shots.some(s=>s.phase==='cast'))return;
  if(drill.recoil){
    const recoil=drill.recoil,travel=Math.min(recoil.remaining,(150+2*WORLD.playerSpeed)*dt);
    drill.player=boundedPoint({x:drill.player.x+recoil.direction.x*travel,y:drill.player.y+recoil.direction.y*travel});
    recoil.remaining-=travel;if(recoil.remaining<=EPS)drill.recoil=null;return;
  }
  const target=drill.destination;
  if(!target)return;
  const dx=target.x-drill.player.x,dy=target.y-drill.player.y,length=Math.hypot(dx,dy),travel=WORLD.playerSpeed*dt;
  if(length<=travel){drill.player={x:target.x,y:target.y};drill.destination=null;}
  else{drill.player.x+=dx/length*travel;drill.player.y+=dy/length*travel;}
}
function complete(drill,shot){
  const result=drill.results[shot.spell];result.shots++;if(shot.hit)result.hits++;
  if(shot.punishHit)drill.results.punishes++;
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
    movePlayer(drill,delta);advanceEnemy(drill,delta,random);drill.time+=delta;remaining-=delta;
    const csWindow=drill.target.phase==='approaching'||drill.target.phase==='windup';
    for(const shot of drill.shots){
      const spec=SPELLS[shot.spell],before={...shot.position};shot.elapsed+=delta;
      if(shot.phase==='cast'){
        if(shot.elapsed<spec.delay-EPS)continue;
        if(shot.spell==='Q'){shot.phase='out';continue;}
        const end={x:shot.origin.x+shot.direction.x*spec.range,y:shot.origin.y+shot.direction.y*spec.range};
        shot.hit=segmentDistance(drill.target,shot.origin,end)<=spec.radius+WORLD.targetRadius;
        shot.punishHit=shot.hit&&csWindow;
        drill.recoil={direction:{x:-shot.direction.x,y:-shot.direction.y},remaining:spec.recoil};complete(drill,shot);continue;
      }
      if(shot.phase==='out'){
        shot.travelled=Math.min(spec.range,shot.travelled+spec.speed*delta);
        shot.position={x:shot.origin.x+shot.direction.x*shot.travelled,y:shot.origin.y+shot.direction.y*shot.travelled};
        if(sweptHit(before,shot.position,targetBefore,drill.target,spec.radius+WORLD.targetRadius)){
          if(!shot.hit&&csWindow)shot.punishHit=true;
          shot.hit=true;
        }
        if(shot.travelled>=spec.range-EPS)complete(drill,shot);
      }
    }
    drill.shots=drill.shots.filter(s=>!s.done);
  }
}
export function predictedAim(drill,spell){
  const spec=SPELLS[spell],enemy=drill.target;
  const predict=t=>{
    if(enemy.phase==='waiting'||enemy.phase==='windup')return {x:enemy.x,y:enemy.y};
    if(enemy.phase==='approaching'&&enemy.stand){
      const arrival=Math.hypot(enemy.stand.x-enemy.x,enemy.stand.y-enemy.y)/Math.max(drill.speed,1);
      return t>=arrival?{x:enemy.stand.x,y:enemy.stand.y}:{x:enemy.x+enemy.vx*t,y:enemy.y+enemy.vy*t};
    }
    return {x:enemy.x+enemy.vx*t,y:enemy.y+enemy.vy*t};
  };
  let time=spec.delay;
  for(let i=0;i<12&&spell==='Q';i++){
    const point=predict(time);time=spec.delay+Math.hypot(point.x-drill.player.x,point.y-drill.player.y)/spec.speed;
  }
  return {...predict(time),time};
}
