import { progress, hasAired } from '/model.mjs';

const icons = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  library: '<rect x="3" y="4" width="5" height="16" rx="1"/><path d="M12 4v16M16 5l5 14"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6z"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  coffee: '<path d="M4 8h13v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM17 9h2a3 3 0 0 1 0 6h-2M7 2v2m5-2v2M2 22h18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  play: '<path d="m8 4 12 8-12 8z"/>',
  star: '<path d="m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3-5.7-3-5.7 3 1.1-6.3-4.6-4.5 6.4-.9z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  sparkles: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5zM20 2v4m-2-2h4"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5M5.5 7a8 8 0 0 1 13-2l1.5 2M4 17l1.5 2a8 8 0 0 0 13-2"/>',
  tv: '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="m8 2 4 4 4-4M8 23h8"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.tv}</svg>`;
document.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = icon(el.dataset.icon));
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const labels = { watching: 'Assistindo', want: 'Quero assistir', completed: 'Concluídas', paused: 'Pausadas', dropped: 'Abandonei' };
const genres = { Drama: 'Drama', Comedy: 'Comédia', 'Science-Fiction': 'Ficção científica', Thriller: 'Suspense', Crime: 'Crime', Mystery: 'Mistério', Horror: 'Terror', Action: 'Ação', Romance: 'Romance', Adventure: 'Aventura', Fantasy: 'Fantasia', Supernatural: 'Sobrenatural', Food: 'Gastronomia', Sports: 'Esportes', Anime: 'Anime', Family: 'Família' };
const state = { library: [], shows: [], artwork: null, catalogLoading: true, catalogError: '', route: 'home', filter: 'all', genre: 'all', tab: 'curated', schedule: null, dialog: null, busy: false, routeId: 0, dialogId: 0 };
async function api(path, method = 'GET', body) {
  const response = await fetch(path, { method, ...(method !== 'GET' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) } : {}) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir. Tente novamente.');
  return data;
}
let toastTimer;
function toast(message, error = false) { const el = $('#toast'); el.textContent = message; el.className = `toast visible${error ? ' error' : ''}`; clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), error ? 6500 : 3500); }
const year = show => show.premiered?.slice(0, 4) || 'Sem data';
const code = e => e ? `T${String(e.season).padStart(2, '0')} · E${String(e.number ?? 'ESP').padStart(2, '0')}` : '';
const date = value => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value.length === 10 ? value + 'T12:00:00Z' : value)) : 'Sem data';
const itemFor = id => state.library.find(item => item.show.id === Number(id));
const image = (show, cls = '', eager = false) => show.image?.medium ? `<img class="${cls}" src="${esc(show.image.medium)}" alt="Pôster de ${esc(show.name)}" loading="${eager ? 'eager' : 'lazy'}" referrerpolicy="no-referrer">` : `<div class="poster-placeholder ${cls}">${icon('tv')}<span>${esc(show.name)}</span></div>`;
function updateItem(item) {
  const index = state.library.findIndex(i => i.show.id === item.show.id);
  if (index === -1) state.library.push(item); else state.library[index] = item;
  if (state.dialog?.show.id === item.show.id) state.dialog.item = item;
  $('#library-count').textContent = state.library.length;
}
function card(show, options = {}) {
  const item = itemFor(show.id);
  const p = item ? progress(item) : null;
  return `<article class="show-card"><button class="poster-button" data-action="open" data-id="${show.id}" aria-label="Ver ${esc(show.name)}">${image(show)}<span class="poster-shade"></span>${show.rating?.average ? `<span class="score">${icon('star')}${show.rating.average.toFixed(1)}</span>` : ''}${item ? `<span class="poster-label">${icon('check')}${esc(labels[item.status])}</span>` : ''}<span class="poster-open">Ver série ${icon('arrow')}</span></button><div class="card-copy"><button class="title-button" data-action="open" data-id="${show.id}">${esc(show.name)}</button><span class="card-meta">${year(show)}<span>·</span>${esc(genres[show.genres[0]] || show.genres[0] || 'Série')}</span>${options.reason ? `<small class="card-reason">${icon('sparkles')}${esc(options.reason)}</small>` : ''}${p && state.route === 'library' ? `<div class="progress-track"><i style="width:${p.total ? p.watched / p.total * 100 : 0}%"></i></div><small class="card-progress">${p.watched} de ${p.total} episódios lançados</small>` : ''}</div><button class="card-add${item ? ' added' : ''}" data-action="${item ? 'open' : 'add'}" data-id="${show.id}" title="${item ? 'Ver na biblioteca' : 'Quero assistir'}" aria-label="${item ? 'Ver' : 'Adicionar'} ${esc(show.name)}${item ? '' : ' à lista'}">${icon(item ? 'check' : 'plus')}</button></article>`;
}
function sectionHeading(title, subtitle, action = '') { return `<div class="section-heading"><div><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}</div>${action}</div>`; }
function skeletonCards() { return `<div class="show-grid">${Array.from({ length: 5 }, () => '<div class="skeleton-card"><div></div><span></span><small></small></div>').join('')}</div>`; }
function catalogContent(shows, options) { if (state.catalogLoading) return skeletonCards(); if (state.catalogError && !shows.length) return `<div class="empty-state compact">${icon('compass')}<h3>O catálogo deu uma pausa.</h3><p>${esc(state.catalogError)}</p><button class="button secondary" data-action="reload-catalog">${icon('refresh')}Tentar novamente</button></div>`; return `<div class="show-grid">${shows.map(s => card(s, options)).join('')}</div>`; }
function intro(eyebrow, title, description, action = '') { return `<div class="page-intro"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${description}</p></div>${action}</div>`; }
function continueCard(item) {
  const p = progress(item);
  const next = p.next;
  return `<article class="continue-card"><button class="continue-poster" data-action="open" data-id="${item.show.id}">${image(item.show)}</button><div><small>${next ? 'PRÓXIMO EPISÓDIO' : 'VOCÊ ESTÁ EM DIA'}</small><button class="title-button" data-action="open" data-id="${item.show.id}">${esc(item.show.name)}</button><p>${next ? `${code(next)} <span>·</span> ${esc(next.name)}` : p.upcoming ? `Próximo: ${date(p.upcoming.airdate)}` : 'Novos capítulos, quando chegarem.'}</p><div class="continue-bottom"><div class="mini-progress"><div class="progress-track"><i style="width:${p.total ? p.watched / p.total * 100 : 0}%"></i></div><span>${p.watched}/${p.total} episódios</span></div>${next ? `<button class="watched-button" data-action="quick-watch" data-id="${item.show.id}" data-episode="${next.id}" title="Marcar ${code(next)} como assistido" aria-label="Marcar ${code(next)} de ${esc(item.show.name)} como assistido">${icon('check')}</button>` : `<span class="up-to-date">${icon('check')}</span>`}</div></div></article>`;
}
function homePage() {
  const watching = state.library.filter(i => i.status === 'watching').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const minutes = state.library.reduce((sum, item) => { const ids = new Set(item.watched.map(w => w.episodeId)); return sum + item.episodes.filter(e => ids.has(e.id)).reduce((n, e) => n + (e.runtime || item.show.runtime || 0), 0); }, 0);
  const episodes = state.library.reduce((n, item) => n + item.watched.length, 0);
  const picks = state.shows.filter(s => !itemFor(s.id)).slice(0, 5);
  return `${intro('BOM TER VOCÊ POR AQUI', 'Seu próximo episódio começa aqui<span class="accent">.</span>', 'Descubra uma história. Volte para uma favorita. Aproveite o seu tempo.')}
    <section class="hero" aria-label="Sugestão de série">${state.artwork ? `<img class="hero-art" src="${esc(state.artwork)}" alt="Cena da série Severance" fetchpriority="high">` : '<div class="hero-art hero-fallback"></div>'}<div class="hero-overlay"></div><div class="hero-content"><span class="hero-eyebrow">${icon('sparkles')} UMA BOA HISTÓRIA PARA MERGULHAR</span><h2>Uma vida dentro.<br>Outra lá fora.</h2><div class="hero-meta"><strong>Severance</strong><span>2022</span><span>Ficção científica · Mistério</span></div><p>E se fosse possível separar as lembranças do trabalho das da vida pessoal? Um mistério para assistir sem pressa.</p><div class="actions"><button class="button primary" data-action="open" data-id="44933">Explorar a série ${icon('arrow')}</button><button class="button hero-secondary" data-action="${itemFor(44933) ? 'open' : 'add'}" data-id="44933">${icon(itemFor(44933) ? 'check' : 'plus')}${itemFor(44933) ? 'Na minha lista' : 'Quero assistir'}</button></div></div><span class="hero-caption">SELEÇÃO PARA EXPLORAR · TVMAZE</span></section>
    <section class="stats-strip" aria-label="Sua biblioteca em números"><div>${icon('library')}<strong>${state.library.length}</strong><span>séries na biblioteca</span></div><div>${icon('play')}<strong>${watching.length}</strong><span>assistindo agora</span></div><div>${icon('check')}<strong>${episodes}</strong><span>episódios registrados</span></div><div>${icon('clock')}<strong>${Math.floor(minutes / 60)}<small>h</small></strong><span>de histórias registradas</span></div></section>
    <section>${sectionHeading('De onde você parou', 'Seu próximo episódio, sem precisar lembrar de tudo.', '<a class="text-link" href="#library">Ver biblioteca ' + icon('arrow') + '</a>')}${watching.length ? `<div class="continue-grid">${watching.slice(0, 4).map(continueCard).join('')}</div>` : `<div class="welcome-empty"><div class="empty-illustration">${icon('play')}<span></span></div><div><h3>Sua primeira série está esperando.</h3><p>Adicione uma série e conte onde parou.<br>A partir daí, a gente lembra por você.</p></div><button class="button secondary" data-action="focus-search">${icon('plus')}Adicionar minha primeira série</button></div>`}</section>
    <section>${sectionHeading('Para sua próxima maratona', 'Uma seleção de histórias para conhecer — ou reencontrar.', '<a class="text-link" href="#discover">Explorar tudo ' + icon('arrow') + '</a>')}${picks.length || state.catalogLoading || state.catalogError ? catalogContent(picks) : '<p class="muted">Todas as sugestões já estão na sua biblioteca. Busque outras histórias no topo.</p>'}</section>`;
}
function libraryPage() {
  const filtered = state.library.filter(i => state.filter === 'all' || i.status === state.filter).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return `${intro('AS HISTÓRIAS QUE FICAM', 'Minha biblioteca<span class="accent">.</span>', 'Tudo o que você viu, está vendo ou quer ver. Do seu jeito.', '<button class="button primary" data-action="focus-search">' + icon('plus') + 'Adicionar série</button>')}<div class="filter-row" role="group" aria-label="Filtrar biblioteca">${[['all', 'Todas'], ...Object.entries(labels)].map(([key, label]) => `<button class="filter${state.filter === key ? ' active' : ''}" data-action="filter" data-value="${key}" aria-pressed="${state.filter === key}">${label}<span>${state.library.filter(i => key === 'all' || i.status === key).length}</span></button>`).join('')}</div>${filtered.length ? `<div class="show-grid library-grid">${filtered.map(i => card(i.show)).join('')}</div>` : `<div class="empty-state">${icon('library')}<h2>${state.library.length ? 'Nenhuma série por aqui ainda.' : 'Vamos montar sua coleção?'}</h2><p>${state.library.length ? 'Escolha outro filtro ou adicione uma série nesta categoria.' : 'Busque uma série que você lembra. Você pode marcar temporadas inteiras e informar o episódio em que parou.'}</p><button class="button primary" data-action="focus-search">${icon('search')}Buscar uma série</button></div>`}`;
}
function suggestions() {
  const weights = {};
  for (const item of state.library.filter(i => i.status !== 'dropped' && (i.rating === null || i.rating >= 6))) for (const g of item.show.genres) weights[g] = (weights[g] || 0) + (item.rating || 5);
  return state.shows.filter(s => !itemFor(s.id)).map(s => ({ ...s, affinity: s.genres.reduce((n, g) => n + (weights[g] || 0), 0) })).sort((a, b) => b.affinity - a.affinity);
}
function discoverPage() {
  const base = state.tab === 'schedule' ? state.schedule || [] : state.tab === 'personal' ? suggestions() : state.shows;
  const shows = base.filter(s => state.genre === 'all' || s.genres.includes(state.genre));
  const copy = state.tab === 'schedule' ? 'Episódios com estreia hoje em serviços de streaming no catálogo global. A disponibilidade no Brasil pode variar.' : state.tab === 'personal' ? 'Entre as nossas sugestões, priorizamos gêneros da sua biblioteca e retiramos as séries que você já adicionou.' : 'Uma seleção inicial de séries para todos os climas. Use a busca para explorar o catálogo completo.';
  return `${intro('SEMPRE HÁ UMA BOA HISTÓRIA', 'O que vamos assistir<span class="accent">?</span>', 'Encontre sua próxima obsessão — ou só uma boa companhia para hoje.')}<div class="discover-tabs">${[['curated', 'Seleção para você'], ['personal', 'Pelo seu gosto'], ['schedule', 'Episódios de hoje']].map(([key, label]) => `<button class="tab${state.tab === key ? ' active' : ''}" data-action="discover-tab" data-value="${key}" aria-pressed="${state.tab === key}">${key === 'personal' ? icon('sparkles') : ''}${label}</button>`).join('')}</div><div class="genre-row">${[['all', 'Todos os gêneros'], ['Drama', 'Drama'], ['Comedy', 'Comédia'], ['Science-Fiction', 'Ficção científica'], ['Mystery', 'Mistério'], ['Thriller', 'Suspense'], ['Crime', 'Crime']].map(([key, label]) => `<button class="genre${state.genre === key ? ' active' : ''}" data-action="genre" data-value="${key}" aria-pressed="${state.genre === key}">${label}</button>`).join('')}</div><p class="discovery-note">${copy}</p>${state.tab === 'schedule' && !state.schedule ? '<div class="loading-page"><div class="spinner"></div><p>Consultando os episódios de hoje…</p></div>' : shows.length || state.catalogLoading || state.catalogError ? catalogContent(shows) : '<div class="empty-state compact">' + icon('compass') + '<h3>Nenhuma sugestão neste filtro.</h3><p>Experimente outro gênero ou busque uma série pelo nome.</p></div>'}<div class="source-note">${icon('compass')}Descoberta baseada no catálogo do TVMaze. As seleções não representam um ranking de comentários ou audiência.</div>`;
}
function backupPage() {
  return `${intro('SUAS HISTÓRIAS CONTINUAM COM VOCÊ', 'Backup e dados<span class="accent">.</span>', 'Leve sua biblioteca para outro computador sem começar do zero.')}<div class="backup-banner">${icon('shield')}<div><strong>Seu histórico fica salvo automaticamente neste computador.</strong><p>Antes de cada alteração, guardamos uma cópia de segurança na pasta <code>data/backups</code> do projeto.</p></div><span class="saved-badge">${icon('check')}Ativo</span></div><div class="backup-grid"><section class="settings-card"><div class="settings-icon">${icon('download')}</div><h2>Levar minha biblioteca</h2><p>Baixe um arquivo com suas séries, episódios, notas e anotações. Guarde em uma pasta do Google Drive, OneDrive ou em um pendrive.</p><div class="backup-count">${state.library.length} séries <span>·</span> ${state.library.reduce((n, i) => n + i.watched.length, 0)} episódios registrados</div><a class="button primary" href="/api/backup" download>Baixar meu backup ${icon('download')}</a></section><section class="settings-card"><div class="settings-icon">${icon('upload')}</div><h2>Trazer minha biblioteca</h2><p>Selecione um backup criado por este app. As séries e episódios assistidos serão somados ao que já está salvo.</p><p class="small-note">A importação preserva registros atuais. Ela não desfaz episódios já marcados.</p><label class="button secondary file-button">${icon('upload')}Escolher arquivo de backup<input id="import-file" type="file" accept=".json,application/json" aria-label="Escolher arquivo de backup"></label></section></div><section class="settings-card migration"><h2>Vai trocar de computador?</h2><ol><li><span>1</span><div><strong>Baixe seu backup acima.</strong><p>O arquivo inclui seu histórico pessoal. Guarde uma cópia fora deste computador.</p></div></li><li><span>2</span><div><strong>Baixe o projeto do seu GitHub.</strong><p>O código e o guia de instalação estão em <a href="https://github.com/ASCCJR/TV-Time" target="_blank" rel="noopener noreferrer">ASCCJR/TV-Time</a>.</p></div></li><li><span>3</span><div><strong>Abra o app e importe seu backup.</strong><p>Pronto: suas séries e seu progresso estarão de volta.</p></div></li></ol><div class="privacy-note">O GitHub guarda o projeto. Seu histórico é privado e não é enviado ao repositório público. A sincronização do histórico entre computadores ainda é feita por exportação e importação.</div></section>`;
}
function render() {
  $('#library-count').textContent = state.library.length;
  document.querySelectorAll('[data-nav]').forEach(link => { const active = link.dataset.nav === state.route; link.classList.toggle('active', active); if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
  const titles = { home: 'Visão geral', library: 'Minha biblioteca', discover: 'Descobrir', backup: 'Backup e dados', search: 'Busca' };
  $('#breadcrumb').innerHTML = `Seu espaço <span>/</span> ${titles[state.route]}`;
  if (state.route === 'search') { if (state.searchResults) $('#content').innerHTML = searchPage(state.searchTerm, state.searchResults); return; }
  $('#content').innerHTML = ({ home: homePage, library: libraryPage, discover: discoverPage, backup: backupPage }[state.route] || homePage)();
}
function searchPage(term, data) {
  return `${intro('ENCONTRE SUA PRÓXIMA HISTÓRIA', `Resultados para “${esc(term)}”`, `${data.shows.length} séries encontradas. Confira o ano para escolher a versão certa.`)}${data.stale ? '<p class="notice">Mostrando resultados salvos anteriormente. O catálogo está temporariamente offline.</p>' : ''}${data.shows.length ? `<div class="show-grid library-grid">${data.shows.map(s => card(s)).join('')}</div>` : '<div class="empty-state">' + icon('search') + '<h2>Ainda não encontramos essa história.</h2><p>Tente o título original ou uma parte do nome da série.</p></div>'}`;
}
async function route() {
  const token = ++state.routeId;
  const [name, query = ''] = location.hash.slice(1).split('?');
  state.route = ['home', 'library', 'discover', 'backup', 'search'].includes(name) ? name : 'home';
  render();
  if (state.route !== 'search') return;
  const term = new URLSearchParams(query).get('q') || '';
  state.searchResults = null; state.searchTerm = term;
  $('#search').value = term;
  $('#content').innerHTML = intro('UMA HISTÓRIA ESTÁ CHAMANDO', 'Buscando séries…', 'Consultando o catálogo do TVMaze.') + skeletonCards();
  try {
    const data = await api('/api/search?q=' + encodeURIComponent(term));
    if (token !== state.routeId) return;
    state.searchResults = data; $('#content').innerHTML = searchPage(term, data);
  } catch (error) { if (token === state.routeId) $('#content').innerHTML = intro('BUSCA', 'Não foi possível buscar agora.', esc(error.message)) + '<button class="button secondary" data-action="retry-search">Tentar novamente</button>'; }
}
async function loadCatalog() {
  state.catalogLoading = true; state.catalogError = ''; render();
  try { const data = await api('/api/discover'); state.shows = data.shows; if (data.stale || data.partial) toast('Parte do catálogo está sendo exibida a partir da cópia local.'); }
  catch (error) { state.catalogError = error.message; }
  state.catalogLoading = false; render();
}
async function confirmAction(title, description, accept = 'Confirmar') {
  const dialog = $('#confirm-dialog');
  $('#confirm-title').textContent = title; $('#confirm-description').textContent = description; $('#confirm-accept').textContent = accept;
  dialog.returnValue = ''; dialog.showModal();
  return new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue === 'ok'), { once: true }));
}
async function openShow(id, refresh = false) {
  const token = ++state.dialogId;
  const dialog = $('#show-dialog');
  if (!dialog.open) dialog.showModal();
  $('#dialog-content').innerHTML = `<button class="icon-button dialog-close" data-action="close-dialog" aria-label="Fechar">${icon('close')}</button><div class="loading-page"><div class="spinner"></div><p>Carregando série e episódios…</p></div>`;
  try {
    const data = await api(`/api/shows/${id}${refresh ? '?refresh=1' : ''}`);
    if (token !== state.dialogId || !dialog.open) return;
    if (data.item) updateItem(data.item);
    const p = data.item ? progress(data.item) : null;
    state.dialog = { ...data, selectedSeason: p?.next?.season || data.episodes[0]?.season || 1 };
    renderDialog(); render();
  } catch (error) { if (token === state.dialogId) $('#dialog-content').innerHTML = `<button class="icon-button dialog-close" data-action="close-dialog" aria-label="Fechar">${icon('close')}</button><div class="empty-state"><h2 id="dialog-title">Não foi possível carregar.</h2><p>${esc(error.message)}</p><button class="button secondary" data-action="open" data-id="${id}">Tentar novamente</button></div>`; }
}
function renderDialog() {
  const data = state.dialog;
  if (!data) return;
  const { show, episodes, selectedSeason, stale } = data;
  const item = itemFor(show.id);
  const watched = new Set(item?.watched.map(w => w.episodeId) || []);
  const p = item ? progress(item) : { watched: 0, total: episodes.filter(e => hasAired(e)).length };
  const seasons = [...new Set(episodes.map(e => e.season))];
  const selected = episodes.filter(e => e.season === selectedSeason);
  const released = selected.filter(e => hasAired(e));
  const complete = released.length > 0 && released.every(e => watched.has(e.id));
  const channel = show.webChannel?.name || show.network?.name;
  $('#dialog-content').innerHTML = `<button class="icon-button dialog-close" data-action="close-dialog" aria-label="Fechar detalhes da série">${icon('close')}</button><div class="detail-top"><div class="detail-poster">${image(show, '', true)}</div><div class="detail-info"><div class="eyebrow">SUA PRÓXIMA HISTÓRIA</div><h2 id="dialog-title">${esc(show.name)}</h2><div class="detail-meta"><span>${year(show)}</span><span>${show.status === 'Ended' ? 'Encerrada' : show.status === 'Running' ? 'Em produção' : esc(show.status)}</span>${show.rating.average ? `<span class="rating">${icon('star')}${show.rating.average} <small>TVMaze</small></span>` : ''}</div><div class="genre-tags">${show.genres.map(g => `<span>${esc(genres[g] || g)}</span>`).join('')}</div><details class="synopsis"><summary>Sinopse do catálogo</summary><p>${esc(show.summary || 'Sinopse ainda não disponível.')}</p></details>${channel ? `<p class="channel">Canal de origem: <strong>${esc(channel)}</strong></p>` : ''}<a class="source-link" href="${esc(show.url)}" target="_blank" rel="noopener noreferrer">Ficha no TVMaze ${icon('arrow')}</a><div class="detail-actions">${item ? `<label class="field-label">Na minha biblioteca<select id="show-status" aria-label="Status da série">${Object.entries(labels).map(([key, label]) => `<option value="${key}"${item.status === key ? ' selected' : ''}>${label}</option>`).join('')}</select></label><label class="field-label">Minha nota<select id="show-rating" aria-label="Minha nota"><option value="">Sem nota</option>${Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}"${item.rating === i + 1 ? ' selected' : ''}>${i + 1}/10</option>`).join('')}</select></label>` : `<button class="button primary" data-action="start" data-id="${show.id}">${icon('play')}Começar a assistir</button><button class="button secondary" data-action="add" data-id="${show.id}">${icon('plus')}Quero assistir</button>`}</div></div></div>${stale ? '<p class="notice">Catálogo offline: mostrando os dados salvos neste computador.</p>' : ''}<div class="episode-section"><div class="section-heading"><div><h3>Seu progresso</h3><p>${p.watched} de ${p.total} episódios lançados${item ? '' : ' · Adicione à biblioteca para registrar'}</p></div><button class="text-link button-link" data-action="refresh-show" data-id="${show.id}">${icon('refresh')}Atualizar episódios</button></div><div class="progress-track large"><i style="width:${p.total ? p.watched / p.total * 100 : 0}%"></i></div>${item && episodes.length ? `<button class="text-link button-link all-watched" data-action="all-watch">${icon("check")}Já assisti todos os episódios lançados</button>` : ""}${item && episodes.length ? `<details class="catch-up"><summary>${icon('clock')}Lembro onde parei</summary><p>Escolha o último episódio que você já viu. Marcamos os anteriores de uma vez, sem inventar a data em que você assistiu.</p><div class="catch-up-fields"><label class="field-label">Temporada<select id="catch-season" aria-label="Temporada de retomada">${seasons.map(s => `<option value="${s}"${s === selectedSeason ? ' selected' : ''}>Temporada ${s}</option>`).join('')}</select></label><label class="field-label">Último episódio assistido<select id="catch-episode" aria-label="Último episódio assistido">${released.map(e => `<option value="${e.id}">${code(e)} — ${esc(e.name)}</option>`).join('')}</select></label><button class="button primary" data-action="catch-up"${released.length ? '' : ' disabled'}>${icon('check')}Assisti até aqui</button></div></details>` : ''}<div class="season-bar"><div class="season-tabs" aria-label="Temporadas">${seasons.map(s => `<button class="season-tab${s === selectedSeason ? ' active' : ''}" data-action="season" data-value="${s}" aria-pressed="${s === selectedSeason}">Temporada ${s}</button>`).join('')}</div>${item && released.length ? `<button class="text-link button-link" data-action="season-watch" data-watched="${!complete}">${icon(complete ? 'refresh' : 'check')}${complete ? 'Desmarcar temporada' : 'Já vi esta temporada'}</button>` : ''}</div><div class="episode-list">${selected.length ? selected.map(e => { const seen = watched.has(e.id); const aired = hasAired(e); return `<div class="episode-row${seen ? ' seen' : ''}${!aired ? ' future' : ''}"><button class="episode-check" data-action="episode" data-episode="${e.id}" aria-label="${seen ? 'Desmarcar' : 'Marcar como assistido'} ${code(e)}" aria-pressed="${seen}"${!item || !aired ? ' disabled' : ''}>${seen ? icon('check') : ''}</button><span class="episode-number">${e.number === null ? 'ESP' : String(e.number).padStart(2, '0')}</span><div class="episode-name"><strong>${esc(e.name)}</strong><span>${e.airdate ? date(e.airdate) : 'Data a confirmar'}${!aired ? ' · Ainda não lançado' : ''}</span></div><span class="episode-runtime">${e.runtime ? `${e.runtime} min` : ''}</span>${seen ? '<span class="watched-label">Assistido</span>' : ''}</div>`; }).join('') : '<p class="muted">Ainda não há episódios cadastrados.</p>'}</div></div>${item ? `<section class="notes-section"><label for="show-notes"><h3>Minhas anotações</h3></label><textarea id="show-notes" maxlength="5000" rows="3" placeholder="Por que quero assistir, o que achei, algo para lembrar…">${esc(data.noteDraft ?? item.notes)}</textarea><div class="notes-actions"><button class="text-link danger button-link" data-action="remove" data-id="${show.id}">Remover da biblioteca</button><button class="button secondary" data-action="save-notes">Salvar anotação</button></div></section>` : ''}`;
}
document.addEventListener('input', event => { if (event.target.id === 'show-notes' && state.dialog) state.dialog.noteDraft = event.target.value; });
async function addShow(id, status = 'want') {
  const data = await api('/api/library', 'POST', { id: Number(id), status });
  updateItem(data.item); render();
  if ($('#show-dialog').open && state.dialog?.show.id === Number(id)) renderDialog();
  toast(status === 'watching' ? 'Pronto! Agora conte onde você parou.' : 'Série adicionada à sua lista.');
}
async function recordProgress(id, payload) {
  const data = await api(`/api/library/${id}/progress`, 'POST', payload);
  updateItem(data.item); render();
  if ($('#show-dialog').open) { const scroll = $('#show-dialog').scrollTop; renderDialog(); $('#show-dialog').scrollTop = scroll; }
  toast(payload.watched ? 'Episódios registrados. Bom próximo capítulo!' : 'Progresso atualizado.');
}
async function patchItem(changes) {
  const data = await api(`/api/library/${state.dialog.show.id}`, 'PATCH', changes);
  updateItem(data.item); render(); toast('Salvo na sua biblioteca.');
}
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const { action, id, value } = button.dataset;
  if (action === 'close-dialog') { ++state.dialogId; $('#show-dialog').close(); return; }
  if (action === 'focus-search') { $('#search').focus(); return; }
  if (action === 'open') { await openShow(id); return; }
  if (action === 'filter') { state.filter = value; render(); return; }
  if (action === 'genre') { state.genre = value; render(); return; }
  if (action === 'season') { state.dialog.selectedSeason = Number(value); renderDialog(); return; }
  if (action === 'reload-catalog') { await loadCatalog(); return; }
  if (action === 'retry-search') { await route(); return; }
  if (state.busy) return;
  state.busy = true; button.disabled = true;
  try {
    if (action === 'add' || action === 'start') await addShow(id, action === 'start' ? 'watching' : 'want');
    if (action === 'quick-watch') await recordProgress(id, { mode: 'single', episodeId: Number(button.dataset.episode), watched: true, justWatched: true });
    if (action === 'episode') { const seen = itemFor(state.dialog.show.id).watched.some(w => w.episodeId === Number(button.dataset.episode)); await recordProgress(state.dialog.show.id, { mode: 'single', episodeId: Number(button.dataset.episode), watched: !seen }); }
    if (action === 'catch-up') {
      const episodeId = Number($('#catch-episode').value); const episodes = state.dialog.episodes; const index = episodes.findIndex(e => e.id === episodeId);
      const count = episodes.slice(0, index + 1).filter(e => hasAired(e) && !itemFor(state.dialog.show.id).watched.some(w => w.episodeId === e.id)).length;
      if (await confirmAction('Recuperar seu progresso?', `Vamos marcar ${count} episódios ainda não registrados até ${code(episodes[index])}. Episódios posteriores já marcados serão preservados.`, 'Marcar como assistidos')) await recordProgress(state.dialog.show.id, { mode: 'through', episodeId, watched: true });
    }
    if (action === 'season-watch') {
      const watched = button.dataset.watched === 'true';
      if (await confirmAction(watched ? 'Já viu esta temporada?' : 'Desmarcar esta temporada?', watched ? 'Vamos marcar como assistidos todos os episódios já lançados desta temporada.' : 'Os episódios desta temporada ficarão como não assistidos. Uma cópia será guardada antes da alteração.', watched ? 'Marcar temporada' : 'Desmarcar')) await recordProgress(state.dialog.show.id, { mode: 'season', season: state.dialog.selectedSeason, watched });
    }
    if (action === 'all-watch' && await confirmAction('Registrar toda a série?', 'Todos os episódios já lançados serão marcados. A data em que você assistiu ficará desconhecida.', 'Marcar todos')) await recordProgress(state.dialog.show.id, { mode: 'all', watched: true });
    if (action === 'save-notes') await patchItem({ notes: $('#show-notes').value });
    if (action === 'refresh-show') await openShow(id, true);
    if (action === 'remove' && await confirmAction('Remover esta série?', 'A série, seus episódios registrados e suas anotações sairão da biblioteca. Uma cópia de segurança será guardada antes da remoção.', 'Remover série')) { await api(`/api/library/${id}`, 'DELETE'); state.library = state.library.filter(i => i.show.id !== Number(id)); state.dialog.item = null; renderDialog(); render(); toast('Série removida. A cópia anterior está em data/backups.'); }
    if (action === 'discover-tab') {
      state.tab = value; state.genre = 'all'; render();
      if (value === 'schedule' && !state.schedule) { const data = await api('/api/schedule'); state.schedule = data.shows; if (data.stale) toast('Exibindo a programação salva anteriormente.'); render(); }
    }
  } catch (error) { toast(error.message, true); if (action === 'discover-tab') { state.schedule = []; render(); } }
  finally { state.busy = false; if (button.isConnected) button.disabled = false; }
});
document.addEventListener('change', async event => {
  const target = event.target;
  try {
    if (target.id === 'show-status') await patchItem({ status: target.value });
    if (target.id === 'show-rating') await patchItem({ rating: target.value ? Number(target.value) : null });
    if (target.id === 'catch-season') { $('#catch-episode').innerHTML = state.dialog.episodes.filter(e => e.season === Number(target.value) && hasAired(e)).map(e => `<option value="${e.id}">${code(e)} — ${esc(e.name)}</option>`).join(''); $('[data-action="catch-up"]').disabled = !$('#catch-episode').options.length; }
    if (target.id === 'import-file' && target.files[0]) {
      const file = target.files[0];
      if (file.size > 30 * 1024 * 1024) throw new Error('Escolha um backup de até 30 MB.');
      let data; try { data = JSON.parse(await file.text()); } catch { throw new Error('O arquivo selecionado não é um JSON válido.'); }
      if (data.app !== 'tv-time-personal' || data.version !== 1 || !Array.isArray(data.items)) throw new Error('Escolha um backup criado por este app.');
      if (await confirmAction('Importar sua biblioteca?', `${data.items.length} séries serão mescladas à biblioteca atual. Seus registros existentes serão preservados.`, 'Importar backup')) { const result = await api('/api/import', 'POST', data); state.library = (await api('/api/library')).items; render(); toast(`${result.imported} séries importadas. Sua biblioteca está pronta.`); }
      target.value = '';
    }
  } catch (error) { toast(error.message, true); if (target.id.startsWith('show-')) renderDialog(); }
});
$('#search-form').addEventListener('submit', event => { event.preventDefault(); const query = $('#search').value.trim(); if (query.length < 2) { toast('Digite pelo menos duas letras para buscar.'); return; } const hash = '#search?q=' + encodeURIComponent(query); if (location.hash === hash) route(); else location.hash = hash; });
$('#backup-shortcut').addEventListener('click', () => location.hash = '#backup');
window.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); if ($('#show-dialog').open) $('#show-dialog').close(); $('#search').focus(); $('#search').select(); } });
window.addEventListener('hashchange', route);
$('#show-dialog').addEventListener('click', event => { if (event.target === $('#show-dialog')) { const r = event.target.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) { ++state.dialogId; event.target.close(); } } });
$('#show-dialog').addEventListener('cancel', () => ++state.dialogId);
try {
  state.library = (await api('/api/library')).items;
  await route();
  loadCatalog();
  api('/api/shows/44933/artwork').then(data => { state.artwork = data.background; if (state.route === 'home') render(); }).catch(() => {});
} catch (error) { $('#content').innerHTML = `<div class="empty-state"><h1>Vamos reconectar?</h1><p>${esc(error.message)} Abra novamente o arquivo <strong>Iniciar TV Time.cmd</strong> e recarregue a página.</p><button class="button primary" data-action="retry-search">Tentar novamente</button></div>`; }
