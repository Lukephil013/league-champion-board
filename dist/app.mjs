import { STORAGE_KEY, initialState, validateState, placeChampion, shift, persistState, ROLES, groupChampions, placeInRole, localDate, validDate } from './core.mjs';
const $ = s => document.querySelector(s);
const el = (tag,className,text) => { const n=document.createElement(tag); if(className)n.className=className;if(text!==undefined)n.textContent=text;return n; };
const button = (text,action,label) => {const b=el('button','',text);b.type='button';if(label)b.setAttribute('aria-label',label);b.addEventListener('click',action);return b;};
let state, catalog, champions = new Map(), selectedChampion=null, noteTimer, undoAccounts=null, saveBlocked=false, dirty=false, quickTarget=null, quickRole=null, activeView='account', activeAccountId=null, activeEntryId=null, undoEntry=null;
const banner = text => {$('#error-banner').textContent=text;$('#error-banner').hidden=!text;};
try { const saved=localStorage.getItem(STORAGE_KEY);const raw=saved?JSON.parse(saved):null;state=raw?validateState(raw):initialState();if(raw?.schemaVersion===1){try{if(!localStorage.getItem('league-champion-board:before-v2'))localStorage.setItem('league-champion-board:before-v2',saved);}catch{/* Keep the successfully read board if the optional migration snapshot cannot fit. */}} }
catch {state=initialState();saveBlocked=true;banner('Your saved data could not be read. It has not been overwritten. Export any visible notes, then restore a valid backup using Import.');}
function save() {
  clearTimeout(noteTimer);
  if(saveBlocked){$('#save-status').textContent='Saving paused';$('#notes-status').textContent='Saving paused';$('#journal-status').textContent='Saving paused';return false;}
  let result;try{result=persistState(localStorage,state);}catch{result={saved:false,message:'Browser storage is unavailable. Export a backup before closing this page.'};}
  if(result.saved){dirty=false;$('#save-status').textContent='Saved';$('#notes-status').textContent='Saved';$('#journal-status').textContent='Saved';banner('');return true;}
  dirty=true;$('#save-status').textContent='Not saved';$('#notes-status').textContent='Not saved — export a backup';$('#journal-status').textContent='Not saved — export a backup';banner(result.message);return false;
}
function notify(text,withUndo=false){$('#toast-text').textContent=text;$('#undo').hidden=!withUndo;$('#toast').hidden=false;}
function commit(next,message) {if(next===state)return;undoAccounts=structuredClone(state.accounts);undoEntry=null;state=next;save();renderBoard();renderTray();if(selectedChampion)renderNotePlacement();notify(message,true);}
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
async function newAccount(){const name=await formDialog({title:'Add an account',label:'Account name',description:'Use your Riot ID or any label that makes sense to you.',submit:'Add account'});if(name){activeAccountId=crypto.randomUUID();activeView='account';changeAccounts(accounts=>accounts.push({id:activeAccountId,name,champions:[]}),`Added ${name}.`);}}
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
  let id=targetId||quickTarget||activeAccountId;
  if(!available.some(a=>a.id===id))id=available.length===1?available[0].id:await formDialog({title:`Add ${nameOf(championId)}`,label:'Account',choices:available.map(a=>({value:a.id,label:a.name})),submit:'Add champion'});
  if(id){try{const next=quickRole&&id===quickTarget?placeInRole(state,championId,id,quickRole):placeChampion(state,championId,id);commit(next,`${nameOf(championId)} added.`);}catch(e){notify(e.message);}}
}
async function placementAction(championId,account){
  const roleGroup=groupChampions(account).find(group=>group.champions.includes(championId)).champions,index=roleGroup.indexOf(championId),others=state.accounts.filter(a=>a.id!==account.id&&!a.champions.includes(championId));
  const choices=[{value:'role',label:'Set role'},{value:'note',label:'Edit placement reminder'},...others.map(a=>({value:`move:${a.id}`,label:`Move to ${a.name}`})),...others.map(a=>({value:`copy:${a.id}`,label:`Copy to ${a.name}`})),...(index>0?[{value:'earlier',label:'Move earlier in this role'}]:[]),...(index<roleGroup.length-1?[{value:'later',label:'Move later in this role'}]:[]),{value:'remove',label:`Remove from ${account.name}`}];
  const action=await formDialog({title:nameOf(championId),label:'Placement action',choices,submit:'Apply'});if(!action)return;
  if(action==='role'||action==='note'){
    const detail=account.championDetails?.[championId]||{role:'',note:''};
    const value=await formDialog(action==='role'?{title:`${nameOf(championId)} role`,label:'Role on this account',choices:[{value:'none',label:'Unassigned'},...ROLES.map(role=>({value:role,label:role}))]}:{title:'Placement reminder',label:'Conditional pick or reminder',value:detail.note,optional:true,maxLength:300});
    if(value!==null)changeAccounts(accounts=>{const a=accounts.find(a=>a.id===account.id);a.championDetails??={};a.championDetails[championId]={...detail,[action==='role'?'role':'note']:action==='role'&&value==='none'?'':value};},'Placement details saved.');
    return;
  }
  if(action.startsWith('move:')||action.startsWith('copy:')){const [kind,target]=action.split(':');try{commit(placeChampion(state,championId,target,account.id,kind==='copy'),`${nameOf(championId)} ${kind==='copy'?'copied':'moved'}.`);}catch(e){notify(e.message);}}
  else changeAccounts(accounts=>{const a=accounts.find(a=>a.id===account.id);if(action==='remove'){a.champions=a.champions.filter(c=>c!==championId);if(a.championDetails)delete a.championDetails[championId];}else{const reordered=shift(roleGroup,championId,action==='earlier'?-1:1);let i=0;a.champions=a.champions.map(id=>roleGroup.includes(id)?reordered[i++]:id);}},action==='remove'?'Placement removed. Notes kept.':'Champions reordered.');
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
  if(!catalog)return;const query=folded($('#search').value);
  const alias={j4:'JarvanIV',kha:'Khazix',wukong:'MonkeyKing',nunu:'Nunu',reksai:'RekSai'};
  const results=catalog.champions.filter(c=>!query||folded(c.name).includes(query)||folded(c.id).includes(query)||alias[query]===c.id);
  $('#roster-count').textContent=`${results.length} / ${catalog.champions.length}`;
  $('#champion-tray').replaceChildren(...results.map(c=>card(c)));
  if(!results.length)$('#champion-tray').append(el('p','no-results','No champions match that search.'));
}
function switchView(view,accountId=null){
  if(dirty)save();activeView=view;if(accountId)activeAccountId=accountId;
  if(view!=='library'){quickTarget=null;quickRole=null;}
  renderBoard();if(view==='journal')renderJournal();
}
function openLibrary(role=null){
  quickTarget=activeAccountId;quickRole=role;activeView='library';renderBoard();renderTray();$('#search').focus();
}
function renderBoard(){
  if(!state.accounts.some(a=>a.id===activeAccountId))activeAccountId=state.accounts[0]?.id||null;
  $('#account-count').textContent=state.accounts.length;
  const nav=$('#account-nav');nav.replaceChildren();
  for(const a of state.accounts){const b=button('',()=>switchView('account',a.id),`Show account ${a.name}`);b.className='nav-item';b.dataset.accountId=a.id;b.append(el('span','nav-name',a.name),el('span','count',String(a.champions.length)));if(activeView==='account'&&activeAccountId===a.id)b.setAttribute('aria-current','page');nav.append(b);}
  for(const [id,view]of [['journal-nav','journal'],['library-nav','library']]){if(activeView===view)$('#'+id).setAttribute('aria-current','page');else $('#'+id).removeAttribute('aria-current');}
  $('#account-view').hidden=activeView!=='account';$('#journal-view').hidden=activeView!=='journal';$('#library-view').hidden=activeView!=='library';
  const a=state.accounts.find(a=>a.id===activeAccountId);$('#accounts-title').textContent=a?.name||'Your accounts';$('#selected-focus').textContent=a?.focus||'';$('#selected-focus').hidden=!a?.focus;$('#manage-selected').hidden=!a;$('#open-library').hidden=!a;
  $('#library-hint').textContent=quickTarget&&a?`Adding to ${a.name}${quickRole?' · '+quickRole:''}. You can also drag onto an account in the sidebar.`:'Add a champion to an account or open its shared notes.';
  const board=$('#accounts');board.replaceChildren();
  if(!a){const empty=el('div','empty-board');empty.append(el('h3','','Make room for your pool.'),el('p','','Add an account, then choose champions for each role.'),button('+ Add your first account',newAccount));board.append(empty);return;}
  for(const group of groupChampions(a)){
    if(group.role==='Unassigned'&&!group.champions.length)continue;
    const section=el('section','role-section');section.dataset.accountId=a.id;section.dataset.role=group.role;
    const heading=el('div','role-heading');heading.append(el('h3','',group.role),el('span','count',String(group.champions.length)),button('+ Add',()=>openLibrary(group.role),`Add ${group.role} champion`));section.append(heading);
    const grid=el('div','role-grid');grid.setAttribute('aria-label',`${a.name} ${group.role} champions`);
    for(const id of group.champions)grid.append(card(champions.get(id)||{id,name:id},a));
    if(!group.champions.length)grid.append(el('p','role-empty',`No ${group.role.toLowerCase()} champions yet. Drop one here or use Add.`));
    section.append(grid);board.append(section);
  }
}
function renderEntryList(){
  const entries=[...state.journal].sort((a,b)=>b.date.localeCompare(a.date));
  const list=$('#entry-list');list.replaceChildren();
  for(const entry of entries){const b=button('',()=>{if(dirty)save();activeEntryId=entry.id;renderJournal();},`Open journal entry ${entry.date}: ${entry.title||'Untitled'}`);b.className='entry-item';if(activeEntryId===entry.id)b.setAttribute('aria-current','true');b.append(el('span','entry-day',entry.date),el('span','entry-name',entry.title||'Untitled entry'),el('span','entry-preview',entry.body.replace(/\s+/g,' ').slice(0,95)||'Start writing…'));list.append(b);}
  if(!entries.length)list.append(el('p','hint','Your dated entries will appear here.'));
}
function renderJournal(){
  if(!state.journal.some(e=>e.id===activeEntryId))activeEntryId=[...state.journal].sort((a,b)=>b.date.localeCompare(a.date))[0]?.id||null;
  renderEntryList();const entry=state.journal.find(e=>e.id===activeEntryId);
  $('#journal-empty').hidden=!!entry;$('#entry-editor').hidden=!entry;
  if(entry){$('#entry-date').value=entry.date;$('#entry-title').value=entry.title;$('#entry-body').value=entry.body;$('#entry-length').textContent=`${entry.body.length.toLocaleString()} characters`;$('#journal-status').textContent=saveBlocked?'Saving paused':dirty?'Not saved':'Saved';}
}
function newEntry(){if(dirty)save();const entry={id:crypto.randomUUID(),date:localDate(),title:'',body:''};state.journal.unshift(entry);activeEntryId=entry.id;activeView='journal';save();renderBoard();renderJournal();$('#entry-title').focus();}
function editEntry(){
  const entry=state.journal.find(e=>e.id===activeEntryId);if(!entry)return;
  const date=$('#entry-date').value;if(validDate(date)){entry.date=date;$('#entry-date').setCustomValidity('');}else $('#entry-date').setCustomValidity('Choose a valid date.');
  entry.title=$('#entry-title').value;entry.body=$('#entry-body').value;dirty=true;$('#save-status').textContent='Saving…';$('#journal-status').textContent='Saving…';$('#entry-length').textContent=`${entry.body.length.toLocaleString()} characters`;renderEntryList();clearTimeout(noteTimer);noteTimer=setTimeout(save,400);
}
$('#journal-nav').onclick=()=>switchView('journal');$('#library-nav').onclick=()=>{quickTarget=null;quickRole=null;switchView('library');renderTray();};
$('#open-library').onclick=()=>openLibrary();$('#manage-selected').onclick=()=>{const a=state.accounts.find(a=>a.id===activeAccountId);if(a)accountAction(a);};
$('#new-entry').onclick=newEntry;$('#first-entry').onclick=newEntry;
for(const id of ['entry-title','entry-body','entry-date'])$('#'+id).addEventListener('input',editEntry);
$('#entry-date').addEventListener('blur',()=>{if(!validDate($('#entry-date').value)){$('#entry-date').value=state.journal.find(e=>e.id===activeEntryId)?.date||localDate();$('#entry-date').setCustomValidity('');}});
$('#delete-entry').onclick=async()=>{const entry=state.journal.find(e=>e.id===activeEntryId);if(!entry)return;if(!await formDialog({title:'Delete this journal entry?',description:`${entry.date} · ${entry.title||'Untitled entry'}`,confirm:true,submit:'Delete entry'}))return;undoEntry=structuredClone(entry);undoAccounts=null;state.journal=state.journal.filter(e=>e.id!==entry.id);activeEntryId=null;save();renderJournal();notify('Journal entry deleted.',true);};
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
$('#new-account').onclick=newAccount;
$('#dismiss-toast').onclick=()=>$('#toast').hidden=true;
$('#undo').onclick=()=>{if(undoEntry){if(!state.journal.some(e=>e.id===undoEntry.id))state.journal.unshift(undoEntry);activeEntryId=undoEntry.id;undoEntry=null;save();renderJournal();notify('Journal entry restored.');return;}if(!undoAccounts)return;const previous=undoAccounts;undoAccounts=null;state={...state,accounts:previous};save();renderBoard();renderTray();if(selectedChampion)renderNotePlacement();notify('Placement change undone.');};
$('#settings').onclick=()=>$('#settings-dialog').showModal();
$('#close-settings').onclick=()=>$('#settings-dialog').close();
$('#export').onclick=()=>{$('#settings-dialog').close();save();$('#backup-text').value=JSON.stringify(state,null,2);$('#backup-dialog').showModal();};
$('#close-backup').onclick=()=>$('#backup-dialog').close();
$('#download-backup').onclick=()=>{const blob=new Blob([$('#backup-text').value],{type:'application/json'});const url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=`league-board-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('Backup download requested.');};
$('#import').onclick=()=>{$('#settings-dialog').close();$('#import-file').click();};
$('#import-file').onchange=async()=>{
  const file=$('#import-file').files[0];$('#import-file').value='';if(!file)return;
  try {if(file.size>10*1024*1024)throw new Error('Backup is too large (maximum 10 MB).');const imported=validateState(JSON.parse(await file.text()));if(!await formDialog({title:'Replace this board?',description:`Restore ${imported.accounts.length} accounts and ${Object.keys(imported.notes).length} notebooks and ${imported.journal.length} journal entries from this backup. Export your current board first if you want to keep it.`,confirm:true,submit:'Restore backup'}))return;
    clearTimeout(noteTimer);localStorage.setItem(STORAGE_KEY,JSON.stringify(imported));state=imported;saveBlocked=false;undoAccounts=null;undoEntry=null;save();renderBoard();renderTray();renderJournal();notify('Backup restored.');
  }catch(e){notify(`Import failed: ${e.message}`);}
};
$('#refresh-catalog').onclick=async()=>{const b=$('#refresh-catalog');b.disabled=true;b.textContent='Refreshing…';try{const r=await fetch('/api/catalog/refresh',{method:'POST',headers:{'X-Champion-Board':'refresh'}});const next=await r.json();if(!r.ok)throw new Error(next.error);setCatalog(next);notify(`Roster refreshed: ${catalog.champions.length} champions.`);}catch(e){notify(e.message||'Refresh failed. Existing roster kept.');}finally{b.disabled=false;b.textContent='Refresh roster';}};
function setCatalog(next){catalog=next;champions=new Map(catalog.champions.map(c=>[c.id,c]));$('#catalog-version').textContent=`Data Dragon ${catalog.version}`;renderTray();renderBoard();}
document.addEventListener('dragstart',e=>{const c=e.target.closest('.champ-card');if(!c)return;e.dataTransfer.setData('application/x-champion-board',JSON.stringify({championId:c.dataset.champion,sourceId:c.dataset.account||null}));e.dataTransfer.effectAllowed='copyMove';c.classList.add('dragging');});
function clearDrop(){document.querySelectorAll('.drop-target,.drop-before,.dragging').forEach(n=>n.classList.remove('drop-target','drop-before','dragging'));}
document.addEventListener('dragend',clearDrop);
document.querySelector('.workspace').addEventListener('dragover',e=>{if(!Array.from(e.dataTransfer.types).includes('application/x-champion-board'))return;const a=e.target.closest('[data-account-id]');if(!a)return;e.preventDefault();document.querySelectorAll('.drop-target,.drop-before').forEach(n=>n.classList.remove('drop-target','drop-before'));const zone=e.target.closest('.role-section')||a;zone.classList.add('drop-target');e.target.closest('.champ-card')?.classList.add('drop-before');});
document.querySelector('.workspace').addEventListener('dragleave',e=>{if(!document.querySelector('.workspace').contains(e.relatedTarget))document.querySelectorAll('.drop-target,.drop-before').forEach(n=>n.classList.remove('drop-target','drop-before'));});
document.querySelector('.workspace').addEventListener('drop',e=>{e.preventDefault();clearDrop();const target=e.target.closest('[data-account-id]');if(!target)return;try{const {championId,sourceId}=JSON.parse(e.dataTransfer.getData('application/x-champion-board'));if(!champions.has(championId)&&!state.accounts.some(a=>a.champions.includes(championId)))return;const role=e.target.closest('[data-role]')?.dataset.role;const before=e.target.closest('.champ-card')?.dataset.champion;const next=role?placeInRole(state,championId,target.dataset.accountId,role,sourceId,before):placeChampion(state,championId,target.dataset.accountId,sourceId,false,before);commit(next,`${nameOf(championId)} placed.`);}catch(err){notify(err.message||'Could not place champion.');}});
window.addEventListener('beforeunload',e=>{if(dirty&&!save()){e.preventDefault();e.returnValue='';}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&dirty)save();});
window.addEventListener('storage',e=>{if(e.key!==STORAGE_KEY)return;undoAccounts=null;undoEntry=null;$('#undo').hidden=true;if(dirty){saveBlocked=true;banner('This board changed in another tab. Export your current notes before reloading; saving is paused to prevent overwriting the other tab.');$('#save-status').textContent='Saving paused';return;}try{if(!e.newValue)throw new Error();state=validateState(JSON.parse(e.newValue));if(selectedChampion){$('#notes-text').value=state.notes[selectedChampion]||'';$('#note-length').textContent=`${$('#notes-text').value.length.toLocaleString()} characters`;renderNotePlacement();}renderBoard();renderTray();renderJournal();notify('Board updated from another tab.');}catch{saveBlocked=true;banner('Saved data changed unexpectedly. Reload or restore a backup before making further changes.');}});
try{const r=await fetch('/api/catalog');if(!r.ok)throw new Error();setCatalog(await r.json());if(!saveBlocked)save();else $('#save-status').textContent='Saving paused';}
catch{banner('The champion roster could not load. Restart the local launcher and reload this page.');renderBoard();}
