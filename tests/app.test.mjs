import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server.mjs';
import { Store } from '../lib/store.mjs';
import { progress, hasAired, validateBackup } from '../lib/model.mjs';

const show = { id: 44933, name: 'Série de teste', genres: ['Drama'], status: 'Ended', premiered: '2020-01-01', summary: '<p>Uma história.</p>', image: null, rating: { average: 8 }, runtime: 45 };
const episodes = [
  { id: 1, name: 'Começo', season: 1, number: 1, airdate: '2020-01-01', airstamp: '2020-01-01T22:00:00Z', runtime: 45 },
  { id: 2, name: 'Continuação', season: 1, number: 2, airdate: '2020-01-08', airstamp: '2020-01-08T22:00:00Z', runtime: 46 },
  { id: 3, name: 'Futuro', season: 2, number: 1, airdate: '2099-01-01', airstamp: '2099-01-01T22:00:00Z', runtime: 44 },
];
async function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'tv-time-test-'));
  const fetcher = async () => new Response(JSON.stringify({ ...show, _embedded: { episodes } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  const app = createApp({ dataDir: dir, fetcher });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const request = async (path, method = 'GET', body, extra = {}) => {
    const r = await fetch(base + path, { method, headers: { ...(method !== 'GET' ? { 'Content-Type': 'application/json' } : {}), ...extra }, ...(method !== 'GET' ? { body: JSON.stringify(body ?? {}) } : {}) });
    return { status: r.status, data: await r.json() };
  };
  t.after(async () => { await new Promise(resolve => app.server.close(resolve)); rmSync(dir, { recursive: true, force: true }); });
  return { ...app, dir, request, base };
}
test('recupera progresso em lote, não marca futuro e permite desfazer', async t => {
  const { request } = await fixture(t);
  assert.equal((await request('/api/library', 'POST', { id: 44933, status: 'watching' })).status, 201);
  const first = await request('/api/library/44933/progress', 'POST', { mode: 'through', episodeId: 3, watched: true });
  assert.deepEqual(first.data.item.watched.map(w => w.episodeId), [1, 2]);
  assert.ok(first.data.item.watched.every(w => w.watchedOn === null));
  assert.equal(progress(first.data.item).next, null);
  const again = await request('/api/library/44933/progress', 'POST', { mode: 'season', season: 1, watched: true });
  assert.equal(again.data.item.watched.length, 2);
  const undone = await request('/api/library/44933/progress', 'POST', { mode: 'single', episodeId: 2, watched: false });
  assert.equal(undone.data.item.status, 'watching');
  assert.equal(progress(undone.data.item).next.id, 2);
  assert.equal((await request('/api/library/44933/progress', 'POST', { mode: 'single', episodeId: 999, watched: true })).status, 400);
});
test('valida importação inteira antes de alterar, mescla sem perder registros e faz backup', async t => {
  const { request, dir } = await fixture(t);
  await request('/api/library', 'POST', { id: 44933 });
  await request('/api/library/44933/progress', 'POST', { mode: 'single', episodeId: 1, watched: true });
  const original = (await request('/api/backup')).data;
  await request('/api/library/44933/progress', 'POST', { mode: 'single', episodeId: 2, watched: true });
  assert.equal((await request('/api/import', 'POST', original)).status, 200);
  assert.equal((await request('/api/library')).data.items[0].watched.length, 2);
  const bad = structuredClone(original);
  bad.items[0].watched.push({ episodeId: 999, markedAt: new Date().toISOString(), watchedOn: null });
  assert.equal((await request('/api/import', 'POST', bad)).status, 400);
  assert.equal((await request('/api/library')).data.items[0].watched.length, 2);
  assert.ok(existsSync(join(dir, 'backups', 'biblioteca-atual.json')));
  const saved = JSON.parse(readFileSync(join(dir, 'backups', 'biblioteca-atual.json')));
  assert.equal(saved.items[0].watched.length, 2);
  await request('/api/library/44933', 'DELETE');
  const previous = JSON.parse(readFileSync(join(dir, 'backups', 'antes-da-ultima-alteracao.json')));
  assert.equal(previous.items.length, 1);
  assert.equal((await request('/api/import', 'POST', previous)).data.total, 1);
});
test('mantém dados após fechar e abrir o banco e não aceita fontes de imagem externas', t => {
  const dir = mkdtempSync(join(tmpdir(), 'tv-time-persist-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  let store = new Store(dir);
  const time = new Date().toISOString();
  const payload = { app: 'tv-time-personal', version: 1, items: [{ show: { ...show, image: { medium: 'https://example.com/tracker.jpg' } }, episodes: structuredClone(episodes), watched: [], status: 'want', rating: null, notes: 'Minha anotação', createdAt: time, updatedAt: time }] };
  store.merge(payload); store.close(); store = new Store(dir);
  assert.equal(store.get(show.id).notes, 'Minha anotação');
  assert.equal(store.get(show.id).show.image.medium, null);
  store.close();
  payload.items[0].episodes.push({ ...episodes[0] });
  assert.throws(() => validateBackup(payload), /duplicados/);
});
test('bloqueia mutações de outros sites e valida notas e status', async t => {
  const { request } = await fixture(t);
  assert.equal((await request('/api/library', 'POST', { id: 44933 }, { Origin: 'https://example.com' })).status, 403);
  assert.equal((await request('/api/library', 'POST', { id: -1 })).status, 400);
  await request('/api/library', 'POST', { id: 44933 });
  assert.equal((await request('/api/library/44933', 'PATCH', { rating: 11 })).status, 400);
  assert.equal((await request('/api/library/44933', 'PATCH', { status: 'anything' })).status, 400);
  assert.equal((await request('/api/library/44933', 'PATCH', { notes: '<script>alert(1)</script>' })).status, 200);
  assert.equal((await request('/api/library')).data.items[0].notes, '<script>alert(1)</script>');
});
test('catálogo offline mantém biblioteca e episódios disponíveis', async t => {
  const { request, catalog, store } = await fixture(t);
  await request('/api/library', 'POST', { id: 44933 });
  catalog.fetcher = async () => { throw new Error('offline'); };
  store.db.exec('DELETE FROM cache');
  const result = await request('/api/shows/44933?refresh=1');
  assert.equal(result.status, 200);
  assert.equal(result.data.stale, true);
  assert.equal(result.data.episodes.length, 3);
  assert.equal((await request('/api/search?q=unknown')).status, 503);
});
test('horário de estreia e data brasileira não liberam episódios antes da hora', () => {
  assert.equal(hasAired({ airstamp: '2026-11-11T22:00:00Z' }, new Date('2026-11-11T21:59:00Z')), false);
  assert.equal(hasAired({ airstamp: '2026-11-11T22:00:00Z' }, new Date('2026-11-11T22:01:00Z')), true);
  assert.equal(hasAired({ airdate: '2026-11-12' }, new Date('2026-11-12T01:00:00Z')), false);
  assert.equal(hasAired({ airdate: null }, new Date()), false);
});
