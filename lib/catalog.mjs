import { normalizeShow, normalizeEpisode, imageUrl } from './model.mjs';

export const selections = [44933, 17861, 54198, 169, 44458, 46562, 51394, 335, 16149, 305, 38052, 48830];
export class Catalog {
  constructor(store, fetcher = fetch) { this.store = store; this.fetcher = fetcher; this.pending = new Map(); this.lastRequest = 0; this.queue = Promise.resolve(); }
  async request(path, { force = false } = {}) {
    const hit = this.store.cached(path);
    if (hit && !force) return { data: hit, stale: false };
    if (this.pending.has(path)) return this.pending.get(path);
    const task = this.load(path).finally(() => this.pending.delete(path));
    this.pending.set(path, task);
    return task;
  }
  async load(path) {
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        this.queue = this.queue.catch(() => {}).then(async () => { await new Promise(r => setTimeout(r, Math.max(0, 550 - (Date.now() - this.lastRequest)))); this.lastRequest = Date.now(); });
        await this.queue;
        const response = await this.fetcher(`https://api.tvmaze.com${path}`, { headers: { 'User-Agent': 'TV-Time-Personal/1.0 (https://github.com/ASCCJR/TV-Time)' }, signal: AbortSignal.timeout(12000) });
        if (response.status === 429 && attempt < 2) { await new Promise(r => setTimeout(r, 2500 * (attempt + 1))); continue; }
        if (!response.ok) throw new Error(`TVMaze ${response.status}`);
        const data = await response.json();
        this.store.cache(path, data);
        return { data, stale: false };
      }
    } catch {
      const fallback = this.store.cached(path, true);
      if (fallback) return { data: fallback, stale: true };
      throw Object.assign(new Error('O catálogo está indisponível agora. Sua biblioteca continua salva. Tente novamente em instantes.'), { status: 503 });
    }
  }
  async search(query) {
    const result = await this.request(`/search/shows?q=${encodeURIComponent(query)}`);
    return { shows: result.data.map(r => normalizeShow(r.show)), stale: result.stale };
  }
  async detail(id, force = false) {
    try {
      const result = await this.request(`/shows/${id}?embed=episodes`, { force });
      return { show: normalizeShow(result.data), episodes: (result.data._embedded?.episodes || []).map(normalizeEpisode), stale: result.stale };
    } catch (error) {
      const local = this.store.get(id);
      if (local) return { show: local.show, episodes: local.episodes, stale: true };
      throw error;
    }
  }
  async discover() {
    const settled = await Promise.allSettled(selections.map(id => this.request(`/shows/${id}`)));
    const shows = settled.filter(r => r.status === 'fulfilled').map(r => normalizeShow(r.value.data));
    if (!shows.length) throw Object.assign(new Error('Não foi possível carregar as sugestões. Confira a conexão e tente novamente.'), { status: 503 });
    return { shows, partial: shows.length < selections.length, stale: settled.some(r => r.status === 'fulfilled' && r.value.stale) };
  }
  async artwork(id) {
    const result = await this.request(`/shows/${id}/images`);
    const backgrounds = result.data.filter(i => i.type === 'background');
    const chosen = backgrounds.find(i => i.main) || backgrounds[0];
    return { background: imageUrl(chosen?.resolutions?.original?.url) };
  }
  async schedule(date) {
    const result = await this.request(`/schedule/web?date=${date}`);
    const seen = new Set();
    const shows = [];
    for (const episode of result.data) {
      const show = episode._embedded?.show || episode.show;
      if (!show || seen.has(show.id)) continue;
      seen.add(show.id); shows.push({ ...normalizeShow(show), airing: { season: episode.season, number: episode.number } });
    }
    return { shows, stale: result.stale };
  }
}
