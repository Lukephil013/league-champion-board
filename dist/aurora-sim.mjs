// Timings supplied for this drill. Geometry is a training approximation.
export const SPELLS = Object.freeze({
  Q: { delay: 0.25, speed: 1600, returnSpeed: 2000, range: 900, radius: 30 },
  E: { delay: 0.35, range: 900, radius: 45 }
});
export const WORLD = { width: 2000, height: 1300, player: { x: 1000, y: 1080 }, targetRadius: 55, laneHalfWidth: 340 };
export function segmentDistance(point, a, b) {
  const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;
  const t=den?Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/den)):0;
  return Math.hypot(point.x-a.x-t*dx,point.y-a.y-t*dy);
}
export function sweptHit(a,b,targetA,targetB,radius) {
  return segmentDistance({x:0,y:0},{x:a.x-targetA.x,y:a.y-targetA.y},{x:b.x-targetB.x,y:b.y-targetB.y})<=radius;
}
export function createDrill({distance=650,speed=350,pattern='strafe'}={}) {
  return {distance,speed,pattern,time:0,target:{x:1000,y:1080-distance,direction:1,nextJuke:1},shot:null,last:null,results:{Q:{shots:0,hits:0,returns:0},E:{shots:0,hits:0}}};
}
export function fire(drill,spell,aim) {
  if(drill.shot||!SPELLS[spell])return false;
  const dx=aim.x-WORLD.player.x,dy=aim.y-WORLD.player.y,length=Math.hypot(dx,dy);
  if(!Number.isFinite(length)||length<1)return false;
  drill.shot={spell,elapsed:0,direction:{x:dx/length,y:dy/length},aim:{...aim},targetAtCast:{x:drill.target.x,y:drill.target.y},hit:false,returnHit:false};
  return true;
}
export function shotPosition(shot) {
  const spec=SPELLS[shot.spell];
  let distance=0;
  if(shot.spell==='Q'){
    const elapsed=Math.max(0,shot.elapsed-spec.delay),outbound=spec.range/spec.speed;
    distance=elapsed<=outbound?elapsed*spec.speed:Math.max(0,spec.range-(elapsed-outbound)*spec.returnSpeed);
  }
  return {x:WORLD.player.x+shot.direction.x*distance,y:WORLD.player.y+shot.direction.y*distance};
}
function moveTarget(drill,dt,random) {
  if(drill.pattern==='jukes'&&drill.time>=drill.target.nextJuke){drill.target.direction*=-1;drill.target.nextJuke=drill.time+0.45+random()*1.1;}
  const target=drill.target,low=WORLD.player.x-WORLD.laneHalfWidth,high=WORLD.player.x+WORLD.laneHalfWidth;
  target.x+=target.direction*drill.speed*dt;
  if(target.x>high){target.x=2*high-target.x;target.direction=-1;}
  if(target.x<low){target.x=2*low-target.x;target.direction=1;}
}
export function step(drill,dt,random=Math.random) {
  // Split at spell boundaries and small time steps; collision uses relative motion
  // so fast missiles cannot jump over a moving target between rendered frames.
  let remaining=dt;
  while(remaining>1e-9){
    const shot=drill.shot,spec=shot&&SPELLS[shot.spell];
    const boundaries=shot?(shot.spell==='Q'?[spec.delay,spec.delay+spec.range/spec.speed,spec.delay+spec.range/spec.speed+spec.range/spec.returnSpeed]:[spec.delay]):[];
    const boundary=boundaries.find(t=>t>shot.elapsed+1e-9);
    const delta=Math.min(remaining,1/120,boundary===undefined?Infinity:boundary-shot.elapsed);
    const targetBefore={x:drill.target.x,y:drill.target.y};
    const positionBefore=shot&&shotPosition(shot);
    moveTarget(drill,delta,random);drill.time+=delta;remaining-=delta;
    if(!shot)continue;
    const before=shot.elapsed;shot.elapsed+=delta;
    if(shot.spell==='E'&&shot.elapsed>=spec.delay-1e-9){
      const end={x:WORLD.player.x+shot.direction.x*spec.range,y:WORLD.player.y+shot.direction.y*spec.range};
      shot.hit=segmentDistance(drill.target,WORLD.player,end)<=spec.radius+WORLD.targetRadius;
    }
    if(shot.spell==='Q'&&before>=spec.delay-1e-9){
      const returning=before>=spec.delay+spec.range/spec.speed-1e-9;
      if(sweptHit(positionBefore,shotPosition(shot),targetBefore,drill.target,spec.radius+WORLD.targetRadius)){
        shot[returning?'returnHit':'hit']=true;
      }
    }
    if(shot.elapsed>=boundaries.at(-1)-1e-9){
      const result=drill.results[shot.spell];result.shots++;if(shot.hit)result.hits++;if(shot.returnHit)result.returns++;
      drill.last={...shot,finishedAt:drill.time,targetAtFinish:{x:drill.target.x,y:drill.target.y}};
      drill.shot=null;
    }
  }
}
export function predictedAim(drill,spell) {
  const spec=SPELLS[spell],velocity=drill.target.direction*drill.speed;
  let time=spec.delay;
  // Constant-velocity guide deliberately does not know future jukes or turns.
  for(let i=0;i<12&&spell==='Q';i++)time=spec.delay+Math.hypot(drill.target.x+velocity*time-WORLD.player.x,drill.target.y-WORLD.player.y)/spec.speed;
  return {x:drill.target.x+velocity*time,y:drill.target.y,time};
}
