import { STORAGE_KEY, SHORTLIST, initialState, validateState, placeChampion, shift, persistState, ROLES } from './core.mjs';
const $ = s => document.querySelector(s);
const el = (tag,className,text) => { const n=document.createElement(tag); if(className)n.className=className;if(text!==undefined)n.textContent=text;return n; };
const button = (text,action,label) => {const b=el('button','',text);b.type='button';if(label)b.setAttribute('aria-label',label);b.addEventListener('click',action);return b;};
let state, catalog, champions = new Map(), selectedChampion=null, noteTimer, undoAccounts=null, saveBlocked=false, dirty=false, quickTarget=null;
const banner = text => {$('#error-banner').textContent=text;$('#error-banner').hidden=!text;};
try { const saved=localStorage.getItem(STORAGE_KEY);state=saved?validateState(JSON.parse(saved)):initialState(); }
catch {state=initialState();saveBlocked=true;banner('Your saved data could not be read. It has not been overwritten. Export any visible notes, then restore a valid backup using Import.');}
function save() {
  clearTimeout(noteTimer);
  if(saveBlocked){$('#save-status').textContent='Saving paused';$('#notes-status').textContent='Saving paused';return false;}
  let result;try{result=persistState(localStorage,state);}catch{result={saved:false,message:'Browser storage is unavailable. Export a backup before closing this page.'};}
  if(result.saved){dirty=false;$('#save-status').textContent='Saved in this browser';$('#notes-status').textContent='Saved';banner('');return true;}
  dirty=true;$('#save-status').textContent='Not saved';$('#notes-status').textContent='Not saved — export a backup';banner(result.message);return false;
}
function notify(text,withUndo=false){$('#toast-text').textContent=text;$('#undo').hidden=!withUndo;$('#toast').hidden=false;}
function commit(next,message) {if(next===state)return;undoAccounts=structuredClone(state.accounts);state=next;save();renderBoard();renderTray();if(selectedChampion)renderNotePlacement();notify(message,true);}
function changeAccounts(fn,message){const next=structuredClone(state);fn(next.accounts);commit(next,message);}
function nameOf(id){return champions.get(id)?.name||id;}
function folded(s){return s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');}
function formDialog({title,description='',label='',value='',choices=null,submit='Save',confirm=false,optional=false,maxLength=80}) {
  return new Promise(resolve=>{
    const dialog=$('#form-dialog'),input=$('#form-input'),select=$('#form-select');
    $('#form-title').textContent=title;$('#form-description').textContent=description;$('#form-description').hidden=!description;$('#form-label').textContent=label;$('#form-label').hidden=confirm;$('#form-label').htmlFor=choices?'form-select':'form-input';$('#form-submit').textContent=submit;
    input.hidden=!!choices||confirm;input.required=!choices&&!confirm&&!optional;input.maxLength=maxLength;input.value=value;select.hidden=!choices;select.replaceChildren();
    if(choices)for(const c of choices){const option=el('option','',c.label);option.value=c.value;select.append(option);}
    let complete=false;
    const finish=v=>{if(complete)return;complete=true;dialog.close();$('#form').onsubmit=null;dialog.oncancel=null;resolve(v);};
    $('#form').onsubmit=e=>{e.preventDefault();const v=confirm?true:choices?select.value:input.value.trim();if(v||optional)finish(v);else input.reportValidity();};
    $('#form-cancel').onclick=()=>finish(null);dialog.oncancel=e=>{e.preventDefault();finish(null);};dialog.showModal();
    if(!confirm&&!choices){input.focus();input.select();}
  });
}
async function newAccount(){const name=await formDialog({title:'Add an account',label:'Account name',description:'Use your Riot ID or any label that makes sense to you.',submit:'Add account'});if(name)changeAccounts(accounts=>accounts.push({id:crypto.randomUUID(),name,champions:[]}),`Added ${name}.`);}
async function accountAction(account){
  const index=state.accounts.indexOf(account);
  const choices=[{value:'rename',label:'Rename account'},{value:'focus',label:'Edit account focus'},...(index>0?[{value:'earlier',label:'Move account earlier'}]:[]),...(index<state.accounts.length-1?[{value:'later',label:'Move account later'}]:[]),{value:'delete',label:'Delete account'}];
  const action=await formDialog({title:account.name,label:'Account action',choices,submit:'Continue'});
  if(action==='rename'){const name=await formDialog({title:'Rename account',label:'Account name',value:account.name});if(name)changeAccounts(accounts=>accounts.find(a=>a.id===account.id).name=name,'Account renamed.');}
  if(action==='focus'){const focus=await formDialog({title:'Account focus',label:'What you focus on here',value:account.focus||'',optional:true,maxLength:1000});if(focus!==null)changeAccounts(accounts=>accounts.find(a=>a.id===account.id).focus=focus,'Account focus saved.');}
  if(action==='earlier'||action==='later'){const ids=shift(state.accounts.map(a=>a.id),account.id,action==='earlier'?-1:1);commit({...state,accounts:ids.map(id=>state.accounts.find(a=>a.id===id))},'Accounts reordered.');}
  if(action==='delete'&&await formDialog({title:`Delete ${account.name}?`,description:'This removes the account and its placements. All champion notebooks remain available.',submit:'Delete account',confirm:true}))commit({...state,accounts:state.accounts.filter(a=>a.id!==account.id)},'Account deleted. Champion notes kept.');
}
async function addToAccount(championId,targetId=null){
  if(!state.accounts.length){await newAccount();if(!state.accounts.length)return;}
  const available=state.accounts.filter(a=>!a.champions.includes(championId));
  if(!available.length)return notify('This champion is already on every account.');
  let id=targetId||quickTarget;
  if(!available.some(a=>a.id===id))id=available.length===1?available[0].id:await formDialog({title:`Add ${nameOf(championId)}`,label:'Account',choices:available.map(a=>({value:a.id,label:a.name})),submit:'Add champion'});
  if(id){try{commit(placeChampion(state,championId,id),`${nameOf(championId)} added.`);}catch(e){notify(e.message);}}
}
async function placementAction(championId,account){
  const index=account.champions.indexOf(championId),others=state.accounts.filter(a=>a.id!==account.id&&!a.champions.includes(championId));
  const choices=[{value:'role',label:'Set role'},{value:'note',label:'Edit placement reminder'},...others.map(a=>({value:`move:${a.id}`,label:`Move to ${a.name}`})),...others.map(a=>({value:`copy:${a.id}`,label:`Copy to ${a.name}`})),...(index>0?[{value:'earlier',label:'Move earlier in this account'}]:[]),...(index<account.champions.length-1?[{value:'later',label:'Move later in this account'}]:[]),{value:'remove',label:`Remove from ${account.name}`}];
  const action=await formDialog({title:nameOf(championId),label:'Placement action',choices,submit:'Apply'});if(!action)return;
  if(action==='role'||action==='note'){
    const detail=account.championDetails?.[championId]||{role:'',note:''};
    const value=await formDialog(action==='role'?{title:`${nameOf(championId)} role`,label:'Role on this account',choices:[{value:'none',label:'Unassigned'},...ROLES.map(role=>({value:role,label:role}))]}:{title:'Placement reminder',label:'Conditional pick or reminder',value:detail.note,optional:true,maxLength:300});
    if(value!==null)changeAccounts(accounts=>{const a=accounts.find(a=>a.id===account.id);a.championDetails??={};a.championDetails[championId]={...detail,[action==='role'?'role':'note']:action==='role'&&value==='none'?'':value};},'Placement details saved.');
    return;
  }
  if(action.startsWith('move:')||action.startsWith('copy:')){const [kind,target]=action.split(':');try{commit(placeChampion(state,championId,target,account.id,kind==='copy'),`${nameOf(championId)} ${kind==='copy'?'copied':'moved'}.`);}catch(e){notify(e.message);}}
  else changeAccounts(accounts=>{const a=accounts.find(a=>a.id===account.id);a.champions=action==='remove'?a.champions.filter(c=>c!==championId):shift(a.champions,championId,action==='earlier'?-1:1);if(action==='remove'&&a.championDetails)delete a.championDetails[championId];},action==='remove'?'Placement removed. Notes kept.':'Champions reordered.');
}
function card(c,account=null){
  const item=el('div',`champ-card${state.notes[c.id]?' has-notes':''}`);item.draggable=true;item.dataset.champion=c.id;if(account)item.dataset.account=account.id;
  const open=button('',()=>openNotes(c.id),`Open ${c.name} notes`);open.className='champ-open';
  const img=el('img');img.src=c.image||'/assets/champions/JarvanIV.png';img.alt='';img.width=100;img.height=100;img.loading='lazy';img.draggable=false;
  if(!c.image)img.hidden=true;
  open.append(img,el('span','champ-name',c.name));item.append(open);
  const detail=account?.championDetails?.[c.id];
  if(detail?.role)item.append(el('span','role-badge',detail.role));
  if(detail?.note)item.append(el('p','placement-reminder',detail.note));
  const actions=el('div','card-actions');
  if(account)actions.append(button('Notes',()=>openNotes(c.id),`${c.name} shared notes`),button('•••',()=>placementAction(c.id,account),`Manage ${c.name} on ${account.name}`));
  else actions.append(button('+ Add',()=>addToAccount(c.id),`Add ${c.name} to account`));
  item.append(actions);return item;
}
function renderTray(){
  if(!catalog)return;const query=folded($('#search').value),shortOnly=$('#shortlist').getAttribute('aria-pressed')==='true';
  const alias={j4:'JarvanIV',kha:'Khazix',wukong:'MonkeyKing',nunu:'Nunu',reksai:'RekSai'};
  const results=catalog.champions.filter(c=>query?(folded(c.name).includes(query)||folded(c.id).includes(query)||alias[query]===c.id):(!shortOnly||SHORTLIST.includes(c.id)));
  if(shortOnly&&!query)results.sort((a,b)=>SHORTLIST.indexOf(a.id)-SHORTLIST.indexOf(b.id));
  $('#roster-count').textContent=`${results.length} / ${catalog.champions.length}`;
  $('#champion-tray').replaceChildren(...results.map(c=>card(c)));
  if(!results.length)$('#champion-tray').append(el('p','no-results','No champions match that search.'));
}
function renderBoard(){
  $('#account-count').textContent=state.accounts.length;const board=$('#accounts');board.replaceChildren();
  if(!state.accounts.length){const empty=el('div','empty-board');empty.append(el('span','empty-symbol','◇'),el('h3','','Make room for your pool.'),el('p','','Add your first account, then bring over the champions you play there.'));const add=button('+ Add your first account',newAccount);add.className='primary';empty.append(add);board.append(empty);return;}
  state.accounts.forEach((a,i)=>{
    const account=el('article','account');account.dataset.accountId=a.id;
    const header=el('div','account-header'),heading=el('div');heading.append(el('div','account-index',`ACCOUNT ${String(i+1).padStart(2,'0')}`),el('h3','account-name',a.name));
    const tools=el('div','account-tools');tools.append(el('span','count',String(a.champions.length)),button('•••',()=>accountAction(a),`Manage account ${a.name}`));header.append(heading,tools);
    const grid=el('div','account-grid');grid.setAttribute('aria-label',`${a.name} champion pool`);
    for(const id of a.champions)grid.append(card(champions.get(id)||{id,name:id},a));
    if(!a.champions.length){const empty=el('div','account-empty');empty.append(el('span','','+'),el('p','','Drop your champions here'));grid.append(empty);}
    const footer=el('div','account-footer');footer.append(el('span','',`${a.champions.length} champion${a.champions.length===1?'':'s'}`),button('+ Add champion',()=>{quickTarget=a.id;$('#search').focus();$('#search').scrollIntoView({block:'center',behavior:'smooth'});notify(`Choose a champion to add to ${a.name}.`);},`Add champion to ${a.name}`));
    account.append(header);if(a.focus)account.append(el('p','account-focus',a.focus));account.append(grid,footer);board.append(account);
  });
}
function renderNotePlacement(){
  const played=state.accounts.filter(a=>a.champions.includes(selectedChampion));$('#played-on').textContent=played.length?`Played on: ${played.map(a=>a.name).join(' · ')}`:'Not placed on an account yet.';
  const available=state.accounts.filter(a=>!a.champions.includes(selectedChampion));$('#note-account').replaceChildren();for(const a of available){const o=el('option','',a.name);o.value=a.id;$('#note-account').append(o);}
  $('#note-account').disabled=!available.length;$('#note-add').disabled=!available.length;
  if(!available.length){const o=el('option','',state.accounts.length?'Already on every account':'Create an account first');$('#note-account').append(o);}
}
function openNotes(id){
  if(noteTimer)save();selectedChampion=id;const c=champions.get(id)||{name:id,title:'',image:''};$('#notes-title').textContent=c.name;$('#notes-subtitle').textContent=c.title;$('#notes-portrait').src=c.image||'/assets/champions/JarvanIV.png';$('#notes-portrait').hidden=!c.image;$('#notes-text').value=state.notes[id]||'';$('#notes-status').textContent=saveBlocked?'Saving paused':dirty?'Not saved':'Saved';$('#note-length').textContent=`${$('#notes-text').value.length.toLocaleString()} characters`;renderNotePlacement();$('#notes-dialog').showModal();$('#notes-text').focus();$('#notes-text').setSelectionRange(0,0);$('#notes-text').scrollTop=0;
}
$('#notes-text').addEventListener('input',()=>{state.notes[selectedChampion]=$('#notes-text').value;dirty=true;$('#save-status').textContent='Saving…';$('#notes-status').textContent='Saving…';$('#note-length').textContent=`${$('#notes-text').value.length.toLocaleString()} characters`;clearTimeout(noteTimer);noteTimer=setTimeout(save,400);});
$('#close-notes').onclick=()=>$('#notes-dialog').close();$('#notes-dialog').addEventListener('close',()=>{save();renderBoard();renderTray();selectedChampion=null;});
$('#note-add').onclick=()=>addToAccount(selectedChampion,$('#note-account').value);
$('#search').addEventListener('input',renderTray);
for(const id of ['shortlist','all-champions'])$(`#${id}`).onclick=()=>{for(const other of ['shortlist','all-champions'])$(`#${other}`).setAttribute('aria-pressed',String(other===id));$('#search').value='';renderTray();};
$('#new-account').onclick=newAccount;
$('#dismiss-toast').onclick=()=>$('#toast').hidden=true;
$('#undo').onclick=()=>{if(!undoAccounts)return;const previous=undoAccounts;undoAccounts=null;state={...state,accounts:previous};save();renderBoard();renderTray();if(selectedChampion)renderNotePlacement();notify('Placement change undone.');};
$('#export').onclick=()=>{save();$('#backup-text').value=JSON.stringify(state,null,2);$('#backup-dialog').showModal();};
$('#close-backup').onclick=()=>$('#backup-dialog').close();
$('#download-backup').onclick=()=>{const blob=new Blob([$('#backup-text').value],{type:'application/json'});const url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=`league-board-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('Backup download requested.');};
$('#import').onclick=()=>$('#import-file').click();
$('#import-file').onchange=async()=>{
  const file=$('#import-file').files[0];$('#import-file').value='';if(!file)return;
  try {if(file.size>10*1024*1024)throw new Error('Backup is too large (maximum 10 MB).');const imported=validateState(JSON.parse(await file.text()));if(!await formDialog({title:'Replace this board?',description:`Restore ${imported.accounts.length} accounts and ${Object.keys(imported.notes).length} notebooks from this backup. Export your current board first if you want to keep it.`,confirm:true,submit:'Restore backup'}))return;
    clearTimeout(noteTimer);localStorage.setItem(STORAGE_KEY,JSON.stringify(imported));state=imported;saveBlocked=false;undoAccounts=null;save();renderBoard();renderTray();notify('Backup restored.');
  }catch(e){notify(`Import failed: ${e.message}`);}
};
$('#refresh-catalog').onclick=async()=>{const b=$('#refresh-catalog');b.disabled=true;b.textContent='Refreshing…';try{const r=await fetch('/api/catalog/refresh',{method:'POST',headers:{'X-Champion-Board':'refresh'}});const next=await r.json();if(!r.ok)throw new Error(next.error);setCatalog(next);notify(`Roster refreshed: ${catalog.champions.length} champions.`);}catch(e){notify(e.message||'Refresh failed. Existing roster kept.');}finally{b.disabled=false;b.textContent='Refresh roster';}};
function setCatalog(next){catalog=next;champions=new Map(catalog.champions.map(c=>[c.id,c]));$('#catalog-version').textContent=`Data Dragon ${catalog.version}`;renderTray();renderBoard();}
document.addEventListener('dragstart',e=>{const c=e.target.closest('.champ-card');if(!c)return;e.dataTransfer.setData('application/x-champion-board',JSON.stringify({championId:c.dataset.champion,sourceId:c.dataset.account||null}));e.dataTransfer.effectAllowed='copyMove';c.classList.add('dragging');});
function clearDrop(){document.querySelectorAll('.drop-target,.drop-before,.dragging').forEach(n=>n.classList.remove('drop-target','drop-before','dragging'));}
document.addEventListener('dragend',clearDrop);
$('#accounts').addEventListener('dragover',e=>{if(!Array.from(e.dataTransfer.types).includes('application/x-champion-board'))return;const a=e.target.closest('[data-account-id]');if(!a)return;e.preventDefault();document.querySelectorAll('.drop-target,.drop-before').forEach(n=>n.classList.remove('drop-target','drop-before'));a.classList.add('drop-target');e.target.closest('.champ-card')?.classList.add('drop-before');});
$('#accounts').addEventListener('dragleave',e=>{if(!$('#accounts').contains(e.relatedTarget))document.querySelectorAll('.drop-target,.drop-before').forEach(n=>n.classList.remove('drop-target','drop-before'));});
$('#accounts').addEventListener('drop',e=>{e.preventDefault();clearDrop();const target=e.target.closest('[data-account-id]');if(!target)return;try{const {championId,sourceId}=JSON.parse(e.dataTransfer.getData('application/x-champion-board'));if(!champions.has(championId)&&!state.accounts.some(a=>a.champions.includes(championId)))return;commit(placeChampion(state,championId,target.dataset.accountId,sourceId,false,e.target.closest('.champ-card')?.dataset.champion),`${nameOf(championId)} placed.`);}catch(err){notify(err.message||'Could not place champion.');}});
window.addEventListener('beforeunload',e=>{if(dirty&&!save()){e.preventDefault();e.returnValue='';}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&dirty)save();});
window.addEventListener('storage',e=>{if(e.key!==STORAGE_KEY)return;undoAccounts=null;$('#undo').hidden=true;if(dirty){saveBlocked=true;banner('This board changed in another tab. Export your current notes before reloading; saving is paused to prevent overwriting the other tab.');$('#save-status').textContent='Saving paused';return;}try{if(!e.newValue)throw new Error();state=validateState(JSON.parse(e.newValue));if(selectedChampion){$('#notes-text').value=state.notes[selectedChampion]||'';$('#note-length').textContent=`${$('#notes-text').value.length.toLocaleString()} characters`;renderNotePlacement();}renderBoard();renderTray();notify('Board updated from another tab.');}catch{saveBlocked=true;banner('Saved data changed unexpectedly. Reload or restore a backup before making further changes.');}});
try{const r=await fetch('/api/catalog');if(!r.ok)throw new Error();setCatalog(await r.json());if(!saveBlocked)save();else $('#save-status').textContent='Saving paused';}
catch{banner('The champion roster could not load. Restart the local launcher and reload this page.');renderBoard();}
