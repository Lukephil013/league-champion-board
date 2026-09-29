import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer, PORT, ORIGIN } from '../server.mjs';
function request(server,route,method='GET',headers={},body=''){return new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port:server.address().port,path:route,method,headers:{Host:`127.0.0.1:${PORT}`,...headers,...(body?{'Content-Length':Buffer.byteLength(body)}:{})}},res=>{let responseBody='';res.on('data',c=>responseBody+=c);res.on('end',()=>resolve({status:res.statusCode,body:responseBody,headers:res.headers}));});req.on('error',reject);req.end(body);});}
test('local server serves assets, blocks private paths/origins, and preserves roster on failed refresh',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'champion-board-test-'));const originalFetch=global.fetch;
 await mkdir(path.join(root,'dist'));await writeFile(path.join(root,'dist','index.html'),'<h1>Board</h1>');const catalog={version:'test',champions:[{id:'JarvanIV'}]};await writeFile(path.join(root,'dist','catalog.json'),JSON.stringify(catalog));await writeFile(path.join(root,'private.txt'),'PRIVATE');
 const server=createServer(root);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try {
  assert.equal((await request(server,'/')).status,200);assert.equal(JSON.parse((await request(server,'/api/health')).body).app,'league-champion-board');
  for(const route of ['/../private.txt','/%2e%2e/private.txt','/.git/config','/server.mjs','/ranked.mjs','/catalog/active.json','/.runtime/server.log'])assert.equal((await request(server,route)).status,404);
  assert.equal((await request(server,'/','GET',{Host:'evil.example'})).status,403);
  assert.equal((await request(server,'/api/catalog/refresh','POST',{Origin:'https://evil.example','X-Champion-Board':'refresh'})).status,403);
  assert.equal(JSON.parse((await request(server,'/api/ranked/status')).body).configured,false);
  assert.equal((await request(server,'/api/ranked/key','POST',{Origin:'https://evil.example','X-Champion-Board':'riot-key','Content-Type':'application/json'},JSON.stringify({key:'RGAPI-abcdefghijklmnopqrstuvwxyz123456'}))).status,403);
  assert.equal((await request(server,'/api/ranked/key','POST',{Origin:ORIGIN,'X-Champion-Board':'riot-key','Content-Type':'application/json'},JSON.stringify({key:'bad'}))).status,400);
  assert.equal((await request(server,'/api/ranked/key','POST',{Origin:ORIGIN,'X-Champion-Board':'riot-key','Content-Type':'application/json'},JSON.stringify({key:'RGAPI-abcdefghijklmnopqrstuvwxyz123456'}))).status,200);
  assert.equal(JSON.parse((await request(server,'/api/ranked/status')).body).configured,true);
  global.fetch=async()=>{throw new Error('Simulated offline');};
  assert.equal((await request(server,'/api/catalog/refresh','POST',{Origin:ORIGIN,'X-Champion-Board':'refresh'})).status,502);
  assert.deepEqual(JSON.parse((await request(server,'/api/catalog')).body),catalog);
  global.fetch=async url=>{if(url.includes('/accounts/by-riot-id/'))return new Response(JSON.stringify({puuid:'puuid-a'}),{status:200});if(url.includes('/ids?'))return new Response(JSON.stringify(['NA1_99']),{status:200});if(url.endsWith('/NA1_99'))return new Response(JSON.stringify({info:{queueId:420,gameCreation:1000,participants:[{puuid:'puuid-a',championName:'JarvanIV',win:true}]}}),{status:200});throw new Error(`Unexpected URL: ${url}`);};
  const refreshBody=JSON.stringify({accounts:[{id:'a',name:'Main',opggUrl:'https://op.gg/lol/summoners/na/PlayerOne-NA1'}],existing:{schemaVersion:1,queueId:420,accounts:{}}});
  assert.equal((await request(server,'/api/ranked/refresh','POST',{Origin:ORIGIN,'X-Champion-Board':'ranked-refresh','Content-Type':'application/json'},refreshBody)).status,202);
  let ranked;for(let attempt=0;attempt<20;attempt++){ranked=JSON.parse((await request(server,'/api/ranked/status')).body);if(ranked.job.state!=='running')break;await new Promise(resolve=>setTimeout(resolve,10));}
  assert.equal(ranked.job.state,'complete');assert.equal(ranked.history.accounts.a.matches.NA1_99.championId,'JarvanIV');
  assert.match((await request(server,'/')).headers['content-security-policy'],/frame-ancestors http:\/\/127\.0\.0\.1:8792/);
 }finally{global.fetch=originalFetch;await new Promise(r=>server.close(r));assert.ok(path.resolve(root).startsWith(path.resolve(tmpdir())+path.sep)&&path.basename(root).startsWith('champion-board-test-'));await rm(root,{recursive:true,force:true});}
});
