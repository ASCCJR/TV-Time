import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { validateBackup, today } from './model.mjs';

export class Store {
  constructor(dir) {
    this.dir = dir;
    mkdirSync(join(dir, 'backups'), { recursive: true });
    this.db = new DatabaseSync(join(dir, 'library.sqlite'));
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS library (id INTEGER PRIMARY KEY, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, body TEXT NOT NULL, expires INTEGER NOT NULL);');
  }
  list() { return this.db.prepare('SELECT body FROM library ORDER BY id').all().map(r => JSON.parse(r.body)); }
  get(id) { const row = this.db.prepare('SELECT body FROM library WHERE id=?').get(Number(id)); return row ? JSON.parse(row.body) : null; }
  put(item) { this.db.prepare('INSERT OR REPLACE INTO library (id, body) VALUES (?, ?)').run(item.show.id, JSON.stringify(item)); }
  remove(id) { this.db.prepare('DELETE FROM library WHERE id=?').run(Number(id)); }
  export() { return { app: 'tv-time-personal', version: 1, exportedAt: new Date().toISOString(), items: this.list() }; }
  writeBackup(name, payload) {
    const file = join(this.dir, 'backups', name);
    writeFileSync(file + '.tmp', JSON.stringify(payload, null, 2), { mode: 0o600 });
    renameSync(file + '.tmp', file);
  }
  mutate(fn) {
    const previous = this.export();
    this.writeBackup('antes-da-ultima-alteracao.json', previous);
    const daily = `inicio-do-dia-${today()}.json`;
    if (!existsSync(join(this.dir, 'backups', daily))) this.writeBackup(daily, previous);
    this.db.exec('BEGIN IMMEDIATE');
    let result;
    try { result = fn(); this.db.exec('COMMIT'); }
    catch (e) { this.db.exec('ROLLBACK'); throw e; }
    try { this.writeBackup('biblioteca-atual.json', this.export()); }
    catch { console.error('O histórico foi salvo no banco, mas não foi possível atualizar a cópia JSON.'); }
    return result;
  }
  merge(input) {
    const incoming = validateBackup(input);
    return this.mutate(() => {
      for (const item of incoming) {
        const current = this.get(item.show.id);
        if (!current) { this.put(item); continue; }
        const base = item.updatedAt > current.updatedAt ? item : current;
        const episodes = [...new Map([...item.episodes, ...current.episodes].map(e => [e.id, e])).values()].sort((a, b) => a.season - b.season || (a.number ?? 9999) - (b.number ?? 9999));
        const watched = [...new Map([...item.watched, ...current.watched].map(w => [w.episodeId, w])).values()];
        this.put({ ...base, episodes, watched, updatedAt: new Date().toISOString() });
      }
      return { imported: incoming.length, total: this.list().length };
    });
  }
  cached(key, stale = false) {
    const row = this.db.prepare('SELECT body, expires FROM cache WHERE key=?').get(key);
    return row && (stale || row.expires > Date.now()) ? JSON.parse(row.body) : null;
  }
  cache(key, data, ttl = 86400000) { this.db.prepare('INSERT OR REPLACE INTO cache VALUES (?, ?, ?)').run(key, JSON.stringify(data), Date.now() + ttl); }
  close() { this.db.close(); }
}
