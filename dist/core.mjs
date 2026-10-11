export const STORAGE_KEY = 'league-champion-board:v1';
export const ROLES = ['ADC','Jungle','Mid','Top','Support'];
export const RANKED_QUEUE_ID = 420;
export function validOpggUrl(value) {
  try {const u=new URL(value);const parts=u.pathname.split('/').filter(Boolean);return u.protocol==='https:'&&u.hostname==='op.gg'&&parts.length===4&&parts[0]==='lol'&&parts[1]==='summoners'&&/^[a-z0-9]+$/i.test(parts[2])&&parts[3].length>2;} catch{return false;}
}
export function accountProfiles(account) {
  return account?.opggProfiles ?? (account?.opggUrl ? [{id:account.id,url:account.opggUrl}] : []);
}
export function setAccountProfiles(account, profiles) {
  account.opggProfiles=profiles.map(profile=>({...profile}));
  if(profiles.length)account.opggUrl=profiles[0].url;else delete account.opggUrl;
}
export function accountRankedIds(account) { return [...new Set([account.id,...accountProfiles(account).map(profile=>profile.id)])]; }
export function mergeAccounts(state,targetId,sourceId) {
  if(targetId===sourceId)return state;
  const next=structuredClone(state),target=next.accounts.find(account=>account.id===targetId),source=next.accounts.find(account=>account.id===sourceId);
  if(!target||!source)return state;
  for(const champion of source.champions){
    if(!target.champions.includes(champion))target.champions.push(champion);
    if(!target.championDetails?.[champion]&&source.championDetails?.[champion]){target.championDetails??={};target.championDetails[champion]=structuredClone(source.championDetails[champion]);}
  }
  const profiles=[...accountProfiles(target)];
  for(const profile of accountProfiles(source))if(!profiles.some(existing=>existing.url===profile.url))profiles.push(profile);
  if(profiles.length>10)throw new Error('A pool can have up to 10 OP.GG profiles.');
  if(profiles.length)setAccountProfiles(target,profiles);
  if(source.focus&&source.focus!==target.focus){
    const focus=[target.focus,source.focus].filter(Boolean).join('\n\n');
    if(focus.length>1000)throw new Error('Shorten the account focus text before combining these pools.');
    target.focus=focus;
  }
  next.accounts=next.accounts.filter(account=>account.id!==sourceId);
  return next;
}
export function lolalyticsUrl(championId) {
  if(typeof championId!=='string')throw new Error('Invalid champion ID.');
  const slug=championId==='MonkeyKing'?'wukong':championId.toLowerCase().replace(/[^a-z0-9]/g,'');
  if(!slug)throw new Error('Invalid champion ID.');
  return `https://lolalytics.com/lol/${slug}/build/`;
}
export const SEEDS = {
  JarvanIV: 'YOUR OBSERVATIONS\nFlexible default. Create early pressure, disrupt several lanes, and turn weak points into objectives. Damage when ahead; bruiser options and reliable engage when behind.\n\nWhat feels good: being able to create the game without being locked into one win condition.',
  XinZhao: 'YOUR OBSERVATIONS\nFamiliar backup for forcing early fights and counterjungling. Turn those fights into objective leads.\n\nFROM THE DISCUSSION\nA more specialized aggression tool than J4; options can narrow when behind.',
  Nocturne: 'YOUR OBSERVATIONS\nHeavy counterjungling, then repeated ultimate ganks at level 6. Punish vulnerable lanes and map positioning.\n\nFROM THE DISCUSSION\nStrong at a particular kind of pressure; less flexible when diving a target is no longer threatening.',
  LeeSin: 'YOUR OBSERVATIONS\nFirst jungle champion. The mechanics are familiar but need refreshing.\n\nFROM THE DISCUSSION\nCreative early pressure, displacement, and playmaking. More execution is needed to extract that utility than with J4.',
  Gragas: 'YOUR OBSERVATIONS\nPromising but feels clunky while adjusting to the mechanics. Lich Bane into Shadowflame and Deathcap already supplied more burst than seemed necessary. Interested in movement speed, useful damage, and shorter cooldowns; considering Lucidity boots.\n\nIDEAS FROM THE DISCUSSION — EXPERIMENTS, NOT CURRENT BUILD ADVICE\n• Lich Bane → Rocketbelt → Zhonya’s: try improving access and survival.\n• Lich Bane → Cosmic Drive → Zhonya’s: try repeated disruption.\n• Lich Bane → Stormsurge → Zhonya’s: your proposed burst-oriented alternative.\nCompare how easily you create an engage and get a second rotation, not just first-combo damage.\n\nTO CLARIFY\nThe conversation calls your movement-speed rune “Storm Surge.” The intended rune is unclear; do not treat that as a confirmed rune name.',
  Vi: 'FROM THE DISCUSSION\nAn option to try for proactive ganks and reliable single-target lockdown. Aggressive builds were discussed alongside utility when behind. Engagements can be more committed than J4’s.',
  Graves: 'YOUR OBSERVATIONS\nCan create pressure through creative pathing and early counterjungling, but that pressure feels less directly disruptive than J4 across the map.\n\nTeam context matters: an ahead lane and allied tank/CC can make playing from behind more workable.',
  Khazix: 'YOUR OBSERVATIONS\nInterested in the option. Usefulness from behind depends in part on having an ahead lane and allied tank/CC.\n\nFROM THE DISCUSSION\nConsider the team’s setup and opportunities to punish isolated targets, rather than treating a bad early game as automatically useless.',
  MonkeyKing: 'FROM THE DISCUSSION\nWukong was suggested for carry potential plus teamfight disruption. His level-6 engage offers a fallback after an awkward start. An option to explore, not a recorded personal verdict.',
  Poppy: 'FROM THE DISCUSSION\nSuggested for denying movement, wall stuns, counterganks, and disrupting enemy plans. More utility-focused than the damage-heavy J4 experience. An option to explore.',
  Nunu: 'FROM THE DISCUSSION\nNunu & Willump were suggested for repeat ganks, unusual approach angles, and objective pressure. A different way to keep the enemy reacting. An option to explore.',
  Zac: 'FROM THE DISCUSSION\nSuggested for creating fights from unexpected angles as his levels come online. A different pressure pattern from early dueling and invading. An option to explore.',
  RekSai: 'FROM THE DISCUSSION\nSuggested for early weak-point pressure through tunnels, information, and unusual gank angles. The discussion described a less comfortable fallback than J4. An option to explore.',
  Volibear: 'FROM THE DISCUSSION\nSuggested as an early-aggression option with different build directions. Discussed briefly; no personal testing verdict recorded.'
};
export function emptyRankedHistory() { return { schemaVersion: 1, queueId: RANKED_QUEUE_ID, accounts: {} }; }
export function validateRankedHistory(value) {
  const fail=()=>{throw new Error('Invalid Ranked Solo history.');},record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x),id=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(x)&&!['__proto__','constructor','prototype'].includes(x);
  if(!record(value)||value.schemaVersion!==1||value.queueId!==RANKED_QUEUE_ID||!record(value.accounts))fail();
  const clean=emptyRankedHistory();
  for(const [accountId,account] of Object.entries(value.accounts)){
    if(!id(accountId)||!record(account)||typeof account.riotId!=='string'||account.riotId.length>200||typeof account.region!=='string'||account.region.length>20||typeof account.puuid!=='string'||account.puuid.length>200||!record(account.matches)||Object.keys(account.matches).length>50000)fail();
    const matches={};
    for(const [matchId,match] of Object.entries(account.matches)){if(!id(matchId)||!record(match)||!id(match.championId)||typeof match.win!=='boolean'||!Number.isSafeInteger(match.gameCreation)||match.gameCreation<0)fail();matches[matchId]={championId:match.championId,win:match.win,gameCreation:match.gameCreation};}
    clean.accounts[accountId]={riotId:account.riotId,region:account.region,puuid:account.puuid,updatedAt:typeof account.updatedAt==='string'&&account.updatedAt.length<100?account.updatedAt:'',matches};
  }
  return clean;
}
export function championRankedStats(state,championId,accountId=null){
  let games=0,wins=0,coverageFrom=null,coverageTo=null;
  const accounts=state.rankedHistory?.accounts||{};
  const selected=accountId===null?null:new Set(Array.isArray(accountId)?accountId:[accountId]);
  for(const [id,account] of Object.entries(accounts)){if(selected&&!selected.has(id))continue;for(const match of Object.values(account.matches||{})){if(match.championId!==championId)continue;games++;if(match.win)wins++;if(!coverageFrom||match.gameCreation<coverageFrom)coverageFrom=match.gameCreation;if(!coverageTo||match.gameCreation>coverageTo)coverageTo=match.gameCreation;}}
  return {games,wins,losses:games-wins,coverageFrom,coverageTo};
}
export function accountRankedSummary(state,accountId){
  const ids=[...new Set(Array.isArray(accountId)?accountId:[accountId])],champions={};let games=0,coverageFrom=null,coverageTo=null,updatedAt='';
  for(const id of ids){const account=state.rankedHistory?.accounts?.[id];if(account?.updatedAt&&(!updatedAt||Date.parse(account.updatedAt)>Date.parse(updatedAt)))updatedAt=account.updatedAt;
    for(const match of Object.values(account?.matches||{})){games++;const stats=champions[match.championId]||={games:0,wins:0,losses:0};stats.games++;if(match.win)stats.wins++;else stats.losses++;if(!coverageFrom||match.gameCreation<coverageFrom)coverageFrom=match.gameCreation;if(!coverageTo||match.gameCreation>coverageTo)coverageTo=match.gameCreation;}
  }
  return {games,champions,coverageFrom,coverageTo,updatedAt};
}
export function mergeRankedHistories(...histories){
  const merged=emptyRankedHistory();
  for(const value of histories){if(!value)continue;let clean;try{clean=validateRankedHistory(value);}catch{continue;}for(const [accountId,incoming] of Object.entries(clean.accounts)){const current=merged.accounts[accountId];if(!current||current.puuid!==incoming.puuid){if(!current||Date.parse(incoming.updatedAt||0)>=Date.parse(current.updatedAt||0))merged.accounts[accountId]=structuredClone(incoming);continue;}current.matches={...current.matches,...incoming.matches};if(Date.parse(incoming.updatedAt||0)>=Date.parse(current.updatedAt||0))Object.assign(current,{riotId:incoming.riotId,region:incoming.region,updatedAt:incoming.updatedAt});}}
  return merged;
}
export function initialState() { return { schemaVersion: 4, accounts: [], notes: { ...SEEDS }, matchupNotes: {}, journal: [], rankedHistory: emptyRankedHistory() }; }
export function localDate(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export function validDate(value) { return typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value+'T12:00:00Z')) && new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value; }
export function groupChampions(account) { return [...(account.roleOrder||ROLES),'Unassigned'].map(role=>({role,champions:account.champions.filter(id=>(account.championDetails?.[id]?.role||'Unassigned')===role)})); }
export function moveRole(state,accountId,role,targetRole,after=false){
  if(!ROLES.includes(role)||!ROLES.includes(targetRole))throw new Error('Choose a valid role.');
  if(role===targetRole)return state;
  const account=state.accounts.find(a=>a.id===accountId);if(!account)return state;
  const order=[...(account.roleOrder||ROLES)];order.splice(order.indexOf(role),1);
  order.splice(order.indexOf(targetRole)+(after?1:0),0,role);
  if(order.every((name,index)=>name===(account.roleOrder||ROLES)[index]))return state;
  const next=structuredClone(state);next.accounts.find(a=>a.id===accountId).roleOrder=order;return next;
}
export function persistState(storage, state) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); return { saved:true }; }
  catch { return { saved:false, message:'Browser storage is unavailable or full. Your current changes are still on screen. Export a backup before closing this page.' }; }
}
export function validateState(raw) {
  const fail = () => { throw new Error('This file is not a valid Champion Board backup (versions 1 through 4 are supported).'); };
  const record = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const id = x => typeof x === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(x) && !['__proto__','constructor','prototype'].includes(x);
  if (!record(raw) || ![1,2,3,4].includes(raw.schemaVersion) || !Array.isArray(raw.accounts) || raw.accounts.length > 200 || !record(raw.notes)) fail();
  const seen = new Set();
  const accounts = raw.accounts.map(a => {
    if (!record(a) || !id(a.id) || seen.has(a.id) || typeof a.name !== 'string' || !a.name.trim() || a.name.length > 80 || !Array.isArray(a.champions) || a.champions.length > 1000 || a.champions.some(c => !id(c)) || new Set(a.champions).size !== a.champions.length) fail();
    const account = { id: a.id, name: a.name.trim(), champions: [...a.champions] };
    if(a.roleOrder!==undefined){if(!Array.isArray(a.roleOrder)||a.roleOrder.length!==ROLES.length||new Set(a.roleOrder).size!==ROLES.length||a.roleOrder.some(role=>!ROLES.includes(role)))fail();account.roleOrder=[...a.roleOrder];}
    if (a.focus !== undefined) { if(typeof a.focus !== 'string' || a.focus.length > 1000) fail(); account.focus=a.focus; }
    if (a.opggUrl !== undefined) { if(typeof a.opggUrl!=='string'||!validOpggUrl(a.opggUrl)||a.opggUrl.length>500)fail(); account.opggUrl=a.opggUrl; }
    if(a.opggProfiles!==undefined){
      if(!Array.isArray(a.opggProfiles)||a.opggProfiles.length>10)fail();const profileIds=new Set(),urls=new Set();
      account.opggProfiles=a.opggProfiles.map(profile=>{if(!record(profile)||!id(profile.id)||typeof profile.url!=='string'||profile.url.length>500||!validOpggUrl(profile.url)||profileIds.has(profile.id)||urls.has(profile.url))fail();profileIds.add(profile.id);urls.add(profile.url);return {id:profile.id,url:profile.url};});
      if(account.opggProfiles.length){if(account.opggUrl&&account.opggUrl!==account.opggProfiles[0].url)fail();account.opggUrl=account.opggProfiles[0].url;}else if(account.opggUrl)fail();
    }
    if (a.championDetails !== undefined) {
      if(!record(a.championDetails))fail(); account.championDetails={};
      for(const [champion,detail] of Object.entries(a.championDetails)) {
        if(!id(champion)||!a.champions.includes(champion)||!record(detail)||typeof detail.role!=='string'||(detail.role!==''&&!ROLES.includes(detail.role))||typeof detail.note!=='string'||detail.note.length>300)fail();
        account.championDetails[champion]={role:detail.role,note:detail.note};
      }
    }
    seen.add(a.id); return account;
  });
  if (Object.keys(raw.notes).length > 2000) fail();
  const notes = {};
  for (const [key,value] of Object.entries(raw.notes)) { if (!id(key) || typeof value !== 'string' || value.length > 100000) fail(); notes[key] = value; }
  const rawMatchups=raw.matchupNotes===undefined&&raw.schemaVersion<4?{}:raw.matchupNotes,matchupNotes={};let matchupCount=0;
  if(!record(rawMatchups)||Object.keys(rawMatchups).length>2000)fail();
  for(const [champion,opponents]of Object.entries(rawMatchups)){
    if(!id(champion)||!record(opponents)||Object.keys(opponents).length>2000)fail();
    matchupNotes[champion]={};
    for(const [opponent,note]of Object.entries(opponents)){
      if(!id(opponent)||champion===opponent||typeof note!=='string'||note.length>100000||++matchupCount>10000)fail();
      matchupNotes[champion][opponent]=note;
    }
  }
  const journal=raw.journal??(raw.schemaVersion===1?[]:null);
  if(!Array.isArray(journal)||journal.length>10000)fail();
  const entries=new Set();
  const cleanJournal=journal.map(entry=>{
    if(!record(entry)||!id(entry.id)||entries.has(entry.id)||!validDate(entry.date)||typeof entry.title!=='string'||entry.title.length>160||typeof entry.body!=='string'||entry.body.length>100000)fail();
    entries.add(entry.id);return {id:entry.id,date:entry.date,title:entry.title,body:entry.body};
  });
  let rankedHistory;
  try{rankedHistory=raw.rankedHistory===undefined&&raw.schemaVersion<3?emptyRankedHistory():validateRankedHistory(raw.rankedHistory);}catch{fail();}
  return { schemaVersion: 4, accounts, notes, matchupNotes, journal:cleanJournal, rankedHistory };
}
export function placeInRole(state, championId, targetId, role, sourceId=null, beforeId=null) {
  if(![...ROLES,'Unassigned'].includes(role))throw new Error('Choose a valid role.');
  const placed=placeChampion(state,championId,targetId,sourceId,false,beforeId);
  if(placed===state && !state.accounts.find(a=>a.id===targetId)?.champions.includes(championId))return state;
  const next=placed===state?structuredClone(state):placed,account=next.accounts.find(a=>a.id===targetId);
  if(!account)return state;
  account.championDetails??={};account.championDetails[championId]={role:role==='Unassigned'?'':role,note:account.championDetails[championId]?.note||''};
  return next;
}
export function placeChampion(state, championId, targetId, sourceId = null, copy = false, beforeId = null) {
  const next = structuredClone(state);
  const target = next.accounts.find(a => a.id === targetId);
  const source = next.accounts.find(a => a.id === sourceId);
  if (!target || (sourceId && (!source || !source.champions.includes(championId)))) return state;
  if (sourceId === targetId && beforeId === championId) return state;
  if (sourceId !== targetId && target.champions.includes(championId)) throw new Error('That champion is already on this account.');
  const detail=source?.championDetails?.[championId];
  if(source && !copy) { source.champions=source.champions.filter(c=>c!==championId); if(sourceId!==targetId&&source.championDetails)delete source.championDetails[championId]; }
  if(detail && sourceId!==targetId) { target.championDetails??={}; target.championDetails[championId]={...detail}; }
  if (!target.champions.includes(championId)) {
    const pos = beforeId ? target.champions.indexOf(beforeId) : -1;
    target.champions.splice(pos < 0 ? target.champions.length : pos, 0, championId);
  }
  return next;
}
export function shift(list, value, offset) {
  const next = [...list], i = next.indexOf(value), j = i + offset;
  if (i >= 0 && j >= 0 && j < next.length) [next[i],next[j]] = [next[j],next[i]];
  return next;
}
