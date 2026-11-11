export const statuses = ['watching', 'want', 'completed', 'paused', 'dropped'];
export const positiveId = value => Number.isSafeInteger(Number(value)) && Number(value) > 0;
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export function hasAired(episode, now = new Date()) {
  if (episode.airstamp) return new Date(episode.airstamp).getTime() <= now.getTime();
  return Boolean(episode.airdate && episode.airdate <= new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now));
}
export function progress(item, now = new Date()) {
  const watched = new Set(item.watched.map(w => w.episodeId));
  const regular = item.episodes.filter(e => e.number !== null);
  const released = regular.filter(e => hasAired(e, now));
  const next = released.find(e => !watched.has(e.id)) || null;
  return { watched: released.filter(e => watched.has(e.id)).length, total: released.length, next, upcoming: regular.find(e => !hasAired(e, now)) || null };
}
export function imageUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'static.tvmaze.com' ? url.href : null; } catch { return null; }
}
export function cleanText(value, max = 10000) {
  return String(value || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').slice(0, max);
}
export function normalizeShow(s) {
  if (!s || !positiveId(s.id) || typeof s.name !== 'string' || !s.name.trim()) throw new Error('Série inválida.');
  return { id: Number(s.id), name: s.name.slice(0, 250), genres: Array.isArray(s.genres) ? s.genres.filter(g => typeof g === 'string').slice(0, 20) : [], summary: cleanText(s.summary), image: { medium: imageUrl(s.image?.medium), original: imageUrl(s.image?.original) }, rating: { average: typeof s.rating?.average === 'number' ? s.rating.average : null }, status: String(s.status || '').slice(0, 50), premiered: typeof s.premiered === 'string' ? s.premiered.slice(0, 10) : null, ended: typeof s.ended === 'string' ? s.ended.slice(0, 10) : null, runtime: Number(s.runtime || s.averageRuntime) || null, language: String(s.language || '').slice(0, 80), network: s.network?.name ? { name: String(s.network.name).slice(0, 100) } : null, webChannel: s.webChannel?.name ? { name: String(s.webChannel.name).slice(0, 100) } : null, url: `https://www.tvmaze.com/shows/${Number(s.id)}` };
}
export function normalizeEpisode(e) {
  if (!e || !positiveId(e.id) || !Number.isInteger(e.season) || e.season < 0 || (e.number !== null && (!Number.isInteger(e.number) || e.number < 1))) throw new Error('Episódio inválido.');
  return { id: Number(e.id), name: String(e.name || 'Sem título').slice(0, 250), season: e.season, number: e.number, airdate: typeof e.airdate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.airdate) ? e.airdate : null, airstamp: e.airstamp && Number.isFinite(Date.parse(e.airstamp)) ? new Date(e.airstamp).toISOString() : null, runtime: Number.isFinite(e.runtime) && e.runtime > 0 && e.runtime < 10000 ? e.runtime : null, summary: cleanText(e.summary), image: { medium: imageUrl(e.image?.medium), original: imageUrl(e.image?.original) } };
}
export function validateBackup(input) {
  if (input?.app !== 'tv-time-personal' || input.version !== 1 || !Array.isArray(input.items) || input.items.length > 2000) throw new Error('Este arquivo não é um backup compatível do TV Time.');
  const ids = new Set(); let count = 0;
  return input.items.map(item => {
    const show = normalizeShow(item.show);
    if (ids.has(show.id)) throw new Error('Backup com séries duplicadas.');
    ids.add(show.id);
    if (!statuses.includes(item.status) || !Array.isArray(item.episodes) || !Array.isArray(item.watched)) throw new Error('Histórico inválido no backup.');
    count += item.episodes.length;
    if (count > 100000) throw new Error('Backup excede o limite de episódios.');
    const episodes = item.episodes.map(normalizeEpisode);
    const episodeIds = new Set(episodes.map(e => e.id));
    if (episodeIds.size !== episodes.length) throw new Error('Backup com episódios duplicados.');
    const seen = new Set();
    const watched = item.watched.map(w => {
      if (!episodeIds.has(w.episodeId) || seen.has(w.episodeId) || !Number.isFinite(Date.parse(w.markedAt)) || (w.watchedOn !== null && !/^\d{4}-\d{2}-\d{2}$/.test(w.watchedOn))) throw new Error('Registro de episódio inválido.');
      seen.add(w.episodeId);
      return { episodeId: w.episodeId, markedAt: new Date(w.markedAt).toISOString(), watchedOn: w.watchedOn };
    });
    if (item.rating !== null && (!Number.isInteger(item.rating) || item.rating < 1 || item.rating > 10)) throw new Error('Nota inválida no backup.');
    return { show, episodes, watched, status: item.status, rating: item.rating, notes: String(item.notes || '').slice(0, 5000), createdAt: validTime(item.createdAt), updatedAt: validTime(item.updatedAt) };
  });
}
function validTime(value) { if (!Number.isFinite(Date.parse(value))) throw new Error('Data inválida no backup.'); return new Date(value).toISOString(); }
