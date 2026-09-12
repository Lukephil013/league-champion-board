import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer, PORT, ORIGIN } from '../server.mjs';
function request(server,route,method='GET',headers={}){return new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port:server.address().port,path:route,method,headers:{Host:`127.0.0.1:${PORT}`,...headers}},res=>{let body='';res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,body,headers:res.headers}));});req.on('error',reject);req.end();});}
test('local server serves assets, blocks private paths/origins, and preserves roster on failed refresh',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'champion-board-test-'));const originalFetch=global.fetch;
 await mkdir(path.join(root,'dist'));await writeFile(path.join(root,'dist','index.html'),'<h1>Board</h1>');const catalog={version:'test',champions:[{id:'JarvanIV'}]};await writeFile(path.join(root,'dist','catalog.json'),JSON.stringify(catalog));await writeFile(path.join(root,'private.txt'),'PRIVATE');
 const server=createServer(root);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try {
  assert.equal((await request(server,'/')).status,200);assert.equal(JSON.parse((await request(server,'/api/health')).body).app,'league-champion-board');
  for(const route of ['/../private.txt','/%2e%2e/private.txt','/.git/config','/server.mjs','/catalog/active.json','/.runtime/server.log'])assert.equal((await request(server,route)).status,404);
  assert.equal((await request(server,'/','GET',{Host:'evil.example'})).status,403);
  assert.equal((await request(server,'/api/catalog/refresh','POST',{Origin:'https://evil.example','X-Champion-Board':'refresh'})).status,403);
  global.fetch=async()=>{throw new Error('Simulated offline');};
  assert.equal((await request(server,'/api/catalog/refresh','POST',{Origin:ORIGIN,'X-Champion-Board':'refresh'})).status,502);
  assert.deepEqual(JSON.parse((await request(server,'/api/catalog')).body),catalog);
  assert.match((await request(server,'/')).headers['content-security-policy'],/frame-ancestors 'none'/);
 }finally{global.fetch=originalFetch;await new Promise(r=>server.close(r));assert.ok(path.resolve(root).startsWith(path.resolve(tmpdir())+path.sep)&&path.basename(root).startsWith('champion-board-test-'));await rm(root,{recursive:true,force:true});}
});
