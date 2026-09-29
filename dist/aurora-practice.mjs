import {SPELLS,WORLD,createDrill,fire,canFire,moveTo,stopMoving,step,shotPosition,predictedAim} from './aurora-sim.mjs';

export function mountAuroraPractice(root){
  root.innerHTML=`
    <div class="board-heading"><div class="practice-title"><img src="/assets/champions/Aurora.png" width="52" height="52" alt=""><div><span class="eyebrow">MOVEMENT PREDICTION</span><h2 id="practice-title">Aurora practice</h2></div></div><button id="practice-reset">Reset drill</button></div>
    <div class="practice-controls">
      <label>Aim guide / Space<select id="practice-spell" aria-label="Spell"><option value="Q">Q · Twofold Hex</option><option value="E">E · The Weirding</option></select></label>
      <label>Target movement<select id="practice-pattern" aria-label="Movement"><option value="strafe">Steady strafe</option><option value="jukes">Random jukes</option></select></label>
      <label>Starting distance <output id="practice-distance-value">650 units</output><input id="practice-distance" type="range" min="250" max="850" step="50" value="650"></label>
      <label>Target speed <output id="practice-speed-value">350 units/s</output><input id="practice-speed" type="range" min="0" max="500" step="25" value="350"></label>
    </div>
    <div class="practice-toolbar"><button id="practice-pause" class="primary">Start</button><button id="practice-attack" disabled>Attack minion</button><button id="practice-q" aria-label="Cast Q" disabled>Q · Ready</button><button id="practice-e" aria-label="Cast E" disabled>E · Ready</button><label class="practice-guide"><input id="practice-guide" type="checkbox"> Show lead guide</label><span id="practice-timing"></span></div>
    <p id="practice-instructions" class="hint">Right-click the enemy minion to walk into melee range and keep attacking; left-click ground to move. Aim with the cursor, then press Q and E—even together. Arrow keys move; S stops; Space casts the selected spell. On touch, tap ground to move and use the Attack, Q, and E buttons.</p>
    <canvas id="practice-canvas" width="1000" height="650" tabindex="0" aria-label="Aurora lane and skillshot practice arena" aria-describedby="practice-instructions">Use a browser with Canvas support for the moving-target lane drill.</canvas>
    <div class="practice-feedback"><span id="practice-feedback" role="status">Ready · right-click a minion to approach and attack.</span><span id="practice-score">Q: 0/0 hits · E: 0/0 hits · Melee: 0</span></div>
    <details class="practice-model"><summary>Timing model and drill limits</summary><p>Q winds up for 0.25 s, travels out at 1600 units/s, and ends at 900 units. E resolves after 0.35 s. Q and E have independent cast timers: pressing both starts overlapping windups. Walking pauses during windups and resumes afterward. Move commands can be issued while casting.</p><p>Aurora walks at 350 units/s. Right-clicking the enemy melee minion starts an approach and repeating basic attack order; Aurora stops at melee range. The minion stays within the lane and has a short strafe/juke pattern. Basic attacks repeat every 0.85 s; the target resets after three hits. E hops backward 250 units at 850 units/s; hop distance is a practice approximation. This drill practices only the initial Q cast. Each spell becomes ready when its effect ends; this rapid drill omits spell cooldowns, mana, R, and network latency. Hitboxes remain simplified. Timings use the supplied drill parameters, not a frame-perfect live-game simulation. Results are temporary for this page session.</p></details>`;
  const $=s=>root.querySelector(s),canvas=$('#practice-canvas'),ctx=canvas.getContext('2d');
  let drill=createDrill(),aim={x:1000,y:430},active=false,running=false,frame=null,lastTime=0,lastResult=null;
  const held=new Set(),arrows={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
  function options(){return {distance:Number($('#practice-distance').value),speed:Number($('#practice-speed').value),pattern:$('#practice-pattern').value};}
  function selected(){return $('#practice-spell').value;}
  function status(text){$('#practice-feedback').textContent=text;}
  function controls(){
    $('#practice-pause').textContent=running?'Pause':drill.time?'Resume':'Start';
    const meleeDistance=Math.hypot(drill.target.x-drill.player.x,drill.target.y-drill.player.y);
    $('#practice-attack').disabled=!running;$('#practice-attack').textContent=drill.attackOrder?(meleeDistance<=WORLD.meleeRange+WORLD.targetRadius+1?'Attacking minion':'Approaching minion…'):'Attack minion';
    for(const spell of ['Q','E']){const b=$('#practice-'+spell.toLowerCase()),shot=drill.shots.find(s=>s.spell===spell);b.disabled=!running||!canFire(drill,spell);
      b.textContent=shot?`${spell} · ${shot.phase==='cast'?`${(SPELLS[spell].delay-shot.elapsed).toFixed(2)} s`:'In flight'}`:spell==='E'&&drill.recoil?'E · Hopping':`${spell} · Ready`;
    }
    const distance=Math.hypot(drill.target.x-drill.player.x,drill.target.y-drill.player.y);
    $('#practice-timing').textContent=drill.attackOrder?(distance<=WORLD.meleeRange+WORLD.targetRadius+1?'Melee range · attacking':`${Math.round(distance-(WORLD.meleeRange+WORLD.targetRadius))} units to melee range`):selected()==='Q'?`${Math.round(distance)} units · ${(SPELLS.Q.delay+distance/SPELLS.Q.speed).toFixed(3)} s${distance>900?' · out of range':''}`:'E · 0.350 s windup';
    const {Q,E,melee}=drill.results;$('#practice-score').textContent=`Q: ${Q.hits}/${Q.shots} hits · E: ${E.hits}/${E.shots} hits · Melee: ${melee}`;
  }
  function circle(x,y,r,fill,stroke){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
  function line(a,b,color,width=3,dashed=false){ctx.beginPath();ctx.setLineDash(dashed?[12,12]:[]);ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();ctx.setLineDash([]);}
  function label(text,x,y,color='#a5bac8',size=25){ctx.fillStyle=color;ctx.font=`${Math.max(size,11*WORLD.width/Math.max(1,canvas.clientWidth))}px "Segoe UI", sans-serif`;ctx.textAlign='center';ctx.fillText(text,x,y);}
  function cross(p,color){line({x:p.x-15,y:p.y},{x:p.x+15,y:p.y},color,3);line({x:p.x,y:p.y-15},{x:p.x,y:p.y+15},color,3);}
  function character(){
    const p=drill.player,scale=Math.max(1,30*WORLD.width/Math.max(1,canvas.clientWidth)/80),walking=drill.destination&&!drill.shots.some(s=>s.phase==='cast')&&!drill.recoil;
    circle(p.x,p.y,48,null,'#6fd9be');
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(aim.y-p.y,aim.x-p.x)+Math.PI/2);ctx.scale(scale,scale);
    const stride=walking?Math.sin(drill.time*15)*7:0;
    ctx.fillStyle='#30243d';ctx.beginPath();ctx.ellipse(0,16,34,25,0,0,Math.PI*2);ctx.fill();
    line({x:-14,y:22},{x:-14,y:42+stride},'#aa725c',12);line({x:14,y:22},{x:14,y:42-stride},'#aa725c',12);
    ctx.fillStyle='#855baa';ctx.strokeStyle='#cf9eef';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-29);ctx.lineTo(-32,28);ctx.quadraticCurveTo(0,42,32,28);ctx.closePath();ctx.fill();ctx.stroke();
    line({x:-11,y:-23},{x:-17,y:-64},'#cfadc4',10);line({x:11,y:-23},{x:17,y:-64},'#cfadc4',10);
    line({x:-11,y:-33},{x:-17,y:-59},'#f0c9d6',4);line({x:11,y:-33},{x:17,y:-59},'#f0c9d6',4);
    circle(0,-20,21,'#b3717c');circle(0,-24,15,'#efc7b7');circle(-7,-30,6,null,'#3b2941');circle(7,-30,6,null,'#3b2941');
    line({x:25,y:23},{x:30,y:-32},'#c9b080',5);circle(30,-37,9,'#bcf5db','#8dccb7');
    ctx.restore();label('Aurora',p.x,p.y+(p.y>1080?-115:85)*scale,'#d7afff');
    const casts=drill.shots.filter(s=>s.phase==='cast');
    casts.forEach((s,i)=>{const y=p.y+(p.y>1080?-155:105)*scale+i*20,x=p.x-65,progress=s.elapsed/SPELLS[s.spell].delay;line({x,y},{x:x+130,y},'#293449',10);line({x,y},{x:x+130*progress,y},s.spell==='Q'?'#dba4ff':'#79e7cf',10);});
  }
  function draw(){
    const ratio=window.devicePixelRatio||1,width=Math.max(1,Math.round(canvas.clientWidth*ratio)),height=Math.round(width*WORLD.height/WORLD.width);
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
    ctx.setTransform(width/WORLD.width,0,0,height/WORLD.height,0,0);ctx.clearRect(0,0,WORLD.width,WORLD.height);
    ctx.fillStyle='#0a1420';ctx.fillRect(0,0,WORLD.width,WORLD.height);
    ctx.fillStyle='#111f2a';ctx.fillRect(620,0,760,WORLD.height);
    line({x:660,y:0},{x:660,y:WORLD.height},'#465364',3);line({x:1340,y:0},{x:1340,y:WORLD.height},'#465364',3);
    ctx.fillStyle='#19232a';ctx.fillRect(660,0,680,WORLD.height);
    for(let x=0;x<=WORLD.width;x+=100)line({x,y:0},{x,y:WORLD.height},'#122330',1);
    for(let y=0;y<=WORLD.height;y+=100)line({x:0,y},{x:WORLD.width,y},'#122330',1);
    ctx.lineWidth=2;ctx.setLineDash([9,13]);circle(drill.player.x,drill.player.y,900,null,'#354658');ctx.setLineDash([]);
    if(drill.attackOrder){ctx.setLineDash([9,12]);ctx.beginPath();ctx.arc(drill.player.x,drill.player.y,WORLD.meleeRange+WORLD.targetRadius,0,Math.PI*2);ctx.strokeStyle='#d5b976';ctx.lineWidth=2;ctx.stroke();ctx.setLineDash([]);}
    label('LANE · Q range 900',1000,65,'#72899b',22);line({x:660,y:drill.target.y},{x:1340,y:drill.target.y},'#59646b',3,true);
    if(drill.destination){line(drill.player,drill.destination,'#40836f',2,true);circle(drill.destination.x,drill.destination.y,20,null,'#75e6ad');cross(drill.destination,'#75e6ad');}
    if($('#practice-guide').checked){const prediction=predictedAim(drill,selected());line(drill.target,prediction,'#a6ce8f',2,true);circle(prediction.x,prediction.y,WORLD.targetRadius,null,'#a6ce8f');}
    line(drill.player,aim,'#69547d',2,true);cross(aim,'#d4b477');
    for(const shot of drill.shots){const spec=SPELLS[shot.spell],end={x:shot.origin.x+shot.direction.x*spec.range,y:shot.origin.y+shot.direction.y*spec.range};
      if(shot.phase==='cast'){line(shot.origin,end,shot.spell==='Q'?'#b58bd4':'#72b9a9',3,true);circle(drill.player.x,drill.player.y,75+25*shot.elapsed/spec.delay,null,'#dfbeff');}
      else if(shot.spell==='Q'){const p=shotPosition(shot);circle(p.x,p.y,spec.radius,'#dba4ff');}
    }
    const blast=drill.lastBySpell.E;
    if(blast&&drill.time-blast.finishedAt<0.25)line(blast.origin,{x:blast.origin.x+blast.direction.x*900,y:blast.origin.y+blast.direction.y*900},blast.hit?'#8aead0':'#bd9ae0',90);
    const hit=drill.shots.some(s=>s.hit)||(drill.last?.hit&&drill.time-drill.last.finishedAt<0.35);
    ctx.lineWidth=4;circle(drill.target.x,drill.target.y,WORLD.targetRadius,hit?'#267f73':'#743b4a',hit?'#96efcf':'#e69aa5');
    circle(drill.target.x,drill.target.y,18,'#c99562','#f0d49d');circle(drill.target.x-13,drill.target.y-4,5,'#151820');circle(drill.target.x+13,drill.target.y-4,5,'#151820');
    if(drill.attackFlash)line({x:drill.player.x,y:drill.player.y-10},{x:drill.target.x,y:drill.target.y},'#ffe09a',9);
    const hpWidth=96;ctx.fillStyle='#20202a';ctx.fillRect(drill.target.x-hpWidth/2,drill.target.y-82,hpWidth,12);ctx.fillStyle='#d97775';ctx.fillRect(drill.target.x-hpWidth/2,drill.target.y-82,hpWidth*drill.target.hp/3,12);
    label('Enemy melee minion',drill.target.x,drill.target.y-100,'#e6c3a9',22);
    character();
    if(!running){ctx.fillStyle='#080f1770';ctx.fillRect(0,0,WORLD.width,WORLD.height);label(drill.time?'Paused · Resume to continue':'Start · right-click minion to attack · Q/E to cast',1000,650,'#e8edf0',36);}
  }
  function tick(timestamp){
    frame=null;if(!active||!running||document.hidden)return;const dt=lastTime?Math.min((timestamp-lastTime)/1000,0.05):0;lastTime=timestamp;
    if(held.size){let x=0,y=0;for(const key of held){x+=arrows[key][0];y+=arrows[key][1];}if(x||y)moveTo(drill,{x:drill.player.x+x*150,y:drill.player.y+y*150});else stopMoving(drill);}
    step(drill,dt);
    if(drill.last&&lastResult!==drill.last){lastResult=drill.last;status(`${drill.last.spell} ${drill.last.hit?'hit':'missed'}`);}
    controls();draw();frame=requestAnimationFrame(tick);
  }
  function pause(){running=false;lastTime=0;if(held.size)stopMoving(drill);held.clear();cancelAnimationFrame(frame);frame=null;controls();if(active)draw();}
  function cast(spell=selected()){
    if(!running||!active)return;
    if(fire(drill,spell,aim)){$('#practice-spell').value=spell;status(`${drill.shots.filter(s=>s.phase==='cast').map(s=>s.spell).join(' + ')||spell} casting…`);controls();draw();}
  }
  function attack(){if(!running||!active)return;attackTarget(drill);status('Approaching minion · basic attacks begin in melee range.');controls();draw();}
  function reset(){pause();drill=createDrill(options());aim={x:1000,y:1080-drill.distance};lastResult=null;status('Ready · right-click a minion to approach and attack.');controls();draw();}
  $('#practice-reset').onclick=reset;
  $('#practice-pause').onclick=()=>{if(running){pause();status('Paused.');}else{running=true;lastTime=0;controls();status('Right-click the minion to approach and attack.');frame=requestAnimationFrame(tick);canvas.focus({preventScroll:true});}};
  for(const spell of ['Q','E'])$('#practice-'+spell.toLowerCase()).onclick=()=>{cast(spell);canvas.focus({preventScroll:true});};
  $('#practice-attack').onclick=()=>{attack();canvas.focus({preventScroll:true});};
  $('#practice-spell').onchange=()=>{controls();draw();};$('#practice-pattern').onchange=reset;
  for(const field of ['distance','speed'])$('#practice-'+field).oninput=()=>{$('#practice-'+field+'-value').textContent=$('#practice-'+field).value+(field==='distance'?' units':' units/s');reset();};
  $('#practice-guide').onchange=draw;
  function pointer(event){const rect=canvas.getBoundingClientRect();aim={x:Math.max(0,Math.min(WORLD.width,(event.clientX-rect.left)/rect.width*WORLD.width)),y:Math.max(0,Math.min(WORLD.height,(event.clientY-rect.top)/rect.height*WORLD.height))};if(!running)draw();}
  canvas.addEventListener('pointermove',pointer);
  canvas.addEventListener('contextmenu',event=>event.preventDefault());
  canvas.addEventListener('pointerdown',event=>{if(![0,2].includes(event.button))return;event.preventDefault();pointer(event);canvas.focus({preventScroll:true});if(!running)return;const distance=Math.hypot(aim.x-drill.target.x,aim.y-drill.target.y);if(event.button===2&&distance<=WORLD.targetRadius+15){attackTarget(drill);status('Approaching minion · basic attacks begin in melee range.');}else if(event.button===2){stopMoving(drill);status('Movement stopped.');}else moveTo(drill,aim);});
  canvas.addEventListener('keydown',event=>{
    if(event.ctrlKey||event.metaKey||event.altKey)return;
    if(arrows[event.key]){event.preventDefault();if(running)held.add(event.key);}
    if(event.key.toLowerCase()==='s'){event.preventDefault();held.clear();stopMoving(drill);controls();draw();}
    if(event.key.toLowerCase()==='a'){event.preventDefault();if(!event.repeat)attack();}
    if(event.code==='Space'||['q','e'].includes(event.key.toLowerCase())){event.preventDefault();if(!event.repeat)cast(event.code==='Space'?selected():event.key.toUpperCase());}
  });
  window.addEventListener('keyup',event=>{if(held.delete(event.key)&&!held.size)stopMoving(drill);});
  canvas.addEventListener('blur',()=>{if(held.size)stopMoving(drill);held.clear();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  document.addEventListener('focusin',event=>{if(running&&!root.contains(event.target))pause();});window.addEventListener('blur',pause);
  new ResizeObserver(()=>{if(active)draw();}).observe(canvas);controls();
  return {setActive(value){active=value;if(!value)pause();else{controls();draw();}}};
}
