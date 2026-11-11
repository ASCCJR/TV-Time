import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from './lib/store.mjs';
import { Catalog } from './lib/catalog.mjs';
import { positiveId, statuses, hasAired, progress, today } from './lib/model.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
export function createApp({ dataDir = resolve(root, 'data'), fetcher } = {}) {
  const store = new Store(dataDir);
  const catalog = new Catalog(store, fetcher);
  const server = http.createServer(async (req, res) => {
    const send = (status, value, headers = {}) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
      res.end(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value));
    };
    try {
      const host = req.headers.host || '';
      if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) throw fail('Host não permitido.', 403);
      const url = new URL(req.url, `http://${host}`);
      const path = url.pathname;
      if (!['GET', 'HEAD', 'POST', 'PATCH', 'DELETE'].includes(req.method)) throw fail('Método não permitido.', 405);
      if (req.headers.origin && req.headers.origin !== `http://${host}`) throw fail('Origem não permitida.', 403);
      let body = {};
      if (['POST', 'PATCH', 'DELETE'].includes(req.method)) {
        if (!req.headers['content-type']?.startsWith('application/json')) throw fail('Use JSON.', 415);
        let chunks = [], size = 0;
        for await (const chunk of req) { size += chunk.length; if (size > 30 * 1024 * 1024) throw fail('Arquivo muito grande (máximo de 30 MB).', 413); chunks.push(chunk); }
        try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { throw fail('JSON inválido.'); }
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw fail('Dados inválidos.');
      }
      if (path === '/api/health' && req.method === 'GET') return send(200, { app: 'tv-time-personal', version: '1.0.0' });
      if (path === '/api/library' && req.method === 'GET') return send(200, { items: store.list() });
      if (path === '/api/search' && req.method === 'GET') {
        const query = (url.searchParams.get('q') || '').trim();
        if (query.length < 2 || query.length > 120) throw fail('Digite entre 2 e 120 caracteres para buscar.');
        return send(200, await catalog.search(query));
      }
      if (path === '/api/discover' && req.method === 'GET') return send(200, await catalog.discover());
      if (path === '/api/schedule' && req.method === 'GET') return send(200, await catalog.schedule(today()));
      const detail = path.match(/^\/api\/shows\/(\d+)$/);
      if (detail && req.method === 'GET') {
        const result = await catalog.detail(detail[1], url.searchParams.get('refresh') === '1');
        const existing = store.get(detail[1]);
        if (existing && !result.stale) {
          // Preserve snapshots of watched episodes even if the catalog removes an entry.
          const watchedIds = new Set(existing.watched.map(w => w.episodeId));
          const freshIds = new Set(result.episodes.map(e => e.id));
          const retained = existing.episodes.filter(e => watchedIds.has(e.id) && !freshIds.has(e.id));
          store.put({ ...existing, show: result.show, episodes: [...result.episodes, ...retained] });
        }
        return send(200, { ...result, item: store.get(detail[1]) });
      }
      const art = path.match(/^\/api\/shows\/(\d+)\/artwork$/);
      if (art && req.method === 'GET') return send(200, await catalog.artwork(art[1]));
      if (path === '/api/library' && req.method === 'POST') {
        if (!positiveId(body.id) || !statuses.includes(body.status || 'want')) throw fail('Série ou status inválido.');
        const existing = store.get(body.id);
        if (existing) return send(200, { item: existing });
        const data = await catalog.detail(Number(body.id));
        const timestamp = new Date().toISOString();
        const item = { show: data.show, episodes: data.episodes, status: body.status || 'want', watched: [], rating: null, notes: '', createdAt: timestamp, updatedAt: timestamp };
        store.mutate(() => store.put(item));
        return send(201, { item });
      }
      const edit = path.match(/^\/api\/library\/(\d+)$/);
      if (edit && ['PATCH', 'DELETE'].includes(req.method)) {
        const item = store.get(edit[1]);
        if (!item) throw fail('Série não encontrada na biblioteca.', 404);
        if (req.method === 'DELETE') { store.mutate(() => store.remove(edit[1])); return send(200, { removed: true }); }
        if ('status' in body) { if (!statuses.includes(body.status)) throw fail('Status inválido.'); item.status = body.status; }
        if ('rating' in body) { if (body.rating !== null && (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 10)) throw fail('Escolha uma nota entre 1 e 10.'); item.rating = body.rating; }
        if ('notes' in body) { if (typeof body.notes !== 'string' || body.notes.length > 5000) throw fail('A anotação deve ter até 5.000 caracteres.'); item.notes = body.notes; }
        item.updatedAt = new Date().toISOString(); store.mutate(() => store.put(item));
        return send(200, { item });
      }
      const watch = path.match(/^\/api\/library\/(\d+)\/progress$/);
      if (watch && req.method === 'POST') {
        const item = store.get(watch[1]);
        if (!item) throw fail('Adicione a série à biblioteca primeiro.', 404);
        if (!['single', 'through', 'season', 'all'].includes(body.mode) || typeof body.watched !== 'boolean') throw fail('Alteração de progresso inválida.');
        let episodes = item.episodes;
        if (body.mode === 'single' || body.mode === 'through') {
          const target = episodes.findIndex(e => e.id === body.episodeId);
          if (target < 0) throw fail('Episódio não encontrado.');
          episodes = body.mode === 'single' ? [episodes[target]] : episodes.slice(0, target + 1);
        }
        if (body.mode === 'season') { if (!Number.isInteger(body.season)) throw fail('Temporada inválida.'); episodes = episodes.filter(e => e.season === body.season); }
        if (body.watched) episodes = episodes.filter(e => hasAired(e));
        if (!episodes.length) throw fail('Nenhum episódio já lançado foi encontrado.');
        const recorded = new Map(item.watched.map(w => [w.episodeId, w]));
        for (const e of episodes) {
          if (body.watched && !recorded.has(e.id)) recorded.set(e.id, { episodeId: e.id, markedAt: new Date().toISOString(), watchedOn: body.mode === 'single' && body.justWatched === true ? today() : null });
          if (!body.watched) recorded.delete(e.id);
        }
        item.watched = [...recorded.values()];
        if (body.watched && ['want', 'completed'].includes(item.status)) item.status = 'watching';
        const p = progress(item);
        if (item.show.status === 'Ended' && p.total > 0 && p.watched === p.total && !p.upcoming) item.status = 'completed';
        if (!body.watched && item.status === 'completed') item.status = 'watching';
        item.updatedAt = new Date().toISOString(); store.mutate(() => store.put(item));
        return send(200, { item });
      }
      if (path === '/api/backup' && req.method === 'GET') return send(200, JSON.stringify(store.export(), null, 2), { 'Content-Disposition': `attachment; filename="tv-time-backup-${today()}.json"` });
      if (path === '/api/import' && req.method === 'POST') return send(200, store.merge(body));
      if (path.startsWith('/api/')) throw fail('Rota não encontrada.', 404);
      if (req.method !== 'GET' && req.method !== 'HEAD') throw fail('Método não permitido.', 405);
      const assets = { '/': 'index.html', '/index.html': 'index.html', '/app.js': 'app.js', '/styles.css': 'styles.css', '/icon.svg': 'icon.svg', '/model.mjs': '../lib/model.mjs' };
      if (!assets[path]) throw fail('Arquivo não encontrado.', 404);
      const file = await readFile(join(root, 'public', assets[path]));
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
      return send(200, req.method === 'HEAD' ? '' : file, { 'Content-Type': types[extname(assets[path])] + '; charset=utf-8', 'Content-Security-Policy': "default-src 'self'; img-src 'self' https://static.tvmaze.com data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'", 'Referrer-Policy': 'no-referrer' });
    } catch (error) {
      const status = error.status || (error.message?.includes('backup') || error.message?.includes('inválid') || error.message?.includes('Backup') ? 400 : 500);
      if (status === 500) console.error('Falha interna:', error.message);
      send(status, { error: status === 500 ? 'Não foi possível salvar. Confira o espaço e as permissões da pasta do projeto.' : error.message });
    }
  });
  server.on('close', () => store.close());
  return { server, store, catalog };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4317);
  const { server } = createApp({ dataDir: process.env.TV_TIME_DATA_DIR ? resolve(process.env.TV_TIME_DATA_DIR) : undefined });
  server.on('error', e => { console.error(e.code === 'EADDRINUSE' ? `A porta ${port} já está em uso. Abra http://127.0.0.1:${port} ou escolha outra porta.` : e.message); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`TV Time pronto em http://127.0.0.1:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
}
