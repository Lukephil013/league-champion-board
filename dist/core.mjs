export const STORAGE_KEY = 'league-champion-board:v1';
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
export const SHORTLIST = Object.keys(SEEDS);
export function initialState() { return { schemaVersion: 1, accounts: [], notes: { ...SEEDS } }; }
export function persistState(storage, state) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); return { saved:true }; }
  catch { return { saved:false, message:'Browser storage is unavailable or full. Your current changes are still on screen. Export a backup before closing this page.' }; }
}
export function validateState(raw) {
  const fail = () => { throw new Error('This file is not a valid version 1 Champion Board backup.'); };
  const record = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const id = x => typeof x === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(x) && !['__proto__','constructor','prototype'].includes(x);
  if (!record(raw) || raw.schemaVersion !== 1 || !Array.isArray(raw.accounts) || raw.accounts.length > 200 || !record(raw.notes)) fail();
  const seen = new Set();
  const accounts = raw.accounts.map(a => {
    if (!record(a) || !id(a.id) || seen.has(a.id) || typeof a.name !== 'string' || !a.name.trim() || a.name.length > 80 || !Array.isArray(a.champions) || a.champions.length > 1000 || a.champions.some(c => !id(c)) || new Set(a.champions).size !== a.champions.length) fail();
    seen.add(a.id); return { id: a.id, name: a.name.trim(), champions: [...a.champions] };
  });
  if (Object.keys(raw.notes).length > 2000) fail();
  const notes = {};
  for (const [key,value] of Object.entries(raw.notes)) { if (!id(key) || typeof value !== 'string' || value.length > 100000) fail(); notes[key] = value; }
  return { schemaVersion: 1, accounts, notes };
}
export function placeChampion(state, championId, targetId, sourceId = null, copy = false, beforeId = null) {
  const next = structuredClone(state);
  const target = next.accounts.find(a => a.id === targetId);
  const source = next.accounts.find(a => a.id === sourceId);
  if (!target || (sourceId && (!source || !source.champions.includes(championId)))) return state;
  if (sourceId === targetId && beforeId === championId) return state;
  if (sourceId !== targetId && target.champions.includes(championId)) throw new Error('That champion is already on this account.');
  if (source && !copy) source.champions = source.champions.filter(c => c !== championId);
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
