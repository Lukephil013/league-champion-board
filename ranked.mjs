import path from 'node:path';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';

export const RANKED_QUEUE_ID = 420;
const KEY_FILE = path.join('.runtime', 'riot-api-key.txt');
const HISTORY_FILE = path.join('.runtime', 'ranked-solo-history.json');
const REGION_ROUTES = {
  na: 'americas', br: 'americas', lan: 'americas', las: 'americas',
  euw: 'europe', eune: 'europe', tr: 'europe', ru: 'europe',
  kr: 'asia', jp: 'asia',
  oce: 'sea', oc: 'sea', ph: 'sea', sg: 'sea', th: 'sea', tw: 'sea', vn: 'sea'
};

const emptyHistory = () => ({ schemaVersion: 1, queueId: RANKED_QUEUE_ID, accounts: {} });
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function parseOpggSummonerUrl(value) {
  const url = new URL(value);
  const parts = url.pathname.split('/').filter(Boolean);
  if (url.protocol !== 'https:' || url.hostname !== 'op.gg' || parts.length !== 4 || parts[0] !== 'lol' || parts[1] !== 'summoners') throw new Error('Use a complete OP.GG summoner profile URL.');
  const region = parts[2].toLowerCase(), handle = decodeURIComponent(parts[3]), split = handle.lastIndexOf('-');
  if (!REGION_ROUTES[region] || split < 1 || split === handle.length - 1) throw new Error('The OP.GG URL must include a supported region, game name, and tag.');
  return { region, route: REGION_ROUTES[region], gameName: handle.slice(0, split), tagLine: handle.slice(split + 1), riotId: `${handle.slice(0, split)}#${handle.slice(split + 1)}` };
}

export function validateRankedHistory(value) {
  if (!record(value) || value.schemaVersion !== 1 || value.queueId !== RANKED_QUEUE_ID || !record(value.accounts)) throw new Error('Invalid Ranked Solo history.');
  const clean = emptyHistory();
  for (const [accountId, account] of Object.entries(value.accounts)) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(accountId) || ['__proto__','constructor','prototype'].includes(accountId) || !record(account) || typeof account.riotId !== 'string' || account.riotId.length > 200 || typeof account.region !== 'string' || !REGION_ROUTES[account.region] || typeof account.puuid !== 'string' || account.puuid.length > 200 || !record(account.matches)) throw new Error('Invalid Ranked Solo history.');
    const matches = {};
    if (Object.keys(account.matches).length > 50000) throw new Error('Ranked Solo history is too large.');
    for (const [matchId, match] of Object.entries(account.matches)) {
      if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(matchId) || ['__proto__','constructor','prototype'].includes(matchId) || !record(match) || typeof match.championId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(match.championId) || ['__proto__','constructor','prototype'].includes(match.championId) || typeof match.win !== 'boolean' || !Number.isSafeInteger(match.gameCreation) || match.gameCreation < 0) throw new Error('Invalid Ranked Solo history.');
      matches[matchId] = { championId: match.championId, win: match.win, gameCreation: match.gameCreation };
    }
    const updatedAt = typeof account.updatedAt === 'string' && !Number.isNaN(Date.parse(account.updatedAt)) ? account.updatedAt : '';
    clean.accounts[accountId] = { riotId: account.riotId, region: account.region, puuid: account.puuid, updatedAt, matches };
  }
  return clean;
}

export function mergeRankedHistories(...histories) {
  const merged = emptyHistory();
  for (const history of histories) {
    if (!history) continue;
    let clean;
    try { clean = validateRankedHistory(history); } catch { continue; }
    for (const [accountId, incoming] of Object.entries(clean.accounts)) {
      const current = merged.accounts[accountId];
      if (!current || incoming.puuid !== current.puuid) {
        if (!current || Date.parse(incoming.updatedAt || 0) >= Date.parse(current.updatedAt || 0)) merged.accounts[accountId] = structuredClone(incoming);
        continue;
      }
      current.matches = { ...current.matches, ...incoming.matches };
      if (Date.parse(incoming.updatedAt || 0) >= Date.parse(current.updatedAt || 0)) Object.assign(current, { riotId: incoming.riotId, region: incoming.region, updatedAt: incoming.updatedAt });
    }
  }
  return merged;
}

export function summarizeRankedAccount(account) {
  const champions = {};
  let coverageFrom = null, coverageTo = null;
  for (const match of Object.values(account?.matches || {})) {
    const stats = champions[match.championId] ||= { games: 0, wins: 0, losses: 0 };
    stats.games += 1;
    if (match.win) stats.wins += 1; else stats.losses += 1;
    if (!coverageFrom || match.gameCreation < coverageFrom) coverageFrom = match.gameCreation;
    if (!coverageTo || match.gameCreation > coverageTo) coverageTo = match.gameCreation;
  }
  return { games: Object.keys(account?.matches || {}).length, champions, coverageFrom, coverageTo };
}

export async function readApiKey(projectRoot) {
  if (typeof process.env.RIOT_API_KEY === 'string' && process.env.RIOT_API_KEY.trim()) return process.env.RIOT_API_KEY.trim();
  try { return (await readFile(path.join(projectRoot, KEY_FILE), 'utf8')).trim(); } catch { return ''; }
}

async function atomicWrite(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  await writeFile(temporary, value, { encoding: 'utf8', mode: 0o600 });
  await rename(temporary, file);
}

export async function saveApiKey(projectRoot, key) {
  const clean = String(key || '').trim();
  if (!/^RGAPI-[A-Za-z0-9_-]{20,}$/.test(clean)) throw new Error('Paste a valid Riot API key beginning with RGAPI-.');
  await atomicWrite(path.join(projectRoot, KEY_FILE), `${clean}\n`);
}

export async function readRankedHistory(projectRoot) {
  try { return validateRankedHistory(JSON.parse(await readFile(path.join(projectRoot, HISTORY_FILE), 'utf8'))); } catch { return emptyHistory(); }
}

export async function saveRankedHistory(projectRoot, history) {
  const clean = validateRankedHistory(history);
  await atomicWrite(path.join(projectRoot, HISTORY_FILE), `${JSON.stringify(clean)}\n`);
  return clean;
}

async function riotJson(url, apiKey, fetchImpl, retries = 3) {
  const response = await fetchImpl(url, { headers: { 'X-Riot-Token': apiKey, Accept: 'application/json' } });
  if (response.status === 429 && retries > 0) {
    const waitSeconds = Math.min(120, Math.max(1, Number(response.headers.get('retry-after')) || 2));
    await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
    return riotJson(url, apiKey, fetchImpl, retries - 1);
  }
  if (response.status === 401 || response.status === 403) throw new Error('Riot rejected the API key. Save a current key in Settings and try again.');
  if (response.status === 404) throw new Error('Riot could not find one of the linked accounts. Check its OP.GG Riot ID.');
  if (!response.ok) throw new Error(`Riot API request failed (${response.status}). Try again later.`);
  return response.json();
}

export async function refreshRankedHistory({ apiKey, accounts, existing, cached, fetchImpl = fetch, onProgress = () => {} }) {
  if (!apiKey) throw new Error('Add a Riot API key in Settings first.');
  if (!Array.isArray(accounts) || !accounts.length || accounts.length > 20) throw new Error('Link at least one account to OP.GG before updating counts.');
  let history = mergeRankedHistories(cached, existing);
  let processed = 0, discovered = 0;
  for (let accountIndex = 0; accountIndex < accounts.length; accountIndex += 1) {
    const input = accounts[accountIndex];
    if (!record(input) || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(input.id) || ['__proto__','constructor','prototype'].includes(input.id) || typeof input.name !== 'string' || input.name.length > 80 || typeof input.opggUrl !== 'string') throw new Error('Invalid account data.');
    const profile = parseOpggSummonerUrl(input.opggUrl);
    onProgress({ account: input.name, accountIndex, accountTotal: accounts.length, processed, discovered, phase: 'account' });
    const identityUrl = `https://${profile.route}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(profile.gameName)}/${encodeURIComponent(profile.tagLine)}`;
    const identity = await riotJson(identityUrl, apiKey, fetchImpl);
    if (!identity || typeof identity.puuid !== 'string') throw new Error(`Riot returned an invalid identity for ${input.name}.`);
    const previous = history.accounts[input.id]?.puuid === identity.puuid ? history.accounts[input.id] : null;
    const account = { riotId: profile.riotId, region: profile.region, puuid: identity.puuid, updatedAt: previous?.updatedAt || '', matches: { ...(previous?.matches || {}) } };
    const matchIds = [];
    for (let start = 0; start < 10000; start += 100) {
      const idsUrl = `https://${profile.route}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(identity.puuid)}/ids?queue=${RANKED_QUEUE_ID}&start=${start}&count=100`;
      const page = await riotJson(idsUrl, apiKey, fetchImpl);
      if (!Array.isArray(page)) throw new Error(`Riot returned invalid match history for ${input.name}.`);
      matchIds.push(...page.filter(id => typeof id === 'string'));
      discovered = matchIds.length;
      onProgress({ account: input.name, accountIndex, accountTotal: accounts.length, processed, discovered, phase: 'listing' });
      if (page.length < 100) break;
    }
    const unseen = matchIds.filter(id => !account.matches[id]);
    discovered = unseen.length;
    for (const matchId of unseen) {
      const matchUrl = `https://${profile.route}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(matchId)}`;
      const match = await riotJson(matchUrl, apiKey, fetchImpl);
      if (match?.info?.queueId === RANKED_QUEUE_ID) {
        const participant = match.info.participants?.find(p => p.puuid === identity.puuid);
        if (participant && typeof participant.championName === 'string') account.matches[matchId] = { championId: participant.championName, win: Boolean(participant.win), gameCreation: Number.isSafeInteger(match.info.gameCreation) ? match.info.gameCreation : 0 };
      }
      processed += 1;
      onProgress({ account: input.name, accountIndex, accountTotal: accounts.length, processed, discovered, phase: 'matches' });
    }
    account.updatedAt = new Date().toISOString();
    history.accounts[input.id] = account;
  }
  return validateRankedHistory(history);
}
