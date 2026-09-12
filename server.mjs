import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { activeCatalog, refreshCatalog } from './catalog.mjs';
export const PORT = 8789;
export const ORIGIN = `http://127.0.0.1:${PORT}`;
const root = fileURLToPath(new URL('.',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
export function createServer(projectRoot = root) {
  let refreshing = false;
  return http.createServer(async(req,res)=>{
    const send=(code,data,type='application/json; charset=utf-8')=>{res.writeHead(code,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; img-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});res.end(typeof data==='object'&&!Buffer.isBuffer(data)?JSON.stringify(data):data);};
    if(req.headers.host!==`127.0.0.1:${PORT}`) return send(403,{error:`Open ${ORIGIN} to use this board.`});
    let pathname;
    try { pathname=decodeURIComponent(new URL(req.url,ORIGIN).pathname); } catch { return send(400,{error:'Invalid URL.'}); }
    if(req.method==='GET'&&pathname==='/api/health')return send(200,{app:'league-champion-board',version:1});
    if(req.method==='GET'&&pathname==='/api/catalog'){try{return send(200,await activeCatalog(projectRoot));}catch{return send(503,{error:'The bundled catalog could not be read.'});}}
    if(req.method==='POST'&&pathname==='/api/catalog/refresh') {
      if(req.headers.origin!==ORIGIN||req.headers['x-champion-board']!=='refresh')return send(403,{error:'Use the board’s Refresh roster button.'});
      if(refreshing)return send(409,{error:'A roster refresh is already running.'});
      refreshing=true;
      try { send(200,await refreshCatalog(projectRoot)); } catch { send(502,{error:'Could not refresh the roster. Your existing champions and notes are unchanged. Check your connection and try again.'}); } finally { refreshing=false; }
      return;
    }
    if(req.method!=='GET')return send(405,{error:'Method not allowed.'});
    if(pathname.includes('\\')||pathname.split('/').some(p=>p==='..'||p.startsWith('.')))return send(404,'Not found','text/plain');
    let base=path.join(projectRoot,'dist'),relative=pathname==='/'?'index.html':pathname.slice(1);
    if(pathname.startsWith('/catalog/')) { base=path.join(projectRoot,'.catalog-cache'); relative=pathname.slice('/catalog/'.length); if(!/^[0-9]+-[a-f0-9]+\/[A-Za-z0-9]+\.png$/.test(relative))return send(404,'Not found','text/plain'); }
    const full=path.resolve(base,relative);
    if(!full.startsWith(path.resolve(base)+path.sep)||!types[path.extname(full)])return send(404,'Not found','text/plain');
    try { send(200,await readFile(full),types[path.extname(full)]); } catch { send(404,'Not found','text/plain'); }
  });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const server=createServer();
  server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`Port ${PORT} is in use. Close the conflicting app; this board will not switch addresses.`:e.message);process.exitCode=1;});
  server.listen(PORT,'127.0.0.1',()=>console.log(`Champion Board: ${ORIGIN}`));
}
