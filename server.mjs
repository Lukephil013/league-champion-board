import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { activeCatalog, refreshCatalog } from './catalog.mjs';
import { readApiKey, readRankedHistory, refreshRankedHistory, saveApiKey, saveRankedHistory } from './ranked.mjs';

export const PORT = 8789;
export const ORIGIN = `http://127.0.0.1:${PORT}`;
const root = fileURLToPath(new URL('.', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };

function readJsonBody(request, maximum = 10 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let text = '', size = 0, finished = false;
    request.on('data', chunk => {
      if (finished) return;
      size += chunk.length;
      if (size > maximum) { finished = true; reject(new Error('Request is too large.')); request.destroy(); return; }
      text += chunk;
    });
    request.on('end', () => {
      if (finished) return;
      try { resolve(JSON.parse(text || '{}')); } catch { reject(new Error('Invalid JSON request.')); }
    });
    request.on('error', error => { if (!finished) reject(error); });
  });
}

export function createServer(projectRoot = root) {
  let refreshingCatalog = false;
  let rankedJob = { state: 'idle', message: 'Ranked Solo counts have not been updated in this server session.', processed: 0, discovered: 0 };
  return http.createServer(async (req, res) => {
    const send = (code, data, type = 'application/json; charset=utf-8') => {
      res.writeHead(code, {
        'Content-Type': type,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'self'; img-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors http://127.0.0.1:8792"
      });
      res.end(typeof data === 'object' && !Buffer.isBuffer(data) ? JSON.stringify(data) : data);
    };
    if (req.headers.host !== `127.0.0.1:${PORT}`) return send(403, { error: `Open ${ORIGIN} to use this board.` });
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, ORIGIN).pathname); } catch { return send(400, { error: 'Invalid URL.' }); }

    if (req.method === 'GET' && pathname === '/api/health') return send(200, { app: 'league-champion-board', version: 2 });
    if (req.method === 'GET' && pathname === '/api/catalog') {
      try { return send(200, await activeCatalog(projectRoot)); } catch { return send(503, { error: 'The bundled catalog could not be read.' }); }
    }
    if (req.method === 'POST' && pathname === '/api/catalog/refresh') {
      if (req.headers.origin !== ORIGIN || req.headers['x-champion-board'] !== 'refresh') return send(403, { error: 'Use the board Refresh roster button.' });
      if (refreshingCatalog) return send(409, { error: 'A roster refresh is already running.' });
      refreshingCatalog = true;
      try { send(200, await refreshCatalog(projectRoot)); } catch { send(502, { error: 'Could not refresh the roster. Your existing champions and notes are unchanged. Check your connection and try again.' }); } finally { refreshingCatalog = false; }
      return;
    }

    if (req.method === 'GET' && pathname === '/api/ranked/status') {
      const configured = Boolean(await readApiKey(projectRoot));
      const history = rankedJob.state === 'complete' && rankedJob.history ? rankedJob.history : await readRankedHistory(projectRoot);
      const { history: ignored, ...publicJob } = rankedJob;
      return send(200, { configured, job: publicJob, history });
    }
    if (req.method === 'POST' && pathname === '/api/ranked/key') {
      if (req.headers.origin !== ORIGIN || req.headers['x-champion-board'] !== 'riot-key') return send(403, { error: 'Use the board Ranked Solo settings.' });
      try { const body = await readJsonBody(req, 4096); await saveApiKey(projectRoot, body.key); return send(200, { configured: true }); }
      catch (error) { return send(400, { error: error.message || 'Could not save the Riot API key.' }); }
    }
    if (req.method === 'POST' && pathname === '/api/ranked/refresh') {
      if (req.headers.origin !== ORIGIN || req.headers['x-champion-board'] !== 'ranked-refresh') return send(403, { error: 'Use the board Update Ranked Solo counts button.' });
      if (rankedJob.state === 'running') return send(409, { error: 'A Ranked Solo update is already running.' });
      try {
        const body = await readJsonBody(req);
        const apiKey = await readApiKey(projectRoot);
        if (!apiKey) return send(400, { error: 'Add a Riot API key in Settings first.' });
        if (!Array.isArray(body.accounts) || !body.accounts.length) return send(400, { error: 'Link at least one account to OP.GG before updating counts.' });
        rankedJob = { state: 'running', message: 'Resolving linked Riot accounts...', processed: 0, discovered: 0, startedAt: new Date().toISOString() };
        void (async () => {
          try {
            const cached = await readRankedHistory(projectRoot);
            const history = await refreshRankedHistory({
              apiKey,
              accounts: body.accounts,
              existing: body.existing,
              cached,
              onProgress(progress) {
                const messages = { account: `Resolving ${progress.account}...`, listing: `Finding Ranked Solo games for ${progress.account}...`, matches: `Reading ${progress.account}: ${progress.processed} new games processed...` };
                rankedJob = { ...rankedJob, ...progress, message: messages[progress.phase] || 'Updating Ranked Solo counts...' };
              }
            });
            await saveRankedHistory(projectRoot, history);
            rankedJob = { state: 'complete', message: 'Ranked Solo counts are current for all linked accounts.', processed: rankedJob.processed, discovered: rankedJob.discovered, completedAt: new Date().toISOString(), history };
          } catch (error) {
            rankedJob = { state: 'error', message: error.message || 'Ranked Solo update failed.', processed: rankedJob.processed || 0, discovered: rankedJob.discovered || 0, completedAt: new Date().toISOString() };
          }
        })();
        return send(202, { started: true });
      } catch (error) { return send(400, { error: error.message || 'Could not start the Ranked Solo update.' }); }
    }

    if (req.method !== 'GET') return send(405, { error: 'Method not allowed.' });
    if (pathname.includes('\\') || pathname.split('/').some(part => part === '..' || part.startsWith('.'))) return send(404, 'Not found', 'text/plain');
    let base = path.join(projectRoot, 'dist'), relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (pathname.startsWith('/catalog/')) {
      base = path.join(projectRoot, '.catalog-cache');
      relative = pathname.slice('/catalog/'.length);
      if (!/^[0-9]+-[a-f0-9]+\/[A-Za-z0-9]+\.png$/.test(relative)) return send(404, 'Not found', 'text/plain');
    }
    const full = path.resolve(base, relative);
    if (!full.startsWith(path.resolve(base) + path.sep) || !types[path.extname(full)]) return send(404, 'Not found', 'text/plain');
    try { send(200, await readFile(full), types[path.extname(full)]); } catch { send(404, 'Not found', 'text/plain'); }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createServer();
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `Port ${PORT} is in use. Close the conflicting app; this board will not switch addresses.` : error.message); process.exitCode = 1; });
  server.listen(PORT, '127.0.0.1', () => console.log(`Champion Board: ${ORIGIN}`));
}
