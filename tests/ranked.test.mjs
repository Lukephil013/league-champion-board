import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseOpggSummonerUrl, refreshRankedHistory, readApiKey, saveApiKey, readRankedHistory, saveRankedHistory, summarizeRankedAccount } from '../ranked.mjs';

test('OP.GG links resolve to the correct Riot routing region and Riot ID',()=>{
  assert.deepEqual(parseOpggSummonerUrl('https://op.gg/lol/summoners/na/PlayerOne-NA1'),{region:'na',route:'americas',gameName:'PlayerOne',tagLine:'NA1',riotId:'PlayerOne#NA1'});
  assert.equal(parseOpggSummonerUrl('https://op.gg/lol/summoners/euw/Name-EUW1').route,'europe');
  assert.throws(()=>parseOpggSummonerUrl('https://example.com/lol/summoners/na/name-tag'));
});

test('Ranked refresh requests queue 420, skips cached match details, and counts wins',async()=>{
  const existing={schemaVersion:1,queueId:420,accounts:{a:{riotId:'PlayerOne#NA1',region:'na',puuid:'puuid-a',updatedAt:'2026-09-01T00:00:00Z',matches:{NA1_1:{championId:'JarvanIV',win:true,gameCreation:1000}}}}};
  const urls=[];
  const fetchImpl=async url=>{
    urls.push(url);
    if(url.includes('/accounts/by-riot-id/'))return new Response(JSON.stringify({puuid:'puuid-a'}),{status:200});
    if(url.includes('/ids?'))return new Response(JSON.stringify(['NA1_1','NA1_2']),{status:200});
    if(url.endsWith('/NA1_2'))return new Response(JSON.stringify({metadata:{},info:{queueId:420,gameCreation:2000,participants:[{puuid:'puuid-a',championName:'XinZhao',win:false}]}}),{status:200});
    throw new Error(`Unexpected request: ${url}`);
  };
  const history=await refreshRankedHistory({apiKey:'RGAPI-test-key-that-is-long-enough',accounts:[{id:'a',name:'Main',opggUrl:'https://op.gg/lol/summoners/na/PlayerOne-NA1'}],existing,fetchImpl});
  assert.ok(urls.some(url=>url.includes('queue=420')));assert.equal(urls.some(url=>url.endsWith('/NA1_1')),false);assert.equal(urls.some(url=>url.endsWith('/NA1_2')),true);
  assert.deepEqual(summarizeRankedAccount(history.accounts.a).champions,{JarvanIV:{games:1,wins:1,losses:0},XinZhao:{games:1,wins:0,losses:1}});
});

test('API key and ranked cache persist only in the runtime directory',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'champion-ranked-test-'));
  try{
    const key='RGAPI-abcdefghijklmnopqrstuvwxyz123456';await saveApiKey(root,key);assert.equal(await readApiKey(root),key);
    const history={schemaVersion:1,queueId:420,accounts:{}};await saveRankedHistory(root,history);assert.deepEqual(await readRankedHistory(root),history);
  }finally{await rm(root,{recursive:true,force:true});}
});
