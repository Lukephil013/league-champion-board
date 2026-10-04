import { STORAGE_KEY, initialState, validateState, placeChampion, shift, persistState, ROLES, groupChampions, moveRole, placeInRole, localDate, validDate, lolalyticsUrl, validOpggUrl, championRankedStats, accountRankedSummary, mergeRankedHistories } from './core.mjs';
import { mountAuroraPractice } from './aurora-practice.mjs';
const $ = s => document.querySelector(s);
const auroraPractice = mountAuroraPractice($('#practice-view'));
const el = (tag,className,text) => { const n=document.createElement(tag); if(className)n.className=className;if(text!==undefined)n.textContent=text;return n; };
const button = (text,action,label) => {const b=el('button','',text);b.type='button';if(label)b.setAttribute('aria-label',label);b.addEventListener('click',action);return b;};
let state, catalog, champions = new Map(), selectedChampion=null, selectedOpponent=null, notesReturnView='account', noteTimer, undoAccounts=null, undoMatchup=null, saveBlocked=false, dirty=false, quickTarget=null, quickRole=null, activeView='account', activeAccountId=null, activeEntryId=null, undoEntry=null, rankedPoll=null, rankedConfigured=false;
const banner = text => {$('#error-banner').textContent=text;$('#error-banner').hidden=!text;};
try { const saved=localStorage.getItem(STORAGE_KEY);const raw=saved?JSON.parse(saved):null;state=raw?validateState(raw):initialState();if(raw&&raw.schemaVersion<4){try{const key='league-champion-board:before-v4';if(!localStorage.getItem(key))localStorage.setItem(key,saved);}catch{/* Keep the successfully read board if the optional migration snapshot cannot fit. */}} }
catch {state=initialState();saveBlocked=true;banner('Your saved data could not be read. It has not been overwritten. Export any visible notes, then restore a valid backup using Import.');}
function save() {
  clearTimeout(noteTimer);
  if(saveBlocked){$('#save-status').textContent='Saving paused';$('#notes-status').textContent='Saving paused';$('#journal-status').textContent='Saving paused';return false;}
  let result;try{result=persistState(localStorage,state);}catch{result={saved:false,message:'Browser storage is unavailable. Export a backup before closing this page.'};}
  if(result.saved){dirty=false;$('#save-status').textContent='Saved';$('#notes-status').textContent='Saved';$('#journal-status').textContent='Saved';banner('');return true;}
  dirty=true;$('#save-status').textContent='Not saved';$('#notes-status').textContent='Not saved — export a backup';$('#journal-status').textContent='Not saved — export a backup';banner(result.message);return false;
}
function notify(text,withUndo=false){$('#toast-text').textContent=text;$('#undo').hidden=!withUndo;$('#toast').hidden=false;}
function commit(next,message) {if(next===state)return;undoAccounts=structuredClone(state.accounts);undoEntry=null;undoMatchup=null;state=next;save();renderBoard();renderTray();if(selectedChampion)renderNotePlacement();notify(message,true);}
function changeAccounts(fn,message){const next=structuredClone(state);fn(next.accounts);commit(next,message);}
function nameOf(id){return champions.get(id)?.name||id;}
function folded(s){return s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');}
function rankedDate(timestamp){return timestamp?new Date(timestamp).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}):'';}
function rankedCoverage(stats){return stats.games?`${stats.games.toLocaleString()} game${stats.games===1?'':'s'} · ${stats.wins.toLocaleString()}W ${stats.losses.toLocaleString()}L · ${rankedDate(stats.coverageFrom)} to ${rankedDate(stats.coverageTo)}`:'No tracked Ranked Solo games.';}
function formDialog({title,description='',label='',value='',choices=null,submit='Save',confirm=false,optional=false,maxLength=80,type='text'}) {
  return new Promise(resolve=>{
    const dialog=$('#form-dialog'),input=$('#form-input'),select=$('#form-select');
    $('#form-title').textContent=title;$('#form-description').textContent=description;$('#form-description').hidden=!description;$('#form-label').textContent=label;$('#form-label').hidden=confirm;$('#form-label').htmlFor=choices?'form-select':'form-input';$('#form-submit').textContent=submit;
    input.hidden=!!choices||confirm;input.required=!choices&&!confirm&&!optional;input.maxLength=maxLength;input.type=type;input.value=value;select.hidden=!choices;select.replaceChildren();
    if(choices)for(const c of choices){const option=el('option','',c.label);option.value=c.value;select.append(option);}
    let complete=false;
    const finish=v=>{if(complete)return;complete=true;dialog.close();$('#form').onsubmit=null;dialog.oncancel=null;resolve(v);};
    $('#form').onsubmit=e=>{e.preventDefault();const v=confirm?true:choices?select.value:input.value.trim();if(v||optional)finish(v);else input.reportValidity();};
    $('#form-cancel').onclick=()=>finish(null);dialog.oncancel=e=>{e.preventDefault();finish(null);};dialog.showModal();
    if(!confirm&&!choices){input.focus();input.select();}
  });
}
async function newAccount(){const name=await formDialog({title:'Add an account',label:'Account name',description:'Use your Riot ID or any label that makes sense to you.',submit:'Add account'});if(name){switchView('account');activeAccountId=crypto.randomUUID();changeAccounts(accounts=>accounts.push({id:activeAccountId,name,champions:[],roleOrder:[...ROLES]}),`Added ${name}.`);}}
async function accountAction(account){
  const index=state.accounts.indexOf(account);
  const choices=[{value:'rename',label:'Rename account'},{value:'focus',label:'Edit account focus'},{value:'opgg',label:account.opggUrl?'Edit OP.GG profile':'Add OP.GG profile'},...(index>0?[{value:'earlier',label:'Move account earlier'}]:[]),...(index<state.accounts.length-1?[{value:'later',label:'Move account later'}]:[]),{value:'delete',label:'Delete account'}];
  const action=await formDialog({title:account.name,label:'Account action',choices,submit:'Continue'});
  if(action==='rename'){const name=await formDialog({title:'Rename account',label:'Account name',value:account.name});if(name)changeAccounts(accounts=>accounts.find(a=>a.id===account.id).name=name,'Account renamed.');}
  if(action==='focus'){const focus=await formDialog({title:'Account focus',label:'What you focus on here',value:account.focus||'',optional:true,maxLength:1000});if(focus!==null)changeAccounts(accounts=>accounts.find(a=>a.id===account.id).focus=focus,'Account focus saved.');}
  if(action==='opgg'){const url=await formDialog({title:'OP.GG profile',description:'Paste the complete OP.GG summoner link. Leave it blank to remove the profile.',label:'OP.GG URL',value:account.opggUrl||'',optional:true,maxLength:500,type:'url'});if(url!==null){if(url&&!validOpggUrl(url))return notify('Use a complete https://op.gg/lol/summoners/... profile link.');changeAccounts(accounts=>{const a=accounts.find(a=>a.id===account.id);if(url)a.opggUrl=url;else delete a.opggUrl;},url?'OP.GG profile saved.':'OP.GG profile removed.');}}
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
  const item=el('div',`champ-card${state.notes[c.id]||Object.values(state.matchupNotes[c.id]||{}).some(Boolean)?' has-notes':''}`);item.draggable=true;item.dataset.champion=c.id;if(account)item.dataset.account=account.id;
  const portrait=el('a','champ-portrait-link');portrait.href=lolalyticsUrl(c.id);portrait.target='_blank';portrait.rel='noopener noreferrer';portrait.title=`Open ${c.name} on LoLalytics`;portrait.setAttribute('aria-label',portrait.title);portrait.draggable=false;
  const img=el('img');img.src=c.image||'/assets/champions/JarvanIV.png';img.alt='';img.width=100;img.height=100;img.loading='lazy';img.draggable=false;
  if(!c.image)img.hidden=true;
  portrait.append(img);
  const open=button(c.name,()=>openNotes(c.id),`Open ${c.name} notes`);open.className='champ-name champ-notes-open';item.append(portrait,open);
  const ranked=championRankedStats(state,c.id,account?.id||null);
  if(ranked.games){const count=el('span','ranked-count',`${ranked.games.toLocaleString()} ranked`);count.title=rankedCoverage(ranked);item.append(count);}
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
  if(dirty)save();if(selectedChampion){history.replaceState(null,'',location.pathname+location.search);selectedChampion=null;selectedOpponent=null;}document.title='Champion Board';activeView=view;if(accountId)activeAccountId=accountId;
  if(view!=='library'){quickTarget=null;quickRole=null;}
  renderBoard();if(view==='journal')renderJournal();
}
function openLibrary(role=null){
  if(dirty)save();if(selectedChampion){history.replaceState(null,'',location.pathname+location.search);selectedChampion=null;selectedOpponent=null;}document.title='Champion Board';
  quickTarget=activeAccountId;quickRole=role;activeView='library';renderBoard();renderTray();$('#search').focus();
}
function opggLabel(url){try{const parts=new URL(url).pathname.split('/').filter(Boolean),handle=decodeURIComponent(parts[3]),cut=handle.lastIndexOf('-');return cut>0?`${parts[2].toUpperCase()} · ${handle.slice(0,cut)}#${handle.slice(cut+1)}`:`${parts[2].toUpperCase()} · ${handle}`;}catch{return 'OP.GG profile';}}
function shiftRoleOnBoard(account,role,offset){
  const order=account.roleOrder||ROLES,target=order[order.indexOf(role)+offset];if(!target)return;
  commit(moveRole(state,account.id,role,target,offset>0),`${role} moved ${offset<0?'up':'down'}.`);
  const section=[...document.querySelectorAll('.role-section')].find(node=>node.dataset.role===role);
  const control=section?.querySelector(offset<0?'.role-up:not(:disabled)':'.role-down:not(:disabled)');
  (control||section?.querySelector('.role-heading h3'))?.focus({preventScroll:true});
}
function renderBoard(){
  if(!state.accounts.some(a=>a.id===activeAccountId))activeAccountId=state.accounts[0]?.id||null;
  $('#account-count').textContent=state.accounts.length;
  const nav=$('#account-nav');nav.replaceChildren();
  for(const a of state.accounts){const b=button('',()=>switchView('account',a.id),`Show account ${a.name}`);b.className='nav-item';b.dataset.accountId=a.id;b.append(el('span','nav-name',a.name),el('span','count',String(a.champions.length)));if(activeView==='account'&&activeAccountId===a.id)b.setAttribute('aria-current','page');nav.append(b);}
  for(const [id,view]of [['journal-nav','journal'],['library-nav','library'],['practice-nav','practice']]){if(activeView===view)$('#'+id).setAttribute('aria-current','page');else $('#'+id).removeAttribute('aria-current');}
  $('#account-view').hidden=activeView!=='account';$('#journal-view').hidden=activeView!=='journal';$('#library-view').hidden=activeView!=='library';
  $('#practice-view').hidden=activeView!=='practice';auroraPractice.setActive(activeView==='practice');
  $('#notes-page').hidden=activeView!=='notes';
  const a=state.accounts.find(a=>a.id===activeAccountId),profile=$('#selected-opgg'),rankedPanel=$('#selected-ranked');$('#accounts-title').textContent=a?.name||'Your accounts';$('#selected-focus').textContent=a?.focus||'';$('#selected-focus').hidden=!a?.focus;$('#manage-selected').hidden=!a;$('#open-library').hidden=!a;profile.hidden=!a?.opggUrl;if(a?.opggUrl){$('#selected-opgg-id').textContent=opggLabel(a.opggUrl);$('#selected-opgg-link').href=a.opggUrl;$('#selected-opgg-link').setAttribute('aria-label',`Open ${a.name} on OP.GG`);}
  const accountStats=a?accountRankedSummary(state,a.id):null;rankedPanel.hidden=!accountStats?.games;if(accountStats?.games){rankedPanel.textContent=`Ranked Solo/Duo · ${rankedCoverage({...accountStats,wins:Object.values(accountStats.champions).reduce((sum,c)=>sum+c.wins,0),losses:Object.values(accountStats.champions).reduce((sum,c)=>sum+c.losses,0)})}`;}
  $('#library-hint').textContent=quickTarget&&a?`Adding to ${a.name}${quickRole?' · '+quickRole:''}. You can also drag onto an account in the sidebar.`:'Add a champion to an account or open its shared notes.';
  const board=$('#accounts');board.replaceChildren();
  if(!a){const empty=el('div','empty-board');empty.append(el('h3','','Make room for your pool.'),el('p','','Add an account, then choose champions for each role.'),button('+ Add your first account',newAccount));board.append(empty);return;}
  const orderedRoles=a.roleOrder||ROLES;
  for(const group of groupChampions(a)){
    if(group.role==='Unassigned'&&!group.champions.length)continue;
    const section=el('section','role-section');section.dataset.accountId=a.id;section.dataset.role=group.role;
    const heading=el('div','role-heading');heading.draggable=group.role!=='Unassigned';heading.title=heading.draggable?'Drag this heading to reorder roles':'';
    if(heading.draggable){const grip=el('span','role-grip','⠿');grip.setAttribute('aria-hidden','true');heading.append(grip);}
    const title=el('h3','',group.role);title.tabIndex=-1;heading.append(title,el('span','count',String(group.champions.length)));
    const add=button('+ Add',()=>openLibrary(group.role),`Add ${group.role} champion`);add.className='role-add';heading.append(add);
    if(group.role!=='Unassigned'){
      const index=orderedRoles.indexOf(group.role),up=button('↑',()=>shiftRoleOnBoard(a,group.role,-1),`Move ${group.role} up on ${a.name}`),down=button('↓',()=>shiftRoleOnBoard(a,group.role,1),`Move ${group.role} down on ${a.name}`);
      up.className='role-up';down.className='role-down';up.disabled=index===0;down.disabled=index===ROLES.length-1;heading.append(up,down);
    }
    section.append(heading);
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
$('#practice-nav').onclick=()=>switchView('practice');
$('#open-library').onclick=()=>openLibrary();$('#manage-selected').onclick=()=>{const a=state.accounts.find(a=>a.id===activeAccountId);if(a)accountAction(a);};
$('#new-entry').onclick=newEntry;$('#first-entry').onclick=newEntry;
for(const id of ['entry-title','entry-body','entry-date'])$('#'+id).addEventListener('input',editEntry);
$('#entry-date').addEventListener('blur',()=>{if(!validDate($('#entry-date').value)){$('#entry-date').value=state.journal.find(e=>e.id===activeEntryId)?.date||localDate();$('#entry-date').setCustomValidity('');}});
$('#delete-entry').onclick=async()=>{const entry=state.journal.find(e=>e.id===activeEntryId);if(!entry)return;if(!await formDialog({title:'Delete this journal entry?',description:`${entry.date} · ${entry.title||'Untitled entry'}`,confirm:true,submit:'Delete entry'}))return;undoEntry=structuredClone(entry);undoAccounts=null;undoMatchup=null;state.journal=state.journal.filter(e=>e.id!==entry.id);activeEntryId=null;save();renderJournal();notify('Journal entry deleted.',true);};
function renderNotePlacement(){
  const played=state.accounts.filter(a=>a.champions.includes(selectedChampion));$('#played-on').textContent=played.length?`Played on: ${played.map(a=>a.name).join(' · ')}`:'Not placed on an account yet.';
  const rankedBox=$('#notes-ranked'),total=championRankedStats(state,selectedChampion);rankedBox.replaceChildren();rankedBox.hidden=!total.games;
  if(total.games){rankedBox.append(el('strong','',`Ranked Solo/Duo · ${rankedCoverage(total)}`));for(const account of state.accounts){const stats=championRankedStats(state,selectedChampion,account.id);if(stats.games)rankedBox.append(el('span','',`${account.name}: ${stats.games.toLocaleString()} · ${stats.wins.toLocaleString()}W ${stats.losses.toLocaleString()}L`));}}
  const available=state.accounts.filter(a=>!a.champions.includes(selectedChampion));$('#note-account').replaceChildren();for(const a of available){const o=el('option','',a.name);o.value=a.id;$('#note-account').append(o);}
  $('#note-account').disabled=!available.length;$('#note-add').disabled=!available.length;
  if(!available.length){const o=el('option','',state.accounts.length?'Already on every account':'Create an account first');$('#note-account').append(o);}
}
function matchupPortrait(id){
  const c=champions.get(id);if(!c?.image)return null;
  const link=el('a','matchup-portrait');link.href=lolalyticsUrl(id);link.target='_blank';link.rel='noopener noreferrer';link.title=`Open ${c.name} on LoLalytics`;link.setAttribute('aria-label',link.title);
  const img=el('img');img.src=c.image;img.alt='';img.width=32;img.height=32;img.draggable=false;link.append(img);return link;
}
function renderNotes(){
  if(!selectedChampion)return;
  const c=champions.get(selectedChampion)||{name:selectedChampion,title:'',image:''},profile=$('#notes-lolalytics');
  profile.href=lolalyticsUrl(selectedChampion);profile.title=`Open ${c.name} on LoLalytics`;profile.setAttribute('aria-label',profile.title);
  $('#notes-title').textContent=c.name;$('#notes-subtitle').textContent=c.title;$('#notes-portrait').src=c.image||'/assets/champions/JarvanIV.png';$('#notes-portrait').hidden=!c.image;
  const matchups=state.matchupNotes[selectedChampion]||{};
  if(selectedOpponent&&!Object.hasOwn(matchups,selectedOpponent)){selectedOpponent=null;history.replaceState(null,'',`#/champion/${encodeURIComponent(selectedChampion)}`);}
  document.title=`${c.name}${selectedOpponent?' vs. '+nameOf(selectedOpponent):' notes'} · Champion Board`;
  const list=$('#matchup-notes-list');list.replaceChildren();
  const general=button('General notes',()=>openNotes(selectedChampion),`Open ${c.name} general notes`);general.className='notebook-tab';if(!selectedOpponent)general.setAttribute('aria-current','page');list.append(general);
  for(const opponent of Object.keys(matchups).sort((a,b)=>nameOf(a).localeCompare(nameOf(b)))){
    const row=el('div','notebook-matchup'),portrait=matchupPortrait(opponent),b=button(`vs. ${nameOf(opponent)}`,()=>openNotes(selectedChampion,opponent),`Open ${c.name} vs. ${nameOf(opponent)} notes`);b.className='notebook-tab';if(selectedOpponent===opponent)b.setAttribute('aria-current','page');if(portrait)row.append(portrait);row.append(b);list.append(row);
  }
  $('#matchup-empty').hidden=Object.keys(matchups).length>0;
  const title=$('#notebook-title');title.replaceChildren();title.setAttribute('aria-label',selectedOpponent?`${c.name} vs. ${nameOf(selectedOpponent)}`:'General notes');
  if(selectedOpponent){title.append(el('span','',`${c.name} vs.`));const portrait=matchupPortrait(selectedOpponent);if(portrait)title.append(portrait);title.append(el('span','',nameOf(selectedOpponent)));}else title.textContent='General notes';
  $('#notes-label').textContent=selectedOpponent?'Matchup notes':'Champion notes';
  $('#notes-text').placeholder=selectedOpponent?'Trading patterns, cooldowns, lane decisions, reminders…':'Champion mechanics, build experiments, reminders…';
  $('#notes-text').value=selectedOpponent?matchups[selectedOpponent]:state.notes[selectedChampion]||'';
  $('#delete-matchup').hidden=!selectedOpponent;
  $('#notes-status').textContent=saveBlocked?'Saving paused':dirty?'Not saved':'Saved';$('#note-length').textContent=`${$('#notes-text').value.length.toLocaleString()} characters`;
  $('#close-notes').textContent=notesReturnView==='library'?'← Champion library':'← Account board';renderNotePlacement();
}
function showNotes(id,opponent=null){
  if(dirty)save();if(activeView!=='notes')notesReturnView=activeView==='library'?'library':'account';
  const changed=selectedChampion!==id||activeView!=='notes';selectedChampion=id;selectedOpponent=opponent;activeView='notes';renderBoard();renderNotes();if(changed)$('#notes-page').scrollIntoView({block:'start'});
  $('#notebook-title').focus({preventScroll:true});
}
function openNotes(id,opponent=null){
  const hash=`#/champion/${encodeURIComponent(id)}${opponent?'/matchup/'+encodeURIComponent(opponent):''}`;
  if(location.hash!==hash)history.pushState(null,'',hash);showNotes(id,opponent);
}
function readNotesRoute(){
  const match=location.hash.match(/^#\/champion\/([A-Za-z0-9_-]+)(?:\/matchup\/([A-Za-z0-9_-]+))?$/);
  if(match&&(champions.has(match[1])||Object.hasOwn(state.notes,match[1])||Object.hasOwn(state.matchupNotes,match[1])||state.accounts.some(a=>a.champions.includes(match[1]))))showNotes(match[1],match[2]||null);
  else if(activeView==='notes'){switchView(notesReturnView);document.title='Champion Board';}
}
window.addEventListener('hashchange',readNotesRoute);
$('#notes-text').addEventListener('input',()=>{
  if(!selectedChampion)return;
  if(selectedOpponent)state.matchupNotes[selectedChampion][selectedOpponent]=$('#notes-text').value;else state.notes[selectedChampion]=$('#notes-text').value;
  dirty=true;$('#save-status').textContent='Saving…';$('#notes-status').textContent='Saving…';$('#note-length').textContent=`${$('#notes-text').value.length.toLocaleString()} characters`;clearTimeout(noteTimer);noteTimer=setTimeout(save,400);
});
$('#close-notes').onclick=()=>{const id=selectedChampion;history.pushState(null,'',location.pathname+location.search);switchView(notesReturnView);document.title='Champion Board';document.querySelector(`#${notesReturnView==='library'?'champion-tray':'accounts'} .champ-card[data-champion="${id}"] .champ-name`)?.focus({preventScroll:true});};
function renderMatchupPicker(){
  const query=folded($('#matchup-search').value),alias={j4:'JarvanIV',kha:'Khazix',wukong:'MonkeyKing',nunu:'Nunu',reksai:'RekSai'};
  const results=(catalog?.champions||[]).filter(c=>c.id!==selectedChampion&&(!query||folded(c.name).includes(query)||folded(c.id).includes(query)||alias[query]===c.id));
  const list=$('#matchup-picker-list');list.replaceChildren();
  for(const c of results){const exists=Object.hasOwn(state.matchupNotes[selectedChampion]||{},c.id),b=button('',()=>{
    if(dirty)save();state.matchupNotes[selectedChampion]??={};if(!Object.hasOwn(state.matchupNotes[selectedChampion],c.id)){state.matchupNotes[selectedChampion][c.id]='';save();}
    $('#matchup-dialog').close();openNotes(selectedChampion,c.id);$('#notes-text').focus();
  },`${exists?'Open':'Add'} ${nameOf(selectedChampion)} vs. ${c.name} matchup`);b.className='matchup-choice';b.append(el('span','',c.name),el('span','optional',exists?'Open notes':'Add matchup'));list.append(b);}
  if(!results.length)list.append(el('p','hint','No champions match that search.'));
}
$('#add-matchup').onclick=()=>{$('#matchup-picker-title').textContent=`Add a ${nameOf(selectedChampion)} matchup`;$('#matchup-search').value='';renderMatchupPicker();$('#matchup-dialog').showModal();$('#matchup-search').focus();};
$('#matchup-search').addEventListener('input',renderMatchupPicker);
$('#close-matchup-picker').onclick=()=>$('#matchup-dialog').close();
$('#delete-matchup').onclick=async()=>{
  const champion=selectedChampion,opponent=selectedOpponent;if(!opponent)return;
  if(!await formDialog({title:`Delete ${nameOf(champion)} vs. ${nameOf(opponent)} notes?`,description:'You can restore this matchup with Undo.',confirm:true,submit:'Delete matchup'}))return;
  if(dirty)save();undoAccounts=null;undoEntry=null;undoMatchup={champion,opponent,note:state.matchupNotes[champion][opponent]};delete state.matchupNotes[champion][opponent];if(!Object.keys(state.matchupNotes[champion]).length)delete state.matchupNotes[champion];save();openNotes(champion);renderTray();notify('Matchup notes deleted.',true);
};
$('#note-add').onclick=()=>addToAccount(selectedChampion,$('#note-account').value);
$('#search').addEventListener('input',renderTray);
$('#new-account').onclick=newAccount;
$('#dismiss-toast').onclick=()=>$('#toast').hidden=true;
$('#undo').onclick=()=>{if(undoMatchup){const {champion,opponent,note}=undoMatchup;undoMatchup=null;state.matchupNotes[champion]??={};if(Object.hasOwn(state.matchupNotes[champion],opponent))return notify('Matchup already exists. Your current notes were kept.');state.matchupNotes[champion][opponent]=note;save();openNotes(champion,opponent);renderTray();notify('Matchup notes restored.');return;}if(undoEntry){if(!state.journal.some(e=>e.id===undoEntry.id))state.journal.unshift(undoEntry);activeEntryId=undoEntry.id;undoEntry=null;save();renderJournal();notify('Journal entry restored.');return;}if(!undoAccounts)return;const previous=undoAccounts;undoAccounts=null;state={...state,accounts:previous};save();renderBoard();renderTray();if(selectedChampion)renderNotePlacement();notify('Placement change undone.');};
async function refreshRankedStatus(announce=false){
  clearTimeout(rankedPoll);
  try{
    const response=await fetch('/api/ranked/status'),payload=await response.json();if(!response.ok)throw new Error(payload.error||'Could not read Ranked Solo status.');
    rankedConfigured=Boolean(payload.configured);const merged=mergeRankedHistories(state.rankedHistory,payload.history),changed=JSON.stringify(merged)!==JSON.stringify(state.rankedHistory);if(changed){state={...state,rankedHistory:merged};save();renderBoard();renderTray();if(selectedChampion)renderNotePlacement();}
    const job=payload.job||{state:'idle'};$('#ranked-status').textContent=job.state==='idle'?(rankedConfigured?'API key saved. Counts have not been updated in this session.':'Add a Riot API key to update counts.'):job.message;$('#refresh-ranked').disabled=!rankedConfigured||job.state==='running';
    if(job.state==='running')rankedPoll=setTimeout(()=>refreshRankedStatus(true),1200);else if(announce&&job.state==='complete')notify('Ranked Solo counts updated.');else if(announce&&job.state==='error')notify(job.message);
  }catch(error){$('#ranked-status').textContent=error.message||'Could not read Ranked Solo status.';$('#refresh-ranked').disabled=true;}
}
$('#settings').onclick=()=>{$('#settings-dialog').showModal();refreshRankedStatus();};
$('#close-settings').onclick=()=>$('#settings-dialog').close();
$('#save-riot-key').onclick=async()=>{const key=$('#riot-api-key').value.trim(),button=$('#save-riot-key');if(!key)return notify('Paste a Riot API key first.');button.disabled=true;$('#ranked-status').textContent='Saving key…';try{const response=await fetch('/api/ranked/key',{method:'POST',headers:{'Content-Type':'application/json','X-Champion-Board':'riot-key'},body:JSON.stringify({key})}),payload=await response.json();if(!response.ok)throw new Error(payload.error);$('#riot-api-key').value='';rankedConfigured=true;$('#ranked-status').textContent='API key saved locally.';$('#refresh-ranked').disabled=false;notify('Riot API key saved locally.');}catch(error){$('#ranked-status').textContent=error.message||'Could not save the Riot API key.';}finally{button.disabled=false;}};
$('#refresh-ranked').onclick=async()=>{const linked=state.accounts.filter(account=>account.opggUrl).map(({id,name,opggUrl})=>({id,name,opggUrl}));if(!linked.length)return notify('Add an OP.GG profile to an account first.');const button=$('#refresh-ranked');button.disabled=true;$('#ranked-status').textContent='Starting Ranked Solo update…';try{const response=await fetch('/api/ranked/refresh',{method:'POST',headers:{'Content-Type':'application/json','X-Champion-Board':'ranked-refresh'},body:JSON.stringify({accounts:linked,existing:state.rankedHistory})}),payload=await response.json();if(!response.ok)throw new Error(payload.error);await refreshRankedStatus(true);}catch(error){$('#ranked-status').textContent=error.message||'Could not start the Ranked Solo update.';button.disabled=!rankedConfigured;}};
$('#export').onclick=()=>{$('#settings-dialog').close();save();$('#backup-text').value=JSON.stringify(state,null,2);$('#backup-dialog').showModal();};
$('#close-backup').onclick=()=>$('#backup-dialog').close();
$('#download-backup').onclick=()=>{const blob=new Blob([$('#backup-text').value],{type:'application/json'});const url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=`league-board-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('Backup download requested.');};
$('#import').onclick=()=>{$('#settings-dialog').close();$('#import-file').click();};
$('#import-file').onchange=async()=>{
  const file=$('#import-file').files[0];$('#import-file').value='';if(!file)return;
  try {if(file.size>10*1024*1024)throw new Error('Backup is too large (maximum 10 MB).');const imported=validateState(JSON.parse(await file.text()));const matchupCount=Object.values(imported.matchupNotes).reduce((count,opponents)=>count+Object.keys(opponents).length,0);if(!await formDialog({title:'Replace this board?',description:`Restore ${imported.accounts.length} accounts, ${Object.keys(imported.notes).length} champion notebooks, ${matchupCount} matchup notebook${matchupCount===1?'':'s'}, and ${imported.journal.length} journal entries from this backup. Export your current board first if you want to keep it.`,confirm:true,submit:'Restore backup'}))return;
    clearTimeout(noteTimer);localStorage.setItem(STORAGE_KEY,JSON.stringify(imported));state=imported;saveBlocked=false;undoAccounts=null;undoEntry=null;undoMatchup=null;save();renderBoard();renderTray();renderJournal();if(selectedChampion)renderNotes();notify('Backup restored.');
  }catch(e){notify(`Import failed: ${e.message}`);}
};
$('#refresh-catalog').onclick=async()=>{const b=$('#refresh-catalog');b.disabled=true;b.textContent='Refreshing…';try{const r=await fetch('/api/catalog/refresh',{method:'POST',headers:{'X-Champion-Board':'refresh'}});const next=await r.json();if(!r.ok)throw new Error(next.error);setCatalog(next);notify(`Roster refreshed: ${catalog.champions.length} champions.`);}catch(e){notify(e.message||'Refresh failed. Existing roster kept.');}finally{b.disabled=false;b.textContent='Refresh roster';}};
function setCatalog(next){catalog=next;champions=new Map(catalog.champions.map(c=>[c.id,c]));const catalogIds=new Map(catalog.champions.map(c=>[folded(c.id),c.id]));let normalized=false;for(const account of Object.values(state.rankedHistory.accounts)){for(const match of Object.values(account.matches)){const id=catalogIds.get(folded(match.championId));if(id&&id!==match.championId){match.championId=id;normalized=true;}}}if(normalized)save();$('#catalog-version').textContent=`Data Dragon ${catalog.version}`;renderTray();renderBoard();}
document.addEventListener('dragstart',e=>{
  const heading=e.target.closest('.role-heading[draggable=true]');
  if(heading){if(e.target.closest('button')){e.preventDefault();return;}const section=heading.closest('.role-section');e.dataTransfer.setData('application/x-role-order',JSON.stringify({accountId:section.dataset.accountId,role:section.dataset.role}));e.dataTransfer.effectAllowed='move';heading.classList.add('dragging');return;}
  const c=e.target.closest('.champ-card');if(!c)return;e.dataTransfer.setData('application/x-champion-board',JSON.stringify({championId:c.dataset.champion,sourceId:c.dataset.account||null}));e.dataTransfer.effectAllowed='copyMove';c.classList.add('dragging');
});
function clearDrop(){document.querySelectorAll('.drop-target,.drop-before,.role-drop-before,.role-drop-after,.dragging').forEach(n=>n.classList.remove('drop-target','drop-before','role-drop-before','role-drop-after','dragging'));}
document.addEventListener('dragend',clearDrop);
document.querySelector('.workspace').addEventListener('dragover',e=>{
  const types=Array.from(e.dataTransfer.types);
  if(types.includes('application/x-role-order')){const section=e.target.closest('.role-section');if(!section||section.dataset.role==='Unassigned')return;e.preventDefault();e.dataTransfer.dropEffect='move';document.querySelectorAll('.role-drop-before,.role-drop-after').forEach(n=>n.classList.remove('role-drop-before','role-drop-after'));section.classList.add(e.clientY<section.getBoundingClientRect().top+section.getBoundingClientRect().height/2?'role-drop-before':'role-drop-after');return;}
  if(!types.includes('application/x-champion-board'))return;const a=e.target.closest('[data-account-id]');if(!a)return;e.preventDefault();document.querySelectorAll('.drop-target,.drop-before').forEach(n=>n.classList.remove('drop-target','drop-before'));const zone=e.target.closest('.role-section')||a;zone.classList.add('drop-target');e.target.closest('.champ-card')?.classList.add('drop-before');
});
document.querySelector('.workspace').addEventListener('dragleave',e=>{if(!document.querySelector('.workspace').contains(e.relatedTarget))clearDrop();});
document.querySelector('.workspace').addEventListener('drop',e=>{
  const types=Array.from(e.dataTransfer.types);
  if(types.includes('application/x-role-order')){const section=e.target.closest('.role-section'),after=section?.classList.contains('role-drop-after');e.preventDefault();clearDrop();if(!section||section.dataset.role==='Unassigned')return;try{const {accountId,role}=JSON.parse(e.dataTransfer.getData('application/x-role-order'));if(accountId!==section.dataset.accountId)return;commit(moveRole(state,accountId,role,section.dataset.role,after),`${role} role moved.`);}catch(err){notify(err.message||'Could not reorder role.');}return;}
  if(!types.includes('application/x-champion-board'))return;e.preventDefault();clearDrop();const target=e.target.closest('[data-account-id]');if(!target)return;try{const {championId,sourceId}=JSON.parse(e.dataTransfer.getData('application/x-champion-board'));if(!champions.has(championId)&&!state.accounts.some(a=>a.champions.includes(championId)))return;const role=e.target.closest('[data-role]')?.dataset.role;const before=e.target.closest('.champ-card')?.dataset.champion;const next=role?placeInRole(state,championId,target.dataset.accountId,role,sourceId,before):placeChampion(state,championId,target.dataset.accountId,sourceId,false,before);commit(next,`${nameOf(championId)} placed.`);}catch(err){notify(err.message||'Could not place champion.');}
});
window.addEventListener('beforeunload',e=>{if(dirty&&!save()){e.preventDefault();e.returnValue='';}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&dirty)save();});
window.addEventListener('storage',e=>{if(e.key!==STORAGE_KEY)return;undoAccounts=null;undoEntry=null;undoMatchup=null;$('#undo').hidden=true;if(dirty){saveBlocked=true;banner('This board changed in another tab. Export your current notes before reloading; saving is paused to prevent overwriting the other tab.');$('#save-status').textContent='Saving paused';$('#notes-status').textContent='Saving paused';return;}try{if(!e.newValue)throw new Error();state=validateState(JSON.parse(e.newValue));if(selectedChampion)renderNotes();renderBoard();renderTray();renderJournal();notify('Board updated from another tab.');}catch{saveBlocked=true;banner('Saved data changed unexpectedly. Reload or restore a backup before making further changes.');}});
try{const r=await fetch('/local-account-profiles.json');if(r.ok){const local=await r.json(),next=structuredClone(state);let changed=false;for(const profile of local.profiles||[]){if(!validOpggUrl(profile.url))continue;const account=next.accounts.find(a=>!a.opggUrl&&a.name.toLowerCase()===String(profile.accountName||'').toLowerCase())||next.accounts[profile.index];if(account&&!account.opggUrl){account.opggUrl=profile.url;changed=true;}}if(changed){state=validateState(next);save();}}}catch{/* Optional local-only account links are absent on a fresh checkout. */}
await refreshRankedStatus();
try{const r=await fetch('/api/catalog');if(!r.ok)throw new Error();setCatalog(await r.json());if(!saveBlocked)save();else $('#save-status').textContent='Saving paused';}
catch{banner('The champion roster could not load. Restart the local launcher and reload this page.');renderBoard();}
readNotesRoute();
