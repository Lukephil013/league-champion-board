import {SPELLS,WORLD,createDrill,fire,step,shotPosition,predictedAim} from './aurora-sim.mjs';

export function mountAuroraPractice(root) {
  root.innerHTML=`
    <div class="board-heading"><div class="practice-title"><img src="/assets/champions/Aurora.png" width="52" height="52" alt=""><div><span class="eyebrow">MOVEMENT PREDICTION</span><h2 id="practice-title">Aurora practice</h2></div></div><button id="practice-reset">Reset drill</button></div>
    <div class="practice-controls">
      <label>Spell<select id="practice-spell" aria-label="Spell"><option value="Q">Q · Twofold Hex</option><option value="E">E · The Weirding</option></select></label>
      <label>Movement<select id="practice-pattern" aria-label="Movement"><option value="strafe">Steady strafe</option><option value="jukes">Random jukes</option></select></label>
      <label>Lane distance <output id="practice-distance-value">650 units</output><input id="practice-distance" type="range" min="250" max="850" step="50" value="650"></label>
      <label>Target speed <output id="practice-speed-value">350 units/s</output><input id="practice-speed" type="range" min="0" max="500" step="25" value="350"></label>
    </div>
    <div class="practice-toolbar"><button id="practice-pause" class="primary">Start</button><button id="practice-cast" disabled>Cast Q</button><label class="practice-guide"><input id="practice-guide" type="checkbox"> Show lead guide</label><span id="practice-timing"></span></div>
    <p id="practice-instructions" class="hint">Click or tap ahead of the target to cast. With the arena focused: Q or E casts, arrow keys adjust aim, Space casts the selected spell. Start to begin.</p>
    <canvas id="practice-canvas" width="1000" height="650" tabindex="0" aria-label="Aurora skillshot practice arena" aria-describedby="practice-instructions">Use a browser with Canvas support for the moving-target drill.</canvas>
    <div class="practice-feedback"><span id="practice-feedback" role="status">Ready · aim ahead of the moving target.</span><span id="practice-score">Q: 0/0 hits · return: 0 · E: 0/0 hits</span></div>
    <details class="practice-model"><summary>Timing model and drill limits</summary><p>Using the timings you supplied: Q casts for 0.25 s, travels out at 1600 units/s, and returns at 2000 units/s. At 450 units the outbound prediction window is 0.531 s; at 900 units it is 0.813 s. E resolves as a line after 0.35 s.</p><p>Q range is 900 units. For this prototype, Q returns automatically at maximum range; the return is a separate timing exercise without mark or recast rules. Aurora stays still. Target radius (55), Q radius (30), E half-width (45), and E range (900) are practice geometry, not verified game hitboxes. No latency, cooldowns, E recoil, or R simulation. The lead guide assumes the target keeps its current direction. Results last only for this page session.</p></details>`;
  const $=selector=>root.querySelector(selector),canvas=$('#practice-canvas'),ctx=canvas.getContext('2d');
  let drill=createDrill(),aim={x:1000,y:430},active=false,running=false,frame=null,lastTime=0,lastResult=null;
  const portrait=new Image();portrait.src='/assets/champions/Aurora.png';portrait.onload=()=>{if(active)draw();};
  function options(){return {distance:Number($('#practice-distance').value),speed:Number($('#practice-speed').value),pattern:$('#practice-pattern').value};}
  function selected(){return $('#practice-spell').value;}
  function status(text){$('#practice-feedback').textContent=text;}
  function controls(){
    $('#practice-pause').textContent=running?'Pause':drill.time?'Resume':'Start';
    $('#practice-cast').disabled=!running||!!drill.shot;
    $('#practice-cast').textContent=`Cast ${selected()}`;
    const distance=Math.hypot(drill.target.x-WORLD.player.x,drill.target.y-WORLD.player.y),spell=selected();
    $('#practice-timing').textContent=spell==='Q'?`${Math.round(distance)} units · ${(SPELLS.Q.delay+distance/SPELLS.Q.speed).toFixed(3)} s to target distance`:'E · 0.350 s to line blast';
    const {Q,E}=drill.results;$('#practice-score').textContent=`Q: ${Q.hits}/${Q.shots} hits · return: ${Q.returns} · E: ${E.hits}/${E.shots} hits`;
  }
  function circle(x,y,r,fill,stroke){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
  function line(a,b,color,width=3,dashed=false){ctx.beginPath();ctx.setLineDash(dashed?[12,12]:[]);ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();ctx.setLineDash([]);}
  function label(text,x,y,color='#a5bac8',size=25){ctx.fillStyle=color;ctx.font=`${Math.max(size,11*WORLD.width/Math.max(1,canvas.clientWidth))}px "Segoe UI", sans-serif`;ctx.textAlign='center';ctx.fillText(text,x,y);}
  function cross(point,color){line({x:point.x-15,y:point.y},{x:point.x+15,y:point.y},color,3);line({x:point.x,y:point.y-15},{x:point.x,y:point.y+15},color,3);}
  function draw(){
    const ratio=window.devicePixelRatio||1,width=Math.max(1,Math.round(canvas.clientWidth*ratio)),height=Math.round(width*WORLD.height/WORLD.width);
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
    ctx.setTransform(width/WORLD.width,0,0,height/WORLD.height,0,0);ctx.clearRect(0,0,WORLD.width,WORLD.height);
    ctx.fillStyle='#0a1420';ctx.fillRect(0,0,WORLD.width,WORLD.height);
    for(let x=0;x<=WORLD.width;x+=100)line({x,y:0},{x,y:WORLD.height},'#122330',1);
    for(let y=0;y<=WORLD.height;y+=100)line({x:0,y},{x:WORLD.width,y},'#122330',1);
    ctx.lineWidth=2;ctx.setLineDash([9,13]);circle(WORLD.player.x,WORLD.player.y,900,null,'#354658');ctx.setLineDash([]);
    label('900-unit practice range',1000,140,'#72899b',22);
    line({x:660,y:drill.target.y},{x:1340,y:drill.target.y},'#3a4c5e',2,true);
    if($('#practice-guide').checked){const prediction=predictedAim(drill,selected());line(drill.target,prediction,'#a6ce8f',2,true);circle(prediction.x,prediction.y,WORLD.targetRadius,null,'#a6ce8f');label('Lead if direction holds',prediction.x,prediction.y-80,'#a6ce8f',22);}
    line(WORLD.player,aim,'#69547d',2,true);cross(aim,'#d4b477');
    if(drill.shot){const shot=drill.shot,spec=SPELLS[shot.spell],end={x:WORLD.player.x+shot.direction.x*spec.range,y:WORLD.player.y+shot.direction.y*spec.range};
      line(WORLD.player,end,'#786995',3,true);circle(shot.targetAtCast.x,shot.targetAtCast.y,55,null,'#556273');
      if(shot.elapsed<spec.delay){circle(WORLD.player.x,WORLD.player.y,75+25*shot.elapsed/spec.delay,null,'#dfbeff');label(`Casting ${shot.spell}`,1000,1230,'#dfbeff');}
      else if(shot.spell==='Q'){const p=shotPosition(shot),returning=shot.elapsed>=spec.delay+spec.range/spec.speed;circle(p.x,p.y,spec.radius,returning?'#74e4ca':'#dba4ff');}
    }
    if(drill.last&&drill.time-drill.last.finishedAt<0.28&&drill.last.spell==='E'){const s=drill.last;line(WORLD.player,{x:WORLD.player.x+s.direction.x*900,y:WORLD.player.y+s.direction.y*900},s.hit?'#8aead0':'#bd9ae0',90);}
    const hit=drill.shot?.hit||drill.shot?.returnHit||(drill.last?.hit&&drill.time-drill.last.finishedAt<0.35);
    ctx.lineWidth=4;circle(drill.target.x,drill.target.y,WORLD.targetRadius,hit?'#267f73':'#743b4a',hit?'#96efcf':'#e69aa5');
    label(drill.speed?drill.target.direction>0?'→':'←':'•',drill.target.x,drill.target.y+11,'#fff',38);
    label('Target',drill.target.x,drill.target.y-80);
    circle(WORLD.player.x,WORLD.player.y,48,'#604179','#d7afff');
    if(portrait.complete&&portrait.naturalWidth){ctx.save();ctx.beginPath();ctx.arc(WORLD.player.x,WORLD.player.y,44,0,Math.PI*2);ctx.clip();ctx.drawImage(portrait,WORLD.player.x-44,WORLD.player.y-44,88,88);ctx.restore();}
    label('Aurora',1000,1170,'#d7afff');
    if(!running){ctx.fillStyle='#080f1770';ctx.fillRect(0,0,WORLD.width,WORLD.height);label(drill.time?'Paused · Resume to continue':'Start, then aim ahead and cast',1000,650,'#e8edf0',40);}
  }
  function tick(timestamp){frame=null;if(!active||!running||document.hidden)return;const dt=lastTime?Math.min((timestamp-lastTime)/1000,0.05):0;lastTime=timestamp;step(drill,dt);
    if(drill.last&&lastResult!==drill.last){lastResult=drill.last;status(drill.last.spell==='Q'?`Q ${drill.last.hit?'hit':'missed'} outbound · return ${drill.last.returnHit?'hit':'missed'}`:`E ${drill.last.hit?'hit':'missed'}`);}
    controls();draw();frame=requestAnimationFrame(tick);
  }
  function pause(){running=false;lastTime=0;cancelAnimationFrame(frame);frame=null;controls();if(active)draw();}
  function cast(spell=selected()){if(!running||!active)return;if(fire(drill,spell,aim)){status(`${spell} casting…`);controls();draw();}}
  function reset(){pause();drill=createDrill(options());aim={x:1000,y:1080-drill.distance};lastResult=null;status('Ready · aim ahead of the moving target.');controls();draw();}
  $('#practice-reset').onclick=reset;
  $('#practice-pause').onclick=()=>{if(running){pause();status('Paused.');}else{running=true;lastTime=0;controls();status('Aim ahead of the target.');frame=requestAnimationFrame(tick);canvas.focus({preventScroll:true});}};
  $('#practice-cast').onclick=()=>cast();
  $('#practice-spell').onchange=()=>{controls();draw();};
  $('#practice-pattern').onchange=reset;
  for(const field of ['distance','speed'])$('#practice-'+field).oninput=()=>{$('#practice-'+field+'-value').textContent=$('#practice-'+field).value+(field==='distance'?' units':' units/s');reset();};
  $('#practice-guide').onchange=draw;
  function pointer(event){const rect=canvas.getBoundingClientRect();aim={x:Math.max(0,Math.min(WORLD.width,(event.clientX-rect.left)/rect.width*WORLD.width)),y:Math.max(0,Math.min(WORLD.height,(event.clientY-rect.top)/rect.height*WORLD.height))};if(!running)draw();}
  canvas.addEventListener('pointermove',pointer);
  canvas.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();pointer(event);canvas.focus({preventScroll:true});cast();});
  canvas.addEventListener('keydown',event=>{
    const arrows={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]};
    if(arrows[event.key]){event.preventDefault();aim.x=Math.max(0,Math.min(WORLD.width,aim.x+arrows[event.key][0]));aim.y=Math.max(0,Math.min(WORLD.height,aim.y+arrows[event.key][1]));draw();}
    if(event.code==='Space'||['q','e'].includes(event.key.toLowerCase())){event.preventDefault();if(!event.repeat)cast(event.code==='Space'?selected():event.key.toUpperCase());}
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  document.addEventListener('focusin',event=>{if(running&&!root.contains(event.target))pause();});
  window.addEventListener('blur',pause);
  new ResizeObserver(()=>{if(active)draw();}).observe(canvas);
  controls();
  return {setActive(value){active=value;if(!value)pause();else{controls();draw();}}};
}
