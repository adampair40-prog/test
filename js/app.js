import { PRESETS, buildPalette, applyPalette, hex, parseHex } from './theme.js';
import { icon, brandMark } from './icons.js';
import { critter, communityTile, poster, desk, linkGrid } from './art.js';
import * as D from './data.js';

const VERSION = '6.0.38';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const store = {
  get(k, d) { try { const v = localStorage.getItem('krypt-web:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('krypt-web:' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const reduceMotion = () => document.documentElement.dataset.motion === 'reduce' || matchMedia('(prefers-reduced-motion: reduce)').matches;

// ------------------------------------------------------------------ state
const state = {
  community: 'server', room: 'alex-room', channel: 'general', dm: null,
  lastChannel: { 'alex-room': 'general' },
  unread: { 'friday-coop': 3, setups: 2, 'mel-chat': 1, 'dm-alex': 2 },
  replyTo: null, editing: null, pending: [], format: false, search: '', searchOpen: false,
  typing: {}, drawer: false, calendarOffset: 0, settingsPage: 'appearance',
  // On a phone or a short window the call's chat starts folded so the stage gets the room.
  voice: { channel: null, muted: false, deafened: false, sharing: null, focus: false, dock: !matchMedia('(max-width: 820px), (max-height: 640px)').matches, stats: true, levels: {}, speaking: new Set(), joinedAt: 0, ping: [], volume: {}, localMute: new Set() },
  share: store.get('share', { quality: 'smooth', codec: 'auto', hud: true }),
  theme: store.get('theme', { preset: 'fern', custom: null, accent: null, mode: 'dark', reading: 15.5, density: 'cozy', motion: 'system' }),
  notify: store.get('notify', { mentions: true, dms: true, sounds: true, desktop: false }),
  status: 'online',
  muted: new Set(),
};
for (const d of D.dms) state.unread[d.id] = d.unread || state.unread[d.id] || 0;
const expandedGroups = new Set();

// ------------------------------------------------------------------ helpers
const person = (id) => D.people[id] || { id, name: id, hue: 0, status: 'offline' };
const avatar = (id, size = '', dot = false, extra = '') => {
  const p = person(id);
  const status = id === 'me' ? state.status : p.status;
  return `<span class="avatar ${size}" data-person="${id}" ${extra} title="${esc(p.name)}">${critter(id + p.name, p.hue)}${dot ? `<i class="dot ${status}"></i>` : ''}</span>`;
};
const pad = (n) => String(n).padStart(2, '0');
const clock = (t) => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const ago = (t) => {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'now'; if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h'; return Math.floor(s / 86400) + 'd';
};
const dayKey = (t) => new Date(t).toDateString();
const dayLabel = (t) => {
  const d = new Date(t), today = new Date(), y = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
};
const typeIcon = { text: 'message', voice: 'phone', calendar: 'calendar', docs: 'doc', tasks: 'tasks' };
const convKey = () => state.dm || state.channel;
const community = () => D.communities.find((c) => c.id === state.community);
const roomOf = (channelId) => Object.keys(D.rooms).find((r) => D.rooms[r].channels.includes(channelId));
const lastMsg = (key) => (D.messages[key] || []).filter((m) => !m.system).at(-1);
const voiceCount = (ch) => (D.voiceOccupants[ch] || []).length + (state.voice.channel === ch ? 1 : 0);
// Rooms are places, so they get a square initial tile tinted by their owner; people keep round avatars.
const roomLive = (id) => D.rooms[id].channels.some((c) => D.channels[c].type === 'voice' && voiceCount(c) > 0);
const roomTile = (id) => {
  const r = D.rooms[id]; const letter = (r.name.match(/[\p{L}\p{N}]/u) || ['#'])[0].toUpperCase();
  return `<span class="rtile" style="--h:${person(r.owner).hue}" aria-hidden="true">${esc(letter)}${roomLive(id) ? '<i class="live"></i>' : ''}</span>`;
};

function formatText(text, highlight = '') {
  let s = esc(text);
  const blocks = [];
  s = s.replace(/```\n?([\s\S]*?)```/g, (_, code) => { blocks.push(code.replace(/\n$/, '')); return `\u0000${blocks.length - 1}\u0000`; });
  s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/@(\w+)/g, (m, h) => Object.values(D.people).some((p) => p.handle === h.toLowerCase()) ? `<span class="mention-chip">@${h}</span>` : m);
  if (highlight) {
    const q = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    s = s.replace(new RegExp(`(?![^<]*>)(${q})`, 'gi'), '<mark>$1</mark>');
  }
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<pre><code>${blocks[i]}</code></pre>`);
}

// ------------------------------------------------------------------ theme
function currentLight() {
  const mode = state.theme.mode;
  return mode === 'light' || (mode === 'system' && matchMedia('(prefers-color-scheme: light)').matches);
}
function applyTheme(animate = false) {
  const t = state.theme;
  const run = () => {
    const light = currentLight();
    applyPalette(buildPalette({ preset: t.preset, custom: t.custom, accent: t.accent, light }), light);
    const root = document.documentElement;
    root.style.setProperty('--fs-body', t.reading + 'px');
    root.dataset.density = t.density;
    root.dataset.motion = t.motion === 'reduce' ? 'reduce' : '';
  };
  store.set('theme', t);
  if (animate && document.startViewTransition && !reduceMotion()) document.startViewTransition(run); else run();
}
matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => state.theme.mode === 'system' && applyTheme(true));

// ------------------------------------------------------------------ shell
function renderShell() {
  // Render into our own root so anything else in <body> (like inlined styles) survives.
  let root = document.getElementById('krypt');
  if (!root) { root = document.createElement('div'); root.id = 'krypt'; document.body.append(root); }
  root.innerHTML = `
  <a class="skip" href="#feed">Skip to messages</a>
  <div class="app" id="app">
    <header class="titlebar" id="titlebar"></header>
    <button class="community" id="community" data-act="communityMenu" aria-haspopup="menu" aria-expanded="false"></button>
    <nav class="tabs" id="tabs" aria-label="Channels"></nav>
    <aside class="side" id="side" aria-label="Rooms and direct messages"></aside>
    <main class="main" id="main"></main>
    <footer class="voicebar" id="voicebar" aria-label="Voice"></footer>
  </div>
  <div class="toasts" id="toasts" role="status" aria-live="polite"></div>`;
  renderTitle(); renderCommunity(); renderSide(); renderTabs(); renderMain(); renderVoicebar();
}

function renderTitle() {
  const online = community().members.filter((m) => m !== 'me' && person(m).status !== 'offline');
  $('#titlebar').innerHTML = `
    <button class="ibtn only-mobile" data-act="drawer" aria-label="Rooms">${icon('menu')}</button>
    <div class="brandline">${brandMark(30)}<b>Krypt</b><span class="version" title="Krypt Web ${VERSION}">v${VERSION}</span></div>
    <button class="online-stack" id="onlineStack" data-act="members" aria-haspopup="dialog" aria-expanded="false" aria-label="Active community members, ${online.length} online">${online.slice(0, 5).map((id) => avatar(id, 'sm', true)).join('')}
      ${online.length > 5 ? `<span class="more">+${online.length - 5}</span>` : ''}</button>
    <div class="spacer"></div>
    <button class="search-trigger" data-act="cmdk">${icon('search', 'sm')}<span>Search or jump to…</span><kbd>Ctrl K</kbd></button>
    <button class="ibtn" data-act="settings" aria-label="Settings" title="Settings (Ctrl+,)">${icon('settings')}</button>
    <button class="me-button" data-act="meMenu" aria-label="Your profile and status" aria-haspopup="menu">${avatar('me', '', true)}</button>`;
}

function renderCommunity() {
  const c = community();
  $('#community').innerHTML = `
    <span class="ctile">${communityTile(c.id, c.hue)}</span>
    <span class="meta"><small>Community</small><strong>${esc(c.name)}</strong><span>${c.members.length} members</span></span>
    ${icon('chevronDown')}`;
}

function roomPreview(roomId) {
  const room = D.rooms[roomId];
  const texts = room.channels.filter((c) => D.channels[c].type === 'text');
  const last = texts.map(lastMsg).filter(Boolean).sort((a, b) => b.t - a.t)[0];
  const voice = room.channels.find((c) => D.channels[c].type === 'voice' && voiceCount(c) > 0);
  const unread = room.channels.reduce((n, c) => n + (state.unread[c] || 0), 0);
  let sub;
  if (voice) sub = `<span class="sub live">${icon('phone')}${voiceCount(voice)} in voice${state.voice.channel === voice ? ' · you’re here' : ''}</span>`;
  else if (last) sub = `<span class="sub">${last.author === 'me' ? 'You' : esc(person(last.author).name)}: ${last.attachments ? 'Shared a file' : esc(last.text.replace(/[*`]/g, '').slice(0, 60))}</span>`;
  else sub = `<span class="sub">${room.channels.length} channel${room.channels.length === 1 ? '' : 's'}</span>`;
  return { sub, last, unread };
}

function renderSide() {
  const c = community();
  const rooms = c.rooms.map((id) => {
    const { sub, last, unread } = roomPreview(id);
    const current = !state.dm && state.room === id;
    return `<button class="row ${unread ? 'unread' : ''}" data-act="room" data-id="${id}" aria-current="${current}">
      ${roomTile(id)}
      <span class="body"><span class="top"><span class="name">${esc(D.rooms[id].name)}</span><span class="time">${last ? ago(last.t) : ''}</span></span>
      <span class="top">${sub}${unread ? `<span class="badge">${unread}</span>` : ''}</span></span></button>`;
  }).join('');
  const dms = D.dms.map((d) => {
    const last = lastMsg(d.id); const unread = state.unread[d.id] || 0;
    return `<button class="row ${unread ? 'unread' : ''}" data-act="dm" data-id="${d.id}" aria-current="${state.dm === d.id}">
      ${avatar(d.with, 'md', true)}
      <span class="body"><span class="top"><span class="name">${esc(person(d.with).name)}${state.muted.has(d.id) ? `<span class="muted-mark" title="Muted">${icon('bellOff', 'xs')}</span>` : ''}</span><span class="time">${last ? ago(last.t) : ''}</span></span>
      <span class="top"><span class="sub">${last ? `${last.author === 'me' ? 'You' : esc(person(last.author).name)}: ${esc(last.text.slice(0, 48))}` : 'Say hi'}</span>${unread ? `<span class="badge">${unread}</span>` : ''}</span></span></button>`;
  }).join('');
  $('#side').innerHTML = `
    <section class="section rooms"><div class="section-head"><h2>Rooms</h2><button class="ibtn" data-act="newRoom" aria-label="Create a room">${icon('plus', 'sm')}</button></div>
      <div class="list" role="list">${rooms}</div></section>
    <section class="section dms"><div class="section-head"><h2>Direct messages</h2><button class="ibtn" data-act="newDm" aria-label="New message">${icon('plus', 'sm')}</button></div>
      <div class="list">${dms}</div></section>
    <div class="footer-note" title="Keys never leave your devices">${icon('lock', 'xs')} End-to-end encrypted</div>`;
  $('#app')?.classList.toggle('drawer', state.drawer);
  $$('#side .list').forEach(watchEdges);
  const cur = state.dm || state.room;
  if (lastSideCurrent && lastSideCurrent !== cur) $('#side .row[aria-current="true"]')?.classList.add('became-current');
  lastSideCurrent = cur;
  updateTitle();
}

let lastSideCurrent = null;
// Fades a scroller's edge only where more content is hidden beyond it.
function edgeState(el) {
  const x = el.classList.contains('tabstrip');
  const pos = x ? el.scrollLeft : el.scrollTop, max = x ? el.scrollWidth - el.clientWidth : el.scrollHeight - el.clientHeight;
  el.classList.toggle('fade-start', pos > 2);
  el.classList.toggle('fade-end', pos < max - 2);
}
function watchEdges(el) {
  if (!el) return;
  if (!el.dataset.edges) { el.dataset.edges = '1'; el.addEventListener('scroll', () => edgeState(el), { passive: true }); }
  requestAnimationFrame(() => edgeState(el));
}
function updateTitle() {
  const unread = Object.values(state.unread).reduce((n, v) => n + (v || 0), 0);
  const where = state.dm ? person(D.dms.find((d) => d.id === state.dm)?.with).name : `${D.channels[state.channel]?.name} · ${D.rooms[state.room]?.name}`;
  document.title = `${unread ? `(${unread}) ` : ''}${where} — Krypt`;
}

function renderTabs() {
  const nav = $('#tabs');
  // Keep where the underline was so it can slide instead of jumping.
  const old = $('.tab-indicator', nav); const scope = state.dm || state.room;
  const from = old && nav.dataset.scope === scope ? { l: old.style.left, w: old.style.width } : null;
  nav.dataset.scope = scope;
  if (state.dm) {
    const p = person(D.dms.find((d) => d.id === state.dm).with);
    nav.innerHTML = `<div class="tabstrip" role="tablist"><button class="tab" role="tab" aria-selected="true">${icon('message')}${esc(p.name)}${state.muted.has(state.dm) ? `<span class="muted-mark" title="Muted">${icon('bellOff', 'xs')}</span>` : ''}</button><span class="tab-indicator"></span></div>
      <button class="tab-select" data-act="cmdk" aria-label="Jump to a conversation">${icon('message', 'sm')}<span>${esc(p.name)}</span>${icon('chevronDown', 'sm')}</button>
      <div class="tools"><button class="ibtn keep" data-act="dmCall" aria-label="Call">${icon('phone', 'sm')}</button></div>`;
  } else {
    const room = D.rooms[state.room];
    nav.innerHTML = `<div class="tabstrip" role="tablist" id="tabstrip">${room.channels.map((id) => {
      const ch = D.channels[id]; const count = ch.type === 'voice' ? voiceCount(id) : 0;
      return `<button class="tab" role="tab" data-act="channel" data-id="${id}" aria-selected="${state.channel === id}">${icon(typeIcon[ch.type])}${esc(ch.name)}${count ? `<span class="count">${icon('user', 'xs')}${count}</span>` : ''}${state.muted.has(id) ? `<span class="muted-mark" title="Muted">${icon('bellOff', 'xs')}</span>` : state.unread[id] ? '<span class="tab-dot" aria-label="unread"></span>' : ''}</button>`;
    }).join('')}<span class="tab-indicator" id="indicator"></span></div>
      <button class="tab-select" data-act="channelMenu" aria-haspopup="menu" aria-expanded="false" aria-label="Channel: ${esc(D.channels[state.channel].name)}">${icon(typeIcon[D.channels[state.channel].type], 'sm')}<span>${esc(D.channels[state.channel].name)}</span>${icon('chevronDown', 'sm')}</button>
      <div class="tools"><button class="ibtn more-btn" id="moreTabs" data-act="channelMenu" aria-haspopup="menu" aria-expanded="false" aria-label="All channels" title="All channels"><span id="moreCount"></span>${icon('chevronDown', 'sm')}</button>
      <button class="ibtn keep" data-act="newChannel" aria-label="Add a channel" title="Add a channel">${icon('plus', 'sm')}</button>
      <button class="ibtn keep" data-act="roomMenu" aria-haspopup="menu" aria-expanded="false" aria-label="Room options">${icon('more', 'sm')}</button>
      <button class="btn room-settings keep" data-act="roomSettings" aria-label="Room settings" title="Room settings">${icon('settings', 'sm')}<span>Room settings</span></button></div>`;
  }
  const ind = $('.tab-indicator', nav);
  if (from && ind) { ind.style.transition = 'none'; ind.style.left = from.l; ind.style.width = from.w; void ind.offsetWidth; ind.style.transition = ''; }
  fitTabs();
  requestAnimationFrame(moveIndicator);
  updateTitle();
}
// Tabs that don't fit move into the channel menu instead of being cut off mid-word.
// The selected tab always stays visible.
function fitTabs() {
  const strip = $('#tabstrip'); if (!strip) return;
  const tabs = $$('.tab', strip); tabs.forEach((t) => { t.hidden = false; });
  const avail = strip.clientWidth; if (!avail) return;
  const gap = parseFloat(getComputedStyle(strip).columnGap) || 0;
  const widths = tabs.map((t) => t.offsetWidth);
  const sel = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
  let used = sel >= 0 ? widths[sel] : 0; const keep = new Set(sel >= 0 ? [sel] : []);
  for (let i = 0; i < tabs.length; i++) {
    if (i === sel) continue;
    if (used + gap + widths[i] > avail) break;
    keep.add(i); used += gap + widths[i];
  }
  let hidden = 0; tabs.forEach((t, i) => { t.hidden = !keep.has(i); if (t.hidden) hidden++; });
  const count = $('#moreCount'); if (count) count.textContent = hidden ? `+${hidden}` : '';
  const more = $('#moreTabs'); if (more) more.setAttribute('aria-label', hidden ? `${hidden} more channels` : 'All channels');
}
function moveIndicator() {
  fitTabs();
  const strip = $('.tabstrip'); const sel = $('.tab[aria-selected="true"]'); const ind = $('.tab-indicator');
  if (!strip || !sel || !ind) return;
  ind.style.left = sel.offsetLeft + 'px'; ind.style.width = sel.offsetWidth + 'px';
}

// ------------------------------------------------------------------ main views
function renderMain() {
  stopStage();
  // The call keeps ticking (levels, ping, speaking rings) whichever view is open.
  if (state.voice.channel) stageTimer = setInterval(tickVoice, 120);
  const main = $('#main');
  const ch = D.channels[state.channel];
  if (state.dm) { main.innerHTML = chatView(state.dm, 'dm'); afterChat(); }
  else if (ch.type === 'text') { main.innerHTML = chatView(state.channel, 'channel'); afterChat(); }
  else if (ch.type === 'voice') { main.innerHTML = voiceView(); afterVoice(); if (state.voice.channel === state.channel) closeMini(); }
  else if (ch.type === 'calendar') main.innerHTML = calendarView();
  else if (ch.type === 'docs') { main.innerHTML = docsView(); afterDocs(); }
  else if (ch.type === 'tasks') { main.innerHTML = tasksView(); afterTasks(); }
  placeCorner();
}

function header(title, subtitle, actions = '', badge = '') {
  return `<div class="chead"><div class="titles"><h1>${title}${badge}</h1><p>${subtitle}</p></div><div class="actions">${actions}</div></div>`;
}

function chatView(key, kind) {
  let title, sub, place, visibility;
  if (kind === 'dm') {
    const p = person(D.dms.find((d) => d.id === key).with);
    title = `${avatar(p.id, 'sm', true)} ${esc(p.name)}`;
    sub = `@${p.handle} · ${p.status === 'online' ? 'Online' : p.status === 'idle' ? 'Away' : p.status === 'dnd' ? 'Do not disturb' : 'Offline'}`;
    place = `Message ${p.name}`; visibility = `Only you and ${esc(p.name)} can read this`;
  } else {
    const ch = D.channels[key]; const room = D.rooms[state.room];
    title = esc(ch.name);
    sub = `${esc(room.name)} / Text channel · ${community().members.length} people${ch.topic ? `<span class="topic"> · ${esc(ch.topic)}</span>` : ''}`;
    place = `Message ${ch.name}`; visibility = `Visible to people with access to ${esc(room.name)}`;
  }

  return `<section class="view" aria-label="Conversation">
    ${header(title, sub, `
      <button class="ibtn ${state.searchOpen ? 'on' : ''}" data-act="search" aria-label="Search this conversation" title="Search (Ctrl+F)">${icon('search')}</button>
      <button class="ibtn" data-act="pins" aria-label="Pinned messages" title="Pinned messages">${icon('pin')}</button>
      <button class="ibtn keep" data-act="convMenu" aria-label="More" title="More">${icon('more')}</button>`, '<span class="e2e" title="End-to-end encrypted">' + icon('lock') + 'Encrypted</span>')}
    ${state.searchOpen ? `<div class="searchbar">${icon('search', 'sm')}<input id="searchInput" placeholder="Search messages" value="${esc(state.search)}" aria-label="Search messages"><small id="searchCount"></small><button class="ibtn sm" data-act="search" aria-label="Close search">${icon('x', 'sm')}</button></div>` : ''}
    ${state.searchOpen ? '' : pinbarHtml(key)}
    <div class="feed-wrap"><div class="feed" id="feed" tabindex="-1" aria-live="polite"><div class="feed-inner" id="feedInner">${feedHtml(key)}</div></div>
    <button class="jump" id="jump" data-act="jumpLatest">${icon('arrowDown', 'sm')} New messages</button></div>
    <div class="typing" id="typing"></div>
    ${composerHtml(place, visibility)}
    <div class="dropzone" id="dropzone"><div>${icon('upload')}<h3>Drop to share</h3><p>Files are encrypted before they leave this browser</p></div></div>
  </section>`;
}

const pinsFor = (key) => (D.pinned[key] || []).map(findMsg).filter(Boolean);
const snippet = (m, n = 80) => m.text ? m.text.replace(/```[\s\S]*?```/g, '[code]').replace(/[*`]/g, '').slice(0, n) : m.attachments ? m.attachments[0].name : '';
function pinbarHtml(key) {
  const pins = pinsFor(key); if (!pins.length) return '';
  const m = pins.at(-1);
  return `<div class="pinbar">${icon('pin', 'sm')}<span>Pinned · ${pins.length === 1 ? '1 of 1' : `latest of ${pins.length}`} · <b>${esc(snippet(m, 60))}</b> by ${esc(person(m.author).name)}</span><button data-act="pins">View</button></div>`;
}
function updatePinbar() {
  const view = $('#main .view'); if (!view || !$('#feed', view) || state.searchOpen) return;
  const html = pinbarHtml(convKey()); const old = $('.pinbar', view);
  if (old) { if (html) old.outerHTML = html; else old.remove(); }
  else if (html) $('.chead', view).insertAdjacentHTML('afterend', html);
}
function pinsPopover(anchor) {
  const key = convKey(); const pins = pinsFor(key).reverse();
  const el = openPopover(anchor, `<div class="pp-head"><b>Pinned messages</b><span>${pins.length}</span></div>${pins.length ? `<div class="pp-list">${pins.map((m) => `<div class="pp-item" data-act="gotoPin" data-id="${m.id}">${avatar(m.author, 'sm')}<div class="t"><div><b>${esc(person(m.author).name)}</b><time>${dayLabel(m.t)} · ${clock(m.t)}</time></div><p>${esc(snippet(m, 140))}</p></div>
      <div class="pp-tools"><button class="ibtn sm" data-act="gotoPin" data-id="${m.id}" aria-label="Jump to message" title="Jump to message">${icon('arrowRight', 'sm')}</button><button class="ibtn sm" data-act="pinMsg" data-id="${m.id}" aria-label="Unpin" title="Unpin">${icon('x', 'sm')}</button></div></div>`).join('')}</div>`
    : `<div class="pp-empty">${icon('pin')}<b>Nothing pinned yet</b><span>Hover a message, open ⋯ and choose Pin message.</span></div>`}`, { cls: 'pins-pop', align: 'end' });
  return el;
}

function composerHtml(place, visibility, compact = false) {
  const reply = state.replyTo && findMsg(state.replyTo);
  return `<div class="composer-wrap">
    ${reply ? `<div class="replying">${icon('reply', 'sm')}<span class="rp">Replying to <b>${esc(person(reply.author).name)}</b><em>${esc(snippet(reply, 90))}</em></span><button class="ibtn sm" data-act="cancelReply" aria-label="Cancel reply">${icon('x', 'sm')}</button></div>` : ''}
    <div class="composer" id="composer">
      ${state.format ? `<div class="formatbar" role="toolbar" aria-label="Formatting">
        <button class="ibtn" data-act="fmt" data-f="bold" aria-label="Bold" title="Bold (Ctrl+B)">${icon('bold', 'sm')}</button>
        <button class="ibtn" data-act="fmt" data-f="italic" aria-label="Italic" title="Italic (Ctrl+I)">${icon('italic', 'sm')}</button>
        <button class="ibtn" data-act="fmt" data-f="code" aria-label="Code">${icon('code', 'sm')}</button>
        <button class="ibtn" data-act="fmt" data-f="block" aria-label="Code block">${icon('doc', 'sm')}</button>
        <button class="ibtn" data-act="fmt" data-f="quote" aria-label="Quote">${icon('quote', 'sm')}</button></div>` : ''}
      ${state.pending.length ? `<div class="pending">${state.pending.map((f, i) => `<span class="chip-file">${f.url ? `<img src="${f.url}" alt="">` : icon('paperclip', 'sm')}${esc(f.name)}<button class="ibtn sm" data-act="unpend" data-i="${i}" aria-label="Remove ${esc(f.name)}">${icon('x', 'xs')}</button></span>`).join('')}</div>` : ''}
      <div class="bar">
        <button class="ibtn" data-act="attach" aria-label="Attach files" title="Attach files">${icon('plus')}</button>
        <button class="ibtn" data-act="emoji" aria-label="Emoji" title="Emoji">${icon('smile')}</button>
        <button class="ibtn ${state.format ? 'on' : ''}" data-act="format" aria-label="Formatting" aria-pressed="${state.format}" title="Formatting"><span class="aa">Aa</span></button>
        <span class="sep"></span>
        <textarea id="input" rows="1" placeholder="${esc(place)}" aria-label="${esc(place)}"></textarea>
        <button class="send" id="send" data-act="send">Send ${icon('send', 'sm')}</button>
      </div>
    </div>
    ${compact ? '' : `<div class="composer-foot"><span>${icon('users', 'sm')}${visibility}</span><span class="hint-keys">Enter to send · Shift+Enter for a new line</span></div>`}
    <input type="file" id="fileInput" multiple hidden>
  </div>`;
}

// The top of every conversation says what it is, so a short history doesn't float in empty space.
function introHtml(key) {
  const dm = D.dms.find((d) => d.id === key);
  if (dm) { const p = person(dm.with); return `<div class="conv-intro">${avatar(p.id, 'xl')}<h2>${esc(p.name)}</h2><p>This is the start of your direct messages with <b>${esc(p.name)}</b>. Only the two of you can read them.</p></div>`; }
  const ch = D.channels[key]; if (!ch) return '';
  return `<div class="conv-intro"><span class="ci-glyph">${icon(typeIcon[ch.type] || 'message')}</span><h2>Welcome to ${esc(ch.name)}</h2><p>${ch.topic ? esc(ch.topic) + ' · ' : ''}This is the start of the channel in ${esc(D.rooms[roomOf(key)]?.name || '')}.</p></div>`;
}
function feedHtml(key) {
  const list = D.messages[key] || [];
  if (!list.length) return `<div class="empty"><div><div class="glyph">${icon('sparkles')}</div><h3>Start the conversation</h3><p>Messages here are end-to-end encrypted. Say hello, drop a file, or type <kbd>@</kbd> to mention someone.</p></div></div>`;
  const q = state.searchOpen ? state.search.trim().toLowerCase() : '';
  const shown = q ? list.filter((m) => !m.system && m.text.toLowerCase().includes(q)) : list;
  if (q && !shown.length) return `<div class="empty"><div><div class="glyph">${icon('search')}</div><h3>No matches</h3><p>Nothing in this conversation says “${esc(state.search)}”.</p></div></div>`;
  let html = q ? '' : introHtml(key), prev = null, lastDay = '', newShown = false;
  const visit = D.lastVisit[key];
  for (let i = 0; i < shown.length; i++) {
    const m = shown[i];
    if (dayKey(m.t) !== lastDay) { html += `<div class="divider" role="separator">${dayLabel(m.t)}</div>`; lastDay = dayKey(m.t); prev = null; }
    if (visit && !newShown && m.t > visit && !q) { html += `<div class="divider new" role="separator">New since your last visit</div>`; newShown = true; prev = null; }
    if (m.system) {
      // Runs of presence updates collapse into one line.
      if (m.system === 'online') {
        let j = i; while (j + 1 < shown.length && shown[j + 1].system === 'online' && dayKey(shown[j + 1].t) === lastDay) j++;
        const run = shown.slice(i, j + 1);
        if (run.length > 2 && !expandedGroups.has(m.id)) {
          const names = [...new Set(run.map((r) => person(r.person).name))];
          html += `<div class="sysrow">${icon('users')}<span>${names.slice(0, 3).map(esc).join(', ')} came online</span><span class="grouped">· ${run.length} updates</span><button class="expand" data-act="expandGroup" data-id="${m.id}">Show all</button><time>${clock(run[0].t)}–${clock(run.at(-1).t)}</time></div>`;
          i = j; prev = null; continue;
        }
      }
      html += `<div class="sysrow ${m.system === 'warning' ? 'warning' : ''}">${icon(m.system === 'warning' ? 'alert' : 'user')}<span>${m.person ? `<b>${esc(person(m.person).name)}</b> ` : ''}${esc(m.text)}</span><time>${clock(m.t)}</time></div>`;
      prev = null; continue;
    }
    const cont = prev && prev.author === m.author && m.t - prev.t < 5 * 60000 && !m.reply;
    html += messageHtml(m, cont, list, q);
    prev = m;
  }
  return html;
}

function messageHtml(m, cont, list, q = '') {
  const p = person(m.author);
  const mine = m.author === 'me';
  const mentionsMe = /@adam\b/i.test(m.text) && !mine;
  const replyTo = m.reply === 'prev' ? list[list.indexOf(m) - 1] : m.reply ? findMsg(m.reply) : null;
  const attachments = (m.attachments || []).map((a) => {
    if (a.kind === 'image') {
      const inner = a.url ? `<img src="${a.url}" alt="${esc(a.name)}">` : a.art === 'poster' ? poster() : desk();
      return `<figure class="attach-img" data-act="lightbox" data-id="${m.id}" tabindex="0" role="button" aria-label="Open ${esc(a.name)}">${inner}<figcaption>${esc(a.name)}</figcaption></figure>`;
    }
    return `<div class="attach-file">${icon('doc')}<div><b>${esc(a.name)}</b><small>${a.size || 'Encrypted file'}</small></div><button class="ibtn sm" aria-label="Download">${icon('download', 'sm')}</button></div>`;
  }).join('');
  const link = /krypt\.example\/fieldwork\/friday/.test(m.text)
    ? `<div class="linkcard" data-act="openDoc" role="link" tabindex="0"><span class="lc-ico">${icon('doc')}</span><div><small>krypt.example · Shared document</small><b>Friday co-op — plan</b><p>Goals, roles and streaming settings for Friday night.</p></div></div>` : '';
  const reactions = m.reactions.length ? `<div class="reactions">${m.reactions.map((r) => `<button class="reaction ${r.users.includes('me') ? 'mine' : ''}" data-act="react" data-id="${m.id}" data-e="${r.e}" title="${esc(r.users.map((u) => person(u).name).join(', '))}">${r.e} ${r.users.length}</button>`).join('')}<button class="reaction add" data-act="reactPick" data-id="${m.id}" aria-label="Add reaction">${icon('smile', 'xs')}</button></div>` : '';
  const editing = state.editing === m.id;
  const arrive = !m.seen && Date.now() - m.t < 4000; m.seen = true;
  return `<article class="msg ${arrive ? 'arrive' : ''} ${cont ? 'cont' : ''} ${replyTo ? 'has-reply' : ''} ${mentionsMe ? 'mention' : ''} ${editing ? 'editing' : ''}" data-mid="${m.id}" aria-label="Message from ${esc(p.name)}">
    ${replyTo ? `<div class="reply-ref" data-act="gotoMsg" data-id="${replyTo.id}">${avatar(replyTo.author, 'xs')}<b>${esc(person(replyTo.author).name)}</b><span>${esc((replyTo.text || '').slice(0, 90))}</span></div>` : ''}
    ${avatar(m.author, 'md', false, `data-act="profile" data-id="${m.author}"`)}
    ${cont ? `<span class="hovertime">${clock(m.t)}</span>` : `<header><b data-act="profile" data-id="${m.author}">${esc(p.name)}</b><time datetime="${new Date(m.t).toISOString()}">${clock(m.t)}</time>${isPinned(m.id) ? `<span class="pinned-mark" title="Pinned">${icon('pin', 'xs')}Pinned</span>` : ''}</header>`}
    ${editing ? `<div><textarea class="input edit-box" id="editBox" rows="1" aria-label="Edit message">${esc(m.text)}</textarea><div class="edit-actions"><button class="btn sm primary" data-act="saveEdit" data-id="${m.id}">Save</button><button class="btn sm ghost" data-act="cancelEdit">Cancel</button><span class="hint">Esc to cancel · Enter to save</span></div></div>`
      : `<div class="text">${formatText(m.text, q)}${m.edited ? ' <span class="edited">(edited)</span>' : ''}</div>`}
    ${attachments}${link}${reactions}
    <div class="msg-tools" role="toolbar" aria-label="Message actions">
      ${['👍', '😂', '🔥'].map((e) => `<button class="quick" data-act="react" data-id="${m.id}" data-e="${e}" aria-label="React ${e}">${e}</button>`).join('')}
      <span class="tsep" aria-hidden="true"></span>
      <button data-act="reactPick" data-id="${m.id}" aria-label="More reactions" title="Add reaction">${icon('smile', 'sm')}</button>
      <button data-act="reply" data-id="${m.id}" aria-label="Reply" title="Reply">${icon('reply', 'sm')}</button>
      ${mine ? `<button data-act="edit" data-id="${m.id}" aria-label="Edit" title="Edit">${icon('edit', 'sm')}</button>` : ''}
      <button data-act="msgMenu" data-id="${m.id}" aria-label="More" title="More">${icon('more', 'sm')}</button>
    </div>
  </article>`;
}

const isPinned = (id) => Object.values(D.pinned).some((l) => l.includes(Number(id)));
function findMsg(id) {
  id = Number(id);
  for (const list of Object.values(D.messages)) { const m = list.find((x) => x.id === id); if (m) return m; }
  return null;
}

function refreshFeed(stick = true) {
  const inner = $('#feedInner'); if (!inner) return;
  const feed = $('#feed');
  const nearBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 80;
  inner.innerHTML = feedHtml(convKey());
  if (stick || nearBottom) scrollFeed(true);
  const count = $('#searchCount');
  if (count) { const n = $$('.msg', inner).length; count.textContent = state.search.trim() ? `${n} result${n === 1 ? '' : 's'}` : ''; }
}
function scrollFeed(instant) {
  const feed = $('#feed'); if (!feed) return;
  if (instant || reduceMotion()) feed.scrollTop = feed.scrollHeight;
  else feed.scrollTo({ top: feed.scrollHeight, behavior: 'smooth' });
}
// The newest message stays in view when the space around the feed changes (a reply
// bar, the format bar, a taller draft, a resized window) unless you've scrolled up.
let feedObserver = null;
function stickyFeed(feed) {
  let pinned = true;
  feed.addEventListener('scroll', () => { pinned = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 24; }, { passive: true });
  feedObserver?.disconnect();
  feedObserver = new ResizeObserver(() => { if (pinned) feed.scrollTop = feed.scrollHeight; });
  feedObserver.observe(feed);
}
// Toasts and the pop-out player share the bottom-right corner, just above whatever
// ends the view: the composer in a conversation, the voice bar everywhere else.
let cornerObserver = null, cornerWrap = null;
function placeCorner() {
  const wrap = $('#main .composer-wrap'); const bar = $('#main .dock.collapsed') || $('#voicebar');
  const floor = wrap ? wrap.getBoundingClientRect().top : bar ? bar.getBoundingClientRect().top : innerHeight;
  const root = document.documentElement.style;
  root.setProperty('--corner', `${Math.round(innerHeight - floor + 12)}px`);
  const mini = $('.mini-player:not(.moved)');
  root.setProperty('--toast-lift', mini ? `${mini.offsetHeight + 12}px` : '0px');
  // A taller draft or a reply bar moves the composer's top edge, so follow it.
  if (wrap !== cornerWrap) {
    cornerObserver?.disconnect(); cornerWrap = wrap;
    if (wrap) { cornerObserver = new ResizeObserver(() => placeCorner()); cornerObserver.observe(wrap); }
  }
}

function afterChat() {
  scrollFeed(true);
  const input = $('#input');
  const feed = $('#feed');
  stickyFeed(feed);
  feed.addEventListener('scroll', () => {
    const near = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 80;
    if (near) $('#jump')?.classList.remove('show');
  });
  if (input) {
    input.value = drafts[convKey()] || '';
    autoGrow(input); updateSend();
    input.addEventListener('input', () => { drafts[convKey()] = input.value; autoGrow(input); updateSend(); mentionComplete(input); });
    input.addEventListener('keydown', composerKey);
    input.addEventListener('paste', (e) => { const files = [...(e.clipboardData?.files || [])]; if (files.length) { e.preventDefault(); addFiles(files); } });
    if (matchMedia('(pointer: fine)').matches) input.focus({ preventScroll: true });
  }
  $('#fileInput')?.addEventListener('change', (e) => addFiles([...e.target.files]));
  const s = $('#searchInput');
  if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); s.addEventListener('input', () => { state.search = s.value; refreshFeed(false); }); refreshFeed(false); }
  renderTyping();
  const main = $('#main');
  let depth = 0;
  main.ondragenter = (e) => { if ([...e.dataTransfer.types].includes('Files')) { depth++; $('#dropzone')?.classList.add('show'); } };
  main.ondragleave = () => { if (--depth <= 0) { depth = 0; $('#dropzone')?.classList.remove('show'); } };
  main.ondragover = (e) => e.preventDefault();
  main.ondrop = (e) => { e.preventDefault(); depth = 0; $('#dropzone')?.classList.remove('show'); addFiles([...e.dataTransfer.files]); };
}
const drafts = {};
function autoGrow(t) { t.style.height = 'auto'; const max = innerHeight * 0.4; t.style.height = Math.min(t.scrollHeight, max) + 'px'; t.style.overflowY = t.scrollHeight > max ? 'auto' : 'hidden'; }
function updateSend() { const b = $('#send'), t = $('#input'); if (b && t) b.classList.toggle('ready', !!t.value.trim() || state.pending.length > 0); }

function addFiles(files) {
  for (const f of files.slice(0, 10)) state.pending.push({ name: f.name, size: `${(f.size / 1024).toFixed(0)} KB`, url: f.type.startsWith('image/') ? URL.createObjectURL(f) : null });
  rerenderComposer();
}
function rerenderComposer() {
  const wrap = $('.view .composer-wrap'); if (!wrap) return;
  const input = $('#input'); const val = input?.value || '';
  const tmp = document.createElement('div');
  const ch = state.dm ? `Message ${person(D.dms.find((d) => d.id === state.dm).with).name}` : `Message ${D.channels[state.channel].name}`;
  const vis = state.dm ? 'Only the two of you can read this' : `Visible to people with access to ${D.rooms[state.room].name}`;
  tmp.innerHTML = composerHtml(ch, vis, !!wrap.closest('.dock'));
  wrap.replaceWith(tmp.firstElementChild);
  const ni = $('#input'); ni.value = val; autoGrow(ni); updateSend();
  ni.addEventListener('input', () => { drafts[convKey()] = ni.value; autoGrow(ni); updateSend(); mentionComplete(ni); });
  ni.addEventListener('keydown', composerKey);
  $('#fileInput')?.addEventListener('change', (e) => addFiles([...e.target.files]));
  ni.focus({ preventScroll: true });
  placeCorner();
}

function composerKey(e) {
  const pop = $('.popover.mention-pop:not(.closing)');
  if (pop) {
    const items = $$('.menu-item', pop); let i = items.findIndex((x) => x.classList.contains('active'));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[i]?.classList.remove('active'); i = (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; items[i].classList.add('active'); return; }
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); items[Math.max(0, i)].click(); return; }
    if (e.key === 'Escape') { closePopover(); return; }
  }
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
  else if (e.key === 'ArrowUp' && !e.target.value) {
    const mine = (D.messages[convKey()] || []).filter((m) => m.author === 'me').at(-1);
    if (mine) { e.preventDefault(); state.editing = mine.id; refreshFeed(false); focusEdit(); }
  } else if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'i')) { e.preventDefault(); wrapSel(e.key === 'b' ? '**' : '*'); }
  else if (e.key === 'Escape' && state.replyTo) { state.replyTo = null; rerenderComposer(); }
}
function wrapSel(mark, block = false) {
  const t = $('#input'); if (!t) return;
  const [a, b] = [t.selectionStart, t.selectionEnd]; const sel = t.value.slice(a, b) || (block ? 'code' : 'text');
  const open = block ? '```\n' : mark, close = block ? '\n```' : mark;
  t.setRangeText(open + sel + close, a, b, 'end'); t.focus(); t.setSelectionRange(a + open.length, a + open.length + sel.length);
  drafts[convKey()] = t.value; autoGrow(t); updateSend();
}
function mentionComplete(t) {
  const before = t.value.slice(0, t.selectionStart); const m = before.match(/@(\w*)$/);
  if (!m) { if ($('.popover.mention-pop:not(.closing)')) closePopover(); return; }
  const q = m[1].toLowerCase();
  const list = Object.values(D.people).filter((p) => p.id !== 'me' && (p.handle.startsWith(q) || p.name.toLowerCase().includes(q))).slice(0, 6);
  if (!list.length) { closePopover(); return; }
  const html = `<div class="menu-label">Mention</div>${list.map((p, i) => `<button class="menu-item ${i === 0 ? 'active' : ''}" data-mention="${p.handle}">${avatar(p.id, 'xs', true)}<span>${esc(p.name)}</span><span class="hint">@${p.handle}</span></button>`).join('')}`;
  const pop = openPopover($('#composer'), html, { place: 'above', cls: 'mention-pop', keepFocus: true });
  pop.addEventListener('click', (e) => {
    const b = e.target.closest('[data-mention]'); if (!b) return;
    const pos = t.selectionStart; const start = before.length - m[0].length;
    t.setRangeText(`@${b.dataset.mention} `, start, pos, 'end'); closePopover(); t.focus(); drafts[convKey()] = t.value; updateSend();
  });
}

function send() {
  const t = $('#input'); if (!t) return;
  const text = t.value.trim();
  if (!text && !state.pending.length) return;
  const key = convKey();
  const list = (D.messages[key] ||= []);
  const m = { id: Date.now(), author: 'me', t: Date.now(), text, reactions: [], reply: state.replyTo || undefined, attachments: state.pending.length ? state.pending.map((p) => ({ kind: p.url ? 'image' : 'file', name: p.name, url: p.url, size: p.size })) : undefined };
  list.push(m);
  t.value = ''; drafts[key] = ''; state.pending = []; state.replyTo = null;
  if ($('.replying') || $('.pending')) rerenderComposer(); else { autoGrow(t); updateSend(); }
  refreshFeed(true); renderSide();
  simulateReply(key, text);
}

const replies = {
  default: ['nice 👀', 'on it', 'haha yes', 'agreed', 'sounds good to me', 'wait really?', 'screenshare looks buttery now btw'],
  question: ['yeah I think so', 'not sure, will check tonight', 'yes!', 'probably after 8'],
};
function simulateReply(key, text) {
  const dm = D.dms.find((d) => d.id === key);
  const pool = dm ? [dm.with] : ['alex', 'cole', 'mike', 'mel'];
  const who = pool[Math.floor(Math.random() * pool.length)];
  const lines = text.includes('?') ? replies.question : replies.default;
  setTimeout(() => { state.typing[key] = who; renderTyping(); }, 700);
  setTimeout(() => {
    delete state.typing[key]; renderTyping();
    (D.messages[key] ||= []).push({ id: Date.now(), author: who, t: Date.now(), text: lines[Math.floor(Math.random() * lines.length)], reactions: [] });
    if (convKey() === key) {
      const feed = $('#feed'); const near = feed && feed.scrollHeight - feed.scrollTop - feed.clientHeight < 80;
      refreshFeed(false); if (!near) $('#jump')?.classList.add('show');
    } else {
      state.unread[key] = (state.unread[key] || 0) + 1; renderTabs();
      const msgs = D.messages[key]; const where = dm ? 'Direct message' : `${D.channels[key]?.name} · ${D.rooms[roomOf(key)]?.name}`;
      if (!state.muted.has(key)) toast(person(who).name, `${where} — ${msgs.at(-1).text}`, 'message', '', () => { if (dm) openDm(key); else { const r = roomOf(key); const c = D.communities.find((x) => x.rooms.includes(r)); go(c.id, r, key); } }, avatar(who, 'sm'));
    }
    renderSide();
  }, 2200 + Math.random() * 1400);
}
function renderTyping() {
  const el = $('#typing'); if (!el) return;
  const who = state.typing[convKey()];
  el.innerHTML = who ? `<span class="dots"><i></i><i></i><i></i></span><span><b>${esc(person(who).name)}</b> is typing…</span>` : '';
}
function focusEdit() { const b = $('#editBox'); if (!b) return; autoGrow(b); b.oninput = () => autoGrow(b); b.focus({ preventScroll: true }); b.setSelectionRange(b.value.length, b.value.length); b.closest('.msg')?.scrollIntoView({ block: 'nearest' }); b.onkeydown = (e) => { if (e.key === 'Escape') { state.editing = null; refreshFeed(false); $('#input')?.focus(); } if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(state.editing); } }; }
function saveEdit(id) { const m = findMsg(id); const b = $('#editBox'); if (m && b && b.value.trim()) { m.text = b.value.trim(); m.edited = true; } state.editing = null; refreshFeed(false); $('#input')?.focus(); }

// ------------------------------------------------------------------ voice
function participants() { return [...(D.voiceOccupants[state.voice.channel] || []), 'me']; }
function remoteShare() { return state.voice.channel === 'voice' ? { who: 'alex', img: 'assets/shares/tactical-game.png', name: 'Tactical Ops' } : null; }

function voiceView() {
  const ch = D.channels[state.channel]; const room = D.rooms[state.room];
  const here = state.voice.channel === state.channel;
  const occupants = D.voiceOccupants[state.channel] || [];
  const tools = here ? `<div class="stage-tools" role="toolbar" aria-label="Stage">
      <div class="seg-mini" role="group" aria-label="Layout"><button class="ibtn ${state.voice.focus ? '' : 'on'}" data-act="layout" data-v="grid" aria-pressed="${!state.voice.focus}" aria-label="Grid layout" title="Grid">${icon('grid', 'sm')}</button>
      <button class="ibtn ${state.voice.focus ? 'on' : ''}" data-act="layout" data-v="focus" aria-pressed="${state.voice.focus}" aria-label="Focus the share" title="Focus">${icon('spotlight', 'sm')}</button></div>
      <span class="vr" aria-hidden="true"></span>
      <button class="ibtn toggle-i ${state.share.hud ? 'on' : ''}" data-act="hud" aria-pressed="${state.share.hud}" aria-label="Stream stats" title="Stream stats">${icon('activity', 'sm')}</button>
      <button class="ibtn toggle-i ${state.voice.dock ? 'on' : ''}" data-act="dockToggle" aria-pressed="${state.voice.dock}" aria-label="Chat panel" title="Chat panel">${icon('panelBottom', 'sm')}</button></div>` : '';
  let body;
  if (!here) {
    body = `<div class="join-card">
      <span class="jc-glyph">${icon('phone')}</span>
      <h2>${esc(ch.name)}</h2><p>${occupants.length ? `${occupants.length} ${occupants.length === 1 ? 'person is' : 'people are'} here${remoteShare() || state.channel === 'voice' ? ' · Alex is sharing a screen' : ''}` : 'Nobody’s here yet — start the hangout'}</p>
      <div class="who-here">${occupants.map((id) => avatar(id, 'md')).join('')}</div>
      <div class="preflight"><span class="pill sm ${state.voice.muted ? 'muted' : ''}"><button data-act="mute" aria-pressed="${state.voice.muted}">${icon(state.voice.muted ? 'micOff' : 'mic', 'sm')}<span>${state.voice.muted ? 'Join muted' : 'Mic on'}</span></button></span>
        <span class="pill sm"><button data-act="micTest">${icon('wave', 'sm')}<span>Test mic</span></button></span></div>
      <button class="btn primary lg" data-act="joinVoice" data-id="${state.channel}">${icon('phone', 'sm')} Join voice</button></div>`;
  } else {
    const people = participants();
    const shares = [];
    const rs = remoteShare(); if (rs) shares.push({ ...rs, mine: false });
    if (state.voice.sharing) { const s = D.shareSources.find((x) => x.id === state.voice.sharing); shares.push({ who: 'me', img: s.img, name: s.name, mine: true }); }
    const { cols, holes } = stageLayout(people.length, shares.length);
    const spanOf = (i) => (i !== people.length - 1 || !holes ? '' : shares.length && people.length === 1 ? ' tall' : ` span-${holes + 1}`);
    body = `<div class="grid" id="grid" style="--cols:${cols};--share-span:${Math.min(2, cols)};--rows:${people.length + Math.max(0, shares.length - 1)}">
      ${shares.map((s, i) => `<div class="tile share" data-act="shareFull" data-i="${i}" data-who="${s.who}" data-name="${esc(s.name)}" role="button" tabindex="0" aria-label="${esc(person(s.who).name)}’s screen, open full screen">
        <img src="${s.img}" alt="">
        <span class="label"><span class="live-dot"></span>${s.mine ? 'You’re sharing' : esc(person(s.who).name)} · ${esc(s.name)}</span>
        ${state.share.hud ? hudHtml(i) : ''}</div>`).join('')}
      ${people.map((id, i) => {
        const muted = id === 'me' ? state.voice.muted : id === 'mike';
        return `<div class="tile${state.voice.focus ? '' : spanOf(i)}" data-tile="${id}"><div class="who">${avatar(id, 'lg')}<b>${esc(person(id).name)}${id === 'me' ? '<span class="you">You</span>' : ''}</b>
        <span class="state ${muted ? 'muted' : 'quiet'}" data-state="${id}" title="${muted ? 'Mic muted' : ''}">${muted ? icon('micOff', 'xs') : ''}</span></div></div>`;
      }).join('')}
    </div>`;
  }
  // The call's chat folds down to a bar (with the latest line) rather than disappearing.
  const last = lastMsg(state.channel);
  const dock = !here ? '' : state.voice.dock ? `<div class="dock"><button class="dhead" data-act="dockToggle" aria-expanded="true" title="Hide chat">${icon('message', 'sm')}<b>Chat<small>${esc(ch.name)}</small></b>${icon('chevronDown', 'sm')}</button>
    <div class="feed" id="feed"><div class="feed-inner" id="feedInner">${feedHtml(state.channel)}</div></div><div class="typing" id="typing"></div>
    ${composerHtml(`Message ${ch.name}`, '', true)}</div>`
    : `<div class="dock collapsed"><button class="dhead" data-act="dockToggle" aria-expanded="false" title="Show chat">${icon('message', 'sm')}<b>Chat<small>${esc(ch.name)}</small></b><span class="dh-last">${last ? `<b>${esc(person(last.author).name)}</b> ${esc(snippet(last, 80))}` : ''}</span>${icon('chevronUp', 'sm')}</button></div>`;
  return `<section class="view" aria-label="Voice channel">
    ${header(esc(ch.name), `${esc(room.name)} / Voice channel · ${voiceCount(state.channel)} in voice`, here ? `${tools}<button class="btn ${state.voice.sharing ? 'danger' : ''}" data-act="${state.voice.sharing ? 'stopShare' : 'sharePicker'}">${icon(state.voice.sharing ? 'monitorOff' : 'monitorUp', 'sm')}${state.voice.sharing ? 'Stop sharing' : 'Share screen'}</button>` : '')}
    <div class="stage ${state.voice.focus ? 'focus' : ''}" id="stage"><canvas class="aurora" id="aurora"></canvas>${body}</div>${dock}
  </section>`;
}
// Pick a column count that leaves no empty cells (a share counts as a 2×2 block);
// if one is left over, the last tile stretches across it.
function stageLayout(n, s) {
  if (!s) { const cols = [1, 1, 2, 3, 2, 3, 3, 4, 4, 3][n] || Math.ceil(Math.sqrt(n)); return { cols, holes: Math.ceil(n / cols) * cols - n }; }
  let best = null;
  for (const cols of [3, 4]) { const cells = s * 4 + n; const holes = Math.ceil(cells / cols) * cols - cells; if (!best || holes <= best.holes) best = { cols, holes }; }
  return best;
}
// The bitrate graph starts full: a share that's been live a while has history.
const hudPath = () => hudSeries.map((b, i) => `${i ? 'L' : 'M'}${(i / 39) * 100},${26 - ((b - 8) / 4) * 24}`).join(' ');
function hudHtml(i) {
  if (hudSeries.length < 40) hudSeries = Array.from({ length: 40 }, () => 9.2 + Math.random() * 1.8);
  return `<div class="hud" data-hud="${i}"><div><span>Resolution</span><b>1920×1080</b></div><div><span>Frame rate</span><b class="good" data-k="fps">60.0</b></div>
    <div><span>Codec</span><b data-k="codec">${state.share.codec === 'auto' ? 'VP9' : state.share.codec.toUpperCase()}</b></div><div><span>Bitrate</span><b data-k="br">9.8 Mb/s</b></div>
    <div><span>Latency</span><b data-k="lat">71 ms</b></div><div><span>Dropped</span><b class="good" data-k="drop">0</b></div><svg viewBox="0 0 100 26" preserveAspectRatio="none"><path data-k="spark" d="${hudPath()}"/></svg></div>`;
}

let stageTimer = 0, auroraRaf = 0, hudSeries = [];
function afterVoice() {
  const canvas = $('#aurora');
  if (canvas) startAurora(canvas);
  if (state.voice.channel === state.channel) {
    const feed = $('#feed');
    if (feed) { scrollFeed(true); stickyFeed(feed); const i = $('#input'); if (i) { i.addEventListener('input', () => { autoGrow(i); updateSend(); }); i.addEventListener('keydown', composerKey); } }
  }
}
function stopStage() { clearInterval(stageTimer); cancelAnimationFrame(auroraRaf); }

function startAurora(canvas) {
  const ctx = canvas.getContext('2d');
  const css = getComputedStyle(document.documentElement);
  const accent = css.getPropertyValue('--accent-rgb').trim().split(' ').map(Number);
  const presence = hexRgb(css.getPropertyValue('--presence').trim());
  const bg = hexRgb(css.getPropertyValue('--bg').trim());
  const blobs = [
    { c: accent, x: .2, y: .3, r: .55, sx: .00011, sy: .00017, a: .28 },
    { c: presence, x: .8, y: .7, r: .5, sx: .00013, sy: .00009, a: .16 },
    { c: accent, x: .6, y: .1, r: .4, sx: .00007, sy: .00014, a: .18 },
  ];
  const draw = (t) => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) { auroraRaf = requestAnimationFrame(draw); return; }
    const scale = 0.35;
    if (canvas.width !== Math.round(w * scale)) { canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale); }
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = `rgb(${bg.join(',')})`; ctx.fillRect(0, 0, W, H);
    const energy = 1 + Math.min(1, state.voice.speaking.size * 0.35);
    for (const b of blobs) {
      const x = (b.x + Math.sin(t * b.sx * 6) * 0.18) * W, y = (b.y + Math.cos(t * b.sy * 6) * 0.2) * H;
      const g = ctx.createRadialGradient(x, y, 0, x, y, b.r * Math.max(W, H));
      g.addColorStop(0, `rgba(${b.c.join(',')},${b.a * energy})`); g.addColorStop(1, `rgba(${b.c.join(',')},0)`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    // Faint perspective floor lines, like the client's voice stage.
    ctx.strokeStyle = `rgba(${presence.join(',')},0.05)`; ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) { const yy = H * (0.72 + i * i * 0.004); ctx.beginPath(); ctx.moveTo(0, yy + Math.sin(t / 2000 + i) * 2); ctx.bezierCurveTo(W * .3, yy - 12, W * .7, yy + 12, W, yy); ctx.stroke(); }
    if (!reduceMotion()) auroraRaf = requestAnimationFrame(draw);
  };
  auroraRaf = requestAnimationFrame(draw);
}
function hexRgb(h) { const n = parseHex(h || '#000000'); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

function tickVoice() {
  const v = state.voice; if (!v.channel) return;
  const people = participants();
  v.speaking.clear();
  for (const id of people) {
    const muted = id === 'me' ? v.muted : id === 'mike';
    let l = v.levels[id] ?? 0;
    const target = muted ? 0 : Math.random() < (id === 'me' ? 0.04 : 0.07) ? 0.6 + Math.random() * 0.4 : l * 0.82;
    l = l + (target - l) * 0.6; v.levels[id] = l;
    if (l > 0.35) v.speaking.add(id);
    const tile = $(`[data-tile="${id}"]`);
    if (tile) {
      tile.classList.toggle('speaking', l > 0.35);
      const av = $('.avatar', tile); if (av) av.style.transform = `scale(${1 + l * 0.08})`;
      const st = $(`[data-state="${id}"]`);
      if (st && !muted) { const sp = l > 0.35; if (st.dataset.on !== String(sp)) { st.dataset.on = sp; st.innerHTML = sp ? '<span class="eq"><i></i><i></i><i></i><i></i></span>' : ''; st.classList.toggle('quiet', !sp); st.title = sp ? 'Speaking' : ''; } }
    }
  }
  const note = $('#speakingNote');
  if (note) {
    const s = [...v.speaking].filter((x) => x !== 'me');
    const text = s.length ? `<b>${esc(person(s[0]).name)}</b>${s.length > 1 ? ` +${s.length - 1} speaking` : ' is speaking'}` : '';
    if (note.dataset.text !== text) { note.dataset.text = text; note.innerHTML = text ? `<span class="eq"><i></i><i></i><i></i><i></i></span><span class="t">${text}</span>` : ''; }
  }
  $$('#voicebar .vpeople .avatar').forEach((a) => a.classList.toggle('speaking', v.speaking.has(a.dataset.person)));
  const meter = $('#myMeter'); if (meter) meter.style.height = `${(v.muted ? 0 : v.levels.me || 0) * 100}%`;
  if (Math.random() < 0.25) updateHud();
}
function updateHud() {
  const fps = (59.6 + Math.random() * 0.4).toFixed(1);
  const br = 9.2 + Math.random() * 1.8; hudSeries.push(br); if (hudSeries.length > 40) hudSeries.shift();
  const path = hudPath();
  $$('.hud').forEach((h) => {
    h.querySelector('[data-k=fps]').textContent = fps;
    h.querySelector('[data-k=br]').textContent = br.toFixed(1) + ' Mb/s';
    h.querySelector('[data-k=lat]').textContent = Math.round(66 + Math.random() * 12) + ' ms';
    h.querySelector('[data-k=spark]').setAttribute('d', path);
  });
  const ping = Math.round(22 + Math.random() * 6); state.voice.ping.push(ping); if (state.voice.ping.length > 20) state.voice.ping.shift();
  const pv = $('#pingValue'); if (pv) pv.textContent = ping + ' ms';
  const sp = $('#pingSpark'); if (sp) sp.setAttribute('d', pingPath());
}

function pingPath() { return state.voice.ping.map((p, i) => `${i ? 'L' : 'M'}${(i / 19) * 44},${18 - ((p - 18) / 14) * 16}`).join(' '); }
function joinVoice(id) {
  state.voice.channel = id; state.voice.joinedAt = Date.now(); state.voice.levels = {};
  state.voice.ping = Array.from({ length: 20 }, () => Math.round(22 + Math.random() * 6));
  toast('Voice connected', `${D.channels[id].name} · encrypted`, 'phone', 'ok');
  renderVoicebar(); renderSide(); renderTabs();
  if (state.channel === id) renderMain();
  else { stopStage(); stageTimer = setInterval(tickVoice, 120); }
}
function leaveVoice() {
  state.voice.channel = null; state.voice.sharing = null; state.voice.speaking.clear(); closeMini();
  stopStage(); renderVoicebar(); renderSide(); renderTabs();
  renderMain();
  toast('Left voice', 'See you later', 'leave');
}

function renderVoicebar() {
  const v = state.voice;
  const split = (main, mainLabel, chevron, cls, act, lbl = '') => `<span class="pill ${cls}"><button data-act="${act}" aria-pressed="${cls === 'muted'}" title="${mainLabel}">${main}<span class="${lbl}">${mainLabel}</span></button><button data-act="${chevron}" aria-label="${mainLabel} options">${icon('chevronDown', 'sm')}</button></span>`;
  if (!v.channel) {
    $('#voicebar').innerHTML = `<button class="vstatus" data-act="cmdkVoice">${icon('phone', 'lg')}<span><b>Not in voice</b><small>Join a room to talk</small></span></button>
      <div class="spacer"></div><div class="vctl">
      ${split(icon(v.muted ? 'micOff' : 'mic', 'sm'), v.muted ? 'Mic off' : 'Mic on', 'micMenu', v.muted ? 'muted' : '', 'mute')}
      ${split(icon(v.deafened ? 'headphonesOff' : 'headphones', 'sm'), 'Deafen', 'outMenu', v.deafened ? 'muted' : '', 'deafen')}</div>`;
    return;
  }
  const ch = D.channels[v.channel]; const room = D.rooms[roomOf(v.channel)];
  const watching = !state.dm && state.channel === v.channel;
  $('#voicebar').innerHTML = `<button class="vstatus live" data-act="gotoVoice" title="${esc(room.name)} · ${esc(ch.name)} · ${participants().length} people"><span class="vbars"><i></i><i></i><i></i><i></i><i></i></span><span><b>Voice connected</b>${watching ? `<small>${esc(room.name)} · ${esc(ch.name)}</small>` : '<small class="back">Return to call</small>'}</span></button>
    <div class="vpeople">${participants().slice(0, 4).map((id) => avatar(id, '', false, `data-act="profile" data-id="${id}" role="button" tabindex="0"`)).join('')}${participants().length > 4 ? `<button class="more" data-act="gotoVoice" aria-label="${participants().length - 4} more in the call">+${participants().length - 4}</button>` : ''}</div>
    <div class="speaking-note" id="speakingNote"></div>
    <div class="spacer"></div><div class="vctl">
    <span class="ping" title="Round-trip time">${icon('signal', 'sm')}<span id="pingValue">${v.ping.at(-1) ?? 24} ms</span><svg class="spark" viewBox="0 0 44 18"><path id="pingSpark" d="${pingPath()}"/></svg></span>
    <span class="pill ${v.muted ? 'muted' : ''}"><button data-act="mute" aria-pressed="${v.muted}" title="Ctrl+Shift+M">${icon(v.muted ? 'micOff' : 'mic', 'sm')}${v.muted ? '' : '<span class="mic-meter" aria-hidden="true"><i id="myMeter"></i></span>'}<span>${v.muted ? 'Mic muted' : 'Mic on'}</span></button><button data-act="micMenu" aria-label="Microphone options">${icon('chevronDown', 'sm')}</button></span>
    ${split(icon(v.deafened ? 'headphonesOff' : 'headphones', 'sm'), v.deafened ? 'Deafened' : 'Deafen', 'outMenu', v.deafened ? 'muted' : '', 'deafen', 'opt')}
    <span class="pill ${v.sharing ? 'on' : ''}"><button data-act="${v.sharing ? 'stopShare' : 'sharePicker'}" title="${v.sharing ? 'Stop sharing' : 'Share screen'}">${icon(v.sharing ? 'monitorOff' : 'monitorUp', 'sm')}<span class="opt">${v.sharing ? 'Stop share' : 'Share screen'}</span></button></span>
    <span class="pill leave"><button data-act="leave" title="Leave call">${icon('leave', 'sm')}<span>Leave call</span></button></span></div>`;
}

// ------------------------------------------------------------------ calendar, docs, tasks
function calendarView() {
  const base = new Date(); base.setDate(1); base.setMonth(base.getMonth() + state.calendarOffset);
  const month = base.getMonth(), year = base.getFullYear();
  const start = new Date(year, month, 1); const lead = (start.getDay() + 6) % 7; start.setDate(1 - lead);
  const today = new Date().toDateString();
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const evs = D.events.filter((e) => { const x = new Date(); x.setDate(x.getDate() + e.day); return x.toDateString() === d.toDateString(); });
    cells.push(`<div class="cal-cell ${d.getMonth() !== month ? 'other' : ''} ${d.toDateString() === today ? 'today' : ''} ${d.getDay() % 6 === 0 ? 'weekend' : ''}" data-act="addEvent" data-date="${d.toISOString()}">
      <span class="d">${d.getDate()}</span>${evs.map((e) => `<span class="ev" role="button" tabindex="0" data-act="eventInfo" data-ev="${D.events.indexOf(e)}" style="--eh:${e.hue}" title="${esc(e.title)} · ${pad(e.h)}:00"><time>${pad(e.h)}:00</time>${esc(e.title)}</span>`).join('')}</div>`);
  }
  const upcoming = D.events.filter((e) => e.day >= 0).sort((a, b) => a.day - b.day)[0];
  return `<section class="view">${header('Calendar', `${esc(D.rooms[state.room].name)} / Shared calendar · everyone in the room can add events`, `<button class="btn primary" data-act="addEvent">${icon('plus', 'sm')}New event</button>`)}
    <div class="calendar"><div class="cal-head"><h3>${base.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3>
      <button class="ibtn boxed sm" data-act="cal" data-d="-1" aria-label="Previous month">${icon('chevronLeft', 'sm')}</button><button class="ibtn boxed sm" data-act="cal" data-d="1" aria-label="Next month">${icon('chevronRight', 'sm')}</button>
      <button class="btn sm" data-act="cal" data-d="0">Today</button>
      ${upcoming ? `<span class="cal-next">${icon('clock', 'sm')}Next: <b>${esc(upcoming.title)}</b> ${upcoming.day === 0 ? 'today' : `in ${upcoming.day} days`} at ${pad(upcoming.h)}:00 <span class="who">${upcoming.who.map((w) => avatar(w, 'xs')).join('')}</span></span>` : ''}</div>
      <div class="cal-grid">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => `<div class="dow">${d}</div>`).join('')}${cells.join('')}</div></div></section>`;
}

function docsView() {
  const d = D.doc;
  return `<section class="view">${header('docs', `${esc(D.rooms[state.room].name)} / Shared document · edits sync to everyone live`, `<button class="btn" data-act="toastCopy">${icon('link', 'sm')}Copy link</button>`)}
    <div class="docs"><nav class="outline" id="outline" aria-label="Document outline"></nav>
    <div class="paper-wrap"><article class="paper">
      <div class="doc-meta"><span class="who">${d.editors.map((e) => avatar(e, 'xs')).join('')}</span><span>Edited ${ago(d.updated)} ago by Alex · <span id="saveState">Saved</span></span></div>
      <h1 class="doc-title" contenteditable="true" spellcheck="false">${esc(d.title)}</h1>
      <div id="docBody" contenteditable="true">${d.html}</div></article></div></div></section>`;
}
function afterDocs() {
  const body = $('#docBody');
  const outline = () => { $('#outline').innerHTML = `<h4>On this page</h4>` + $$('h2', body).map((h, i) => { h.id = 'h' + i; return `<a href="#h${i}">${esc(h.textContent)}</a>`; }).join(''); };
  outline();
  const wrap = $('.paper-wrap');
  $('#outline').addEventListener('click', (e) => { const a = e.target.closest('a'); if (!a) return; e.preventDefault(); $(a.getAttribute('href'), body)?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' }); });
  const spy = () => { const hs = $$('h2', body); let cur = 0; hs.forEach((h, i) => { if (h.getBoundingClientRect().top - wrap.getBoundingClientRect().top < 80) cur = i; }); $$('#outline a').forEach((a, i) => a.classList.toggle('current', i === cur)); };
  wrap.addEventListener('scroll', spy, { passive: true }); spy();
  // A collaborator's caret, parked after the first paragraph.
  const p = $('p', body); if (p) p.insertAdjacentHTML('beforeend', `<span class="remote-caret" contenteditable="false" style="--h:${person('alex').hue}" data-name="Alex"></span>`);
  let t; body.addEventListener('input', () => { $('#saveState').textContent = 'Saving…'; clearTimeout(t); t = setTimeout(() => { $('#saveState').textContent = 'Saved'; outline(); }, 700); });
}

function tasksView() {
  const tags = { Plan: 210, Art: 320, Tech: 150, Food: 30 };
  return `<section class="view">${header('Tasks', `${esc(D.rooms[state.room].name)} / Board · drag cards between columns`, `<button class="btn primary" data-act="addTask" data-col="todo">${icon('plus', 'sm')}Add task</button>`)}
    <div class="board">${D.tasks.columns.map((c) => {
      const items = D.tasks.items.filter((i) => i.col === c.id);
      return `<section class="col" data-col="${c.id}"><header>${c.name} <span class="n">${items.length}</span><button class="ibtn sm" data-act="addTask" data-col="${c.id}" aria-label="Add to ${c.name}">${icon('plus', 'sm')}</button></header>
        <div class="cards">${items.map((i) => `<div class="card ${c.id === 'done' ? 'done' : ''}" draggable="true" data-task="${i.id}"><div class="ttl">${esc(i.title)}</div><footer><span class="tag" style="--th:${tags[i.tag] ?? 200}">${esc(i.tag)}</span>${avatar(i.who, 'xs')}</footer></div>`).join('')}</div></section>`;
    }).join('')}</div></section>`;
}
function afterTasks() {
  let dragging = null;
  $$('.card').forEach((c) => {
    c.addEventListener('dragstart', (e) => { dragging = c.dataset.task; c.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
    c.addEventListener('dragend', () => c.classList.remove('dragging'));
  });
  $$('.col').forEach((col) => {
    col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('over'); });
    col.addEventListener('dragleave', () => col.classList.remove('over'));
    col.addEventListener('drop', (e) => {
      e.preventDefault(); col.classList.remove('over');
      const item = D.tasks.items.find((i) => i.id === dragging); if (!item) return;
      const moved = item.col !== col.dataset.col; item.col = col.dataset.col;
      renderMain(); if (moved && item.col === 'done') toast('Task done', item.title, 'checkCircle', 'ok');
    });
  });
}

// ------------------------------------------------------------------ popovers, modals, toasts
let popover = null;
function openPopover(anchor, html, { place = 'below', align = 'start', cls = '', keepFocus = false } = {}) {
  closePopover();
  const el = document.createElement('div'); el.className = `popover ${cls}`; el.innerHTML = html; el.setAttribute('role', 'menu');
  document.body.append(el);
  const r = anchor.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
  let x, y, origin;
  if (place === 'side' && r.right + 8 + w <= innerWidth - 8) {
    // Beside the anchor, like a profile next to the name that opened it.
    x = r.right + 8; y = clamp(r.top - 8, 8, innerHeight - h - 8); origin = 'left top';
  } else {
    x = align === 'end' ? r.right - w : r.left; y = place === 'above' ? r.top - h - 8 : r.bottom + 6;
    if (y + h > innerHeight - 8) y = r.top - h - 6; if (y < 8) y = 8;
    x = clamp(x, 8, innerWidth - w - 8);
    origin = `${align === 'end' ? 'right' : 'left'} ${place === 'above' || y < r.top ? 'bottom' : 'top'}`;
  }
  el.style.left = x + 'px'; el.style.top = y + 'px';
  el.style.setProperty('--origin', origin);
  popover = { el, anchor };
  anchor.setAttribute?.('aria-expanded', 'true');
  if (!keepFocus) el.querySelector('button')?.focus({ preventScroll: true });
  return el;
}
function closePopover() {
  if (!popover) return;
  const { el, anchor } = popover; popover = null;
  anchor.setAttribute?.('aria-expanded', 'false');
  // Fade out; ids leave immediately so a popover opening in its place owns them.
  el.classList.add('closing'); $$('[id]', el).forEach((x) => x.removeAttribute('id'));
  setTimeout(() => el.remove(), reduceMotion() ? 0 : 120);
  $$('.msg.menu-open').forEach((m) => m.classList.remove('menu-open'));
}

function modal(html, { cls = '', label = 'Dialog' } = {}) {
  closeModal(); clearToasts();
  const s = document.createElement('div'); s.className = 'scrim'; s.id = 'scrim';
  s.innerHTML = `<div class="modal ${cls}" role="dialog" aria-modal="true" aria-label="${esc(label)}" tabindex="-1">${html}</div>`;
  s.addEventListener('mousedown', (e) => { if (e.target === s) closeModal(); });
  lockBackground(s);
  document.body.append(s);
  // Settings opens on its nav, not on a colour picker halfway down the pane.
  setTimeout(() => (s.querySelector('[autofocus]') || (cls.includes('settings') ? null : s.querySelector('input:not([readonly])')) || s.querySelector('.modal'))?.focus({ preventScroll: true }), 30);
  return s;
}
// While a dialog is open the app behind it can't be tabbed into or clicked, and
// focus goes back to whatever opened the dialog when it closes.
let returnFocus = null;
function lockBackground() {
  if (!$('#scrim')) returnFocus = document.activeElement;
  $('#app')?.setAttribute('inert', ''); closePopover();
}
function closeModal() {
  const s = $('#scrim'); if (!s) return;
  $('#app')?.removeAttribute('inert');
  const back = returnFocus; returnFocus = null;
  if (back?.isConnected && !back.closest('.scrim')) setTimeout(() => back.focus({ preventScroll: true }), 0);
  s.removeAttribute('id'); s.classList.add('closing'); $$('[id]', s).forEach((x) => x.removeAttribute('id'));
  setTimeout(() => s.remove(), reduceMotion() ? 0 : 170);
  micStop();
}

function toast(title, sub = '', ic = 'info', kind = '', onClick = null, lead = '') {
  const el = document.createElement(onClick ? 'button' : 'div'); el.className = `toast ${kind} ${onClick ? 'clickable' : ''}`;
  el.innerHTML = `${lead || icon(ic)}<div><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div>${onClick ? `<span class="go">${icon('arrowRight', 'sm')}</span>` : ''}`;
  if (onClick) el.addEventListener('click', () => { dismiss(); onClick(); });
  $('#toasts').append(el);
  const toasts = $$('#toasts .toast:not(.out)'); if (toasts.length > 3) toasts[0].dispatchEvent(new Event('dismiss'));
  let t;
  const dismiss = () => { clearTimeout(t); el.classList.add('out'); setTimeout(() => el.remove(), 240); };
  const arm = () => { t = setTimeout(dismiss, onClick ? 5200 : 3200); };
  el.addEventListener('dismiss', dismiss);
  el.addEventListener('mouseenter', () => clearTimeout(t)); el.addEventListener('mouseleave', arm); arm();
}
// A dialog takes over the screen, so notes about what was behind it are done.
function clearToasts() { $$('#toasts .toast:not(.out)').forEach((t) => t.dispatchEvent(new Event('dismiss'))); }

const EMOJI = ['👍', '❤️', '😂', '🔥', '🎉', '😮', '😢', '🙏', '👀', '💯', '✨', '🐸', '🍿', '🎮', '☕', '🚀', '😎', '🤝', '🥲', '😅', '🤔', '👏', '💀', '✅'];
function emojiPicker(anchor, onPick, place = 'above', align = 'end', label = 'Reactions') {
  const el = openPopover(anchor, `<div class="menu-label">${label}</div><div class="emoji-grid">${EMOJI.map((e) => `<button data-emo="${e}" aria-label="${e}">${e}</button>`).join('')}</div>`, { place, align, cls: 'emoji-pop' });
  el.addEventListener('click', (e) => { const b = e.target.closest('[data-emo]'); if (b) { onPick(b.dataset.emo); closePopover(); } });
}
function react(id, e) {
  const m = findMsg(id); if (!m) return;
  let r = m.reactions.find((x) => x.e === e);
  if (!r) { r = { e, users: [] }; m.reactions.push(r); }
  if (r.users.includes('me')) r.users = r.users.filter((u) => u !== 'me'); else r.users.push('me');
  m.reactions = m.reactions.filter((x) => x.users.length);
  refreshFeed(false);
  $(`.msg[data-mid="${id}"] .reaction[data-e="${e}"]`)?.classList.add('pop');
}

const roomMuted = () => D.rooms[state.room].channels.every((c) => state.muted.has(c));
const roleOf = (id) => D.roles[id] || 'Member';
const STATUS_LABEL = { online: 'Online', idle: 'Away', dnd: 'Do not disturb', offline: 'Offline' };
const inCall = (id) => !!state.voice.channel && participants().includes(id);
const inAnyVoice = (id) => inCall(id) || Object.values(D.voiceOccupants).some((list) => list.includes(id));
function volumeHtml(id) {
  const v = state.voice.volume[id] ?? 100, muted = state.voice.localMute.has(id);
  return `<div class="pc-vol"><div class="lbl">Volume for you<span id="volValue">${muted ? 'Muted' : v + '%'}</span></div>
    <input type="range" id="volRange" min="0" max="200" step="5" value="${v}" style="--p:${v / 2}%" aria-label="Volume for ${esc(person(id).name)}">
    <div class="btns"><button class="btn sm ${muted ? 'on' : ''}" data-act="localMute" data-id="${id}" aria-pressed="${muted}">${icon(muted ? 'micOff' : 'volume', 'sm')}${muted ? 'Unmute for me' : 'Mute for me'}</button>
    <button class="btn sm ghost" data-act="resetVolume" data-id="${id}" ${v === 100 && !muted ? 'disabled' : ''}>Reset to 100%</button></div>
    <small>Only changes what you hear.</small></div>`;
}
function profileCard(anchor, id) {
  const p = person(id);
  const status = id === 'me' ? state.status : p.status;
  const where = inAnyVoice(id) ? '<span class="live">In voice</span>' : STATUS_LABEL[status] || status;
  const el = openPopover(anchor, `<div class="banner" style="--h:${p.hue}"></div><div class="pc-body">${avatar(id, 'lg', true)}<h3>${esc(p.name)}</h3><div class="pc-sub">@${p.handle} · ${where} · ${esc(roleOf(id))}</div><p>${esc(p.bio || '')}</p>
    ${id === 'me' ? `<div class="row-actions"><button class="btn sm" data-act="settings">${icon('settings', 'sm')}Edit profile</button></div>` : `<div class="row-actions"><button class="btn sm primary" data-act="openDm" data-id="${id}">${icon('message', 'sm')}Message</button><button class="btn sm" data-act="dmCall" data-id="${id}">${icon('phone', 'sm')}Call</button><button class="ibtn boxed" data-act="copyName" data-id="${id}" aria-label="Copy @${p.handle}" title="Copy @${p.handle}">${icon('copy', 'sm')}</button></div>
    <div class="pc-manage"><span class="menu-label">Manage member</span><button class="menu-item" data-act="communitySettings" data-page="members" data-focus="${id}">${icon('shield')}Community roles<span class="hint">${esc(roleOf(id))}</span></button></div>`}
    ${id !== 'me' && inCall(id) ? volumeHtml(id) : ''}</div>`, { cls: 'profile-card', place: anchor.closest?.('.msg, .cs-member') ? 'side' : 'below' });
  el.style.setProperty('--h', p.hue);
  wireVolume(el, id);
}
function wireVolume(el, id) {
  const r = $('#volRange', el); if (!r) return;
  r.addEventListener('input', () => {
    const v = Number(r.value); state.voice.volume[id] = v; state.voice.localMute.delete(id);
    r.style.setProperty('--p', v / 2 + '%'); $('#volValue', el).textContent = v + '%';
    const reset = $('[data-act="resetVolume"]', el); if (reset) reset.disabled = v === 100;
    const mute = $('[data-act="localMute"]', el); if (mute?.classList.contains('on')) { mute.classList.remove('on'); mute.setAttribute('aria-pressed', 'false'); mute.innerHTML = icon('volume', 'sm') + 'Mute for me'; }
  });
}
function refreshVolume(id) { const box = $('.popover .pc-vol'); if (!box) return; box.outerHTML = volumeHtml(id); wireVolume(popover.el, id); }

function membersPopover(anchor) {
  const ids = community().members.filter((m) => m !== 'me');
  const rank = (id) => inAnyVoice(id) ? 0 : { online: 1, idle: 2, dnd: 3, offline: 4 }[person(id).status] ?? 5;
  ids.sort((a, b) => rank(a) - rank(b) || person(a).name.localeCompare(person(b).name));
  const rows = (q) => {
    const list = ids.filter((id) => !q || person(id).name.toLowerCase().includes(q) || person(id).handle.includes(q));
    return list.length ? list.map((id) => `<button class="menu-item" data-act="memberCard" data-id="${id}">${avatar(id, 'sm', true)}<span class="t">${esc(person(id).name)}<small class="${inAnyVoice(id) ? 'live' : ''}">${inAnyVoice(id) ? 'In voice' : STATUS_LABEL[person(id).status]}</small></span></button>`).join('')
      : `<div class="mp-empty">No one called “${esc(q)}”</div>`;
  };
  const el = openPopover(anchor, `<div class="mp-head"><b>Active community members</b><input class="input sm" id="memberFind" placeholder="Find a member" autocomplete="off" aria-label="Find a member"></div><div class="mp-list" id="memberList">${rows('')}</div>`, { cls: 'members-pop', keepFocus: true });
  el.setAttribute('role', 'dialog');
  const input = $('#memberFind', el);
  input.addEventListener('input', () => { $('#memberList', el).innerHTML = rows(input.value.trim().toLowerCase()); });
  input.focus({ preventScroll: true });
}

function roomSettingsModal() {
  closePopover();
  const room = D.rooms[state.room];
  modal(`<header>${icon('settings')}<h2>Room settings</h2><button class="ibtn" data-act="closeModal" aria-label="Close">${icon('x')}</button></header>
    <div class="mbody">
      <div class="field"><label for="roomName">Name<small>Shown to everyone in ${esc(community().name)}</small></label><input class="input" id="roomName" value="${esc(room.name)}" autocomplete="off"></div>
      <div class="field top"><div class="label">Channels<small>${room.channels.length} in this room</small></div><div class="ch-list">${room.channels.map((id) => `<div class="menu-item static">${icon(typeIcon[D.channels[id].type])}${esc(D.channels[id].name)}<span class="hint">${D.channels[id].type}</span></div>`).join('')}
        <button class="menu-item" data-act="newChannel">${icon('plus')}Add a channel</button></div></div>
      <div class="field"><div class="label">Notifications<small>For every channel in this room</small></div>${toggle('room_notify', !roomMuted(), 'Room notifications')}</div>
    </div>
    <footer><button class="btn ghost" data-act="closeModal">Cancel</button><button class="btn primary" data-act="saveRoom">Save</button></footer>`, { label: 'Room settings' });
}

// ------------------------------------------------------------------ command palette
function commandItems() {
  const items = [];
  for (const c of D.communities) for (const r of c.rooms) for (const ch of D.rooms[r].channels) {
    const x = D.channels[ch];
    items.push({ kind: 'Channel', icon: typeIcon[x.type], title: x.name, sub: `${D.rooms[r].name} · ${c.name}`, run: () => go(c.id, r, ch) });
  }
  for (const d of D.dms) items.push({ kind: 'Person', person: d.with, title: person(d.with).name, sub: 'Direct message', run: () => openDm(d.id) });
  for (const p of Object.values(D.people)) if (p.id !== 'me' && !D.dms.some((d) => d.with === p.id)) items.push({ kind: 'Person', person: p.id, title: p.name, sub: `@${p.handle}`, run: () => startDm(p.id) });
  const actions = [
    ['Toggle microphone', 'mic', 'Ctrl Shift M', () => act.mute()],
    ['Toggle deafen', 'headphones', 'Ctrl Shift D', () => act.deafen()],
    ['Share your screen', 'monitorUp', '', () => act.sharePicker()],
    ['Join Voice Chat', 'phone', '', () => { go('server', 'alex-room', 'voice'); joinVoice('voice'); }],
    ['Open settings', 'settings', 'Ctrl ,', () => openSettings()],
    ['Appearance', 'palette', '', () => openSettings('appearance')],
    [currentLight() ? 'Switch to dark mode' : 'Switch to light mode', currentLight() ? 'moon' : 'sun', '', () => { state.theme.mode = currentLight() ? 'dark' : 'light'; applyTheme(true); }],
    ['Link a new device', 'phoneDevice', '', () => openSettings('devices')],
    ['Invite people', 'link', '', () => inviteModal()],
    ['Keyboard shortcuts', 'keyboard', 'Ctrl /', () => shortcutSheet()],
  ];
  for (const [title, ic, key, run] of actions) items.push({ kind: 'Action', icon: ic, title, key, run });
  for (const p of PRESETS) items.push({ kind: 'Theme', swatch: p, title: `Palette: ${p.name}`, sub: p.description, run: () => { state.theme.preset = p.id; state.theme.custom = null; state.theme.accent = null; applyTheme(true); } });
  return items;
}
const keysHtml = (k) => `<span class="k">${k.split(' ').map((x) => `<kbd>${x}</kbd>`).join('')}</span>`;
function fuzzy(q, s) {
  if (!q) return { score: 1, marks: [] };
  const a = s.toLowerCase(); let score = 0, j = 0, marks = [], streak = 0;
  for (let i = 0; i < a.length && j < q.length; i++) {
    if (a[i] === q[j]) { marks.push(i); score += 1 + streak * 2 + (i === 0 || a[i - 1] === ' ' ? 3 : 0); streak++; j++; } else streak = 0;
  }
  return j === q.length ? { score: score - a.length * 0.02, marks } : null;
}
function openPalette(initial = '') {
  closeModal(); closePopover(); clearToasts();
  const s = document.createElement('div'); s.className = 'scrim palette-scrim'; s.id = 'scrim';
  s.innerHTML = `<div class="cmdk" role="dialog" aria-modal="true" aria-label="Command palette"><div class="q">${icon('search')}<input id="cmdkInput" placeholder="${innerWidth < 560 ? 'Search or jump to…' : 'Jump to a channel, person, or action…'}" autocomplete="off" aria-label="Search" value="${esc(initial)}"><kbd>Esc</kbd></div>
    <div class="results" id="cmdkResults" role="listbox"></div><div class="foot"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>Enter</kbd> open</span><span><kbd>Esc</kbd> close</span><span class="tip">Tip: type “share”, “light” or a friend’s name</span></div></div>`;
  s.addEventListener('mousedown', (e) => { if (e.target === s) closeModal(); });
  lockBackground(s);
  document.body.append(s);
  const input = $('#cmdkInput'), results = $('#cmdkResults');
  const all = commandItems(); let shown = [], active = 0;
  const draw = () => {
    const q = input.value.trim().toLowerCase();
    shown = all.map((it) => ({ it, m: fuzzy(q, it.title) || (q.length > 2 && it.sub?.toLowerCase().includes(q) ? { score: 0.1, marks: [] } : null) })).filter((x) => x.m)
      .sort((a, b) => b.m.score - a.m.score).slice(0, 40);
    if (!q) shown = shown.filter((x) => x.it.kind !== 'Theme').slice(0, 12);
    // One heading per kind: groups follow their best match, so the top result stays first.
    const best = {}; shown.forEach(({ it, m }) => { best[it.kind] = Math.max(best[it.kind] ?? -Infinity, m.score); });
    const order = ['Channel', 'Person', 'Action', 'Theme'];
    shown.sort((a, b) => (a.it.kind === b.it.kind ? b.m.score - a.m.score : best[b.it.kind] - best[a.it.kind] || order.indexOf(a.it.kind) - order.indexOf(b.it.kind)));
    active = clamp(active, 0, Math.max(0, shown.length - 1));
    let lastKind = '';
    results.innerHTML = shown.length ? shown.map(({ it, m }, i) => {
      const title = [...it.title].map((c, k) => m.marks.includes(k) ? `<mark>${esc(c)}</mark>` : esc(c)).join('');
      const head = it.kind !== lastKind ? `<div class="menu-label">${it.kind === 'Person' ? 'People' : it.kind + 's'}</div>` : ''; lastKind = it.kind;
      const ico = it.person ? avatar(it.person, 'sm') : it.swatch ? `<span class="swatch-ico" style="background:${hex(it.swatch.dark.canvas)};border-color:${hex(it.swatch.dark.accent)}"></span>` : `<span class="ico">${icon(it.icon, 'sm')}</span>`;
      return `${head}<button class="res ${i === active ? 'active' : ''}" data-i="${i}" role="option" aria-selected="${i === active}">${ico}<span class="t"><b>${title}</b>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</span>${it.key ? keysHtml(it.key) : '<kbd class="enter" aria-hidden="true">↵</kbd>'}</button>`;
    }).join('') : `<div class="none"><b>Nothing found</b>Try a channel, a person or “settings”.</div>`;
    results.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
  };
  const run = (i) => { const x = shown[i]; if (!x) return; closeModal(); x.it.run(); };
  input.addEventListener('input', () => { active = 0; draw(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % Math.max(1, shown.length); draw(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + shown.length) % Math.max(1, shown.length); draw(); }
    else if (e.key === 'Enter') { e.preventDefault(); run(active); }
  });
  results.addEventListener('click', (e) => { const b = e.target.closest('.res'); if (b) run(Number(b.dataset.i)); });
  results.addEventListener('mousemove', (e) => { const b = e.target.closest('.res'); if (b && Number(b.dataset.i) !== active) { active = Number(b.dataset.i); $$('.res', results).forEach((r) => r.classList.toggle('active', r === b)); } });
  draw(); input.focus();
}

// ------------------------------------------------------------------ settings
const SETTINGS_PAGES = [
  ['appearance', 'Appearance', 'palette'], ['voice', 'Voice & video', 'mic'], ['share', 'Screen share', 'monitor'],
  ['notifications', 'Notifications', 'bell'], ['keybinds', 'Keybinds', 'keyboard'], ['devices', 'Devices & privacy', 'shield'], ['about', 'About', 'info'],
];
function openSettings(page) {
  if (page) state.settingsPage = page;
  closePopover();
  modal(`<header>${icon('settings')}<h2>Settings</h2><button class="ibtn" data-act="closeModal" aria-label="Close">${icon('x')}</button></header>
    <div class="split"><nav aria-label="Settings sections">${SETTINGS_PAGES.map(([id, name, ic]) => `<button data-act="settingsPage" data-id="${id}" aria-current="${state.settingsPage === id}">${icon(ic)}${name}</button>`).join('')}</nav>
    <div class="pane" id="pane">${settingsPane()}</div></div>`, { cls: 'settings', label: 'Settings' });
  wirePane();
}
function seg(name, value, options) {
  return `<div class="seg" role="group">${options.map(([v, label, ic]) => `<button data-act="set" data-k="${name}" data-v="${v}" aria-pressed="${value === v}">${ic ? icon(ic, 'sm') : ''}${label}</button>`).join('')}</div>`;
}
const toggle = (k, on, label) => `<button class="toggle" role="switch" aria-checked="${on}" aria-label="${esc(label)}" data-act="toggle" data-k="${k}"></button>`;
function settingsPane() {
  const t = state.theme;
  switch (state.settingsPage) {
    case 'appearance': return `<h3>Appearance</h3><p class="lede">Palettes are the same families the Windows client uses — pick one here and it matches everywhere.</p>
      <div class="field"><div class="label">Mode<small>Follow Windows or pick one</small></div>${seg('mode', t.mode, [['dark', 'Dark', 'moon'], ['light', 'Light', 'sun'], ['system', 'Match system', 'laptop']])}</div>
      <div class="field top"><div class="label">Palette<small>Surfaces and highlight together</small></div><div class="palettes">${PRESETS.map((p) => {
        const r = currentLight() ? p.light : p.dark; const on = t.preset === p.id && t.custom == null;
        return `<button class="pal" data-act="palette" data-id="${p.id}" aria-pressed="${on}" title="${esc(p.description)}"><div class="mini" style="background:${hex(r.canvas)}"><div class="s" style="background:${hex(r.chrome)}"><i style="background:${hex(r.selected)}"></i><i style="background:${hex(r.hover)}"></i><i style="background:${hex(r.hover)}"></i></div>
          <div class="c"><i style="width:60%;background:${hex(r.text)}"></i><i style="width:85%;background:${hex(r.muted)}"></i><i style="width:40%;background:${hex(r.accent)}"></i><i style="width:70%;background:${hex(r.muted)}"></i></div></div>
          <div class="cap"><span class="sw" style="background:${hex(r.accent)}"></span>${p.name}</div></button>`;
      }).join('')}</div></div>
      <div class="field"><div class="label">Custom colours<small>Surfaces are generated in OKLab like the client</small></div><div class="custom-color">
        <label>Surfaces <input type="color" id="customSurface" value="${hex(t.custom ?? 0x3a4a7a)}"></label>
        <label>Highlight <input type="color" id="customAccent" value="${hex(t.accent ?? buildPalette({ preset: t.preset, light: currentLight() }).accent)}"></label>
        ${t.custom != null || t.accent != null ? `<button class="btn sm ghost" data-act="resetColours">${icon('refresh', 'sm')}Reset</button>` : ''}</div></div>
      <div class="field"><div class="label">Reading size<small>Message text only</small></div><div class="slider"><input type="range" id="reading" min="13" max="20" step=".5" value="${t.reading}" aria-label="Reading size"><span id="readingValue">${t.reading}px</span></div></div>
      <div class="field"><div class="label">Message density</div>${seg('density', t.density, [['cozy', 'Cozy'], ['compact', 'Compact']])}</div>
      <div class="field"><div class="label">Motion<small>Reduce animations everywhere</small></div>${seg('motion', t.motion, [['system', 'Match system'], ['reduce', 'Reduced']])}</div>
      <div class="preview-chat"><article class="msg">${avatar('alex', 'md')}<header><b>Alex</b><time>20:14</time></header><div class="text">This is how messages will look. <span class="mention-chip">@adam</span> the new palette is <strong>clean</strong>.</div>
        <div class="reactions"><span class="reaction mine">🔥 3</span><span class="reaction">😍 1</span></div></article></div>`;
    case 'voice': return `<h3>Voice & video</h3><p class="lede">Your browser asks before Krypt can hear your microphone. Nothing is recorded.</p>
      <div class="field"><div class="label">Microphone</div><select class="select"><option>Default — Shure MV7</option><option>Headset microphone</option><option>Webcam microphone</option></select></div>
      <div class="field"><div class="label">Speakers</div><select class="select"><option>Default — Speakers (Realtek)</option><option>Headphones</option></select></div>
      <div class="field"><div class="label">Mic test<small>Speak to see your level</small></div><div class="mic-test"><button class="btn" data-act="micTest" id="micTestBtn">${icon('wave', 'sm')}Start test</button><div class="meter"><i id="micLevel"></i></div></div></div>
      <div class="field"><div class="label">Noise suppression<small>Removes keyboard and fan noise</small></div>${toggle('noise', true, 'Noise suppression')}</div>
      <div class="field"><div class="label">Push to talk<small>Hold <kbd>V</kbd> to talk</small></div>${toggle('ptt', false, 'Push to talk')}</div>`;
    case 'share': return `<h3>Screen share</h3><p class="lede">Krypt shares at full speed — no quiet slow-downs when nobody’s looking.</p>
      <div class="field"><div class="label">Default quality</div>${seg('quality', state.share.quality, [['smooth', '1080p · 60 fps'], ['crisp', '1440p · 60 fps'], ['balanced', '720p · 30 fps']])}</div>
      <div class="field"><div class="label">Codec<small>Automatic picks what your GPU does best</small></div>${seg('codec', state.share.codec, [['auto', 'Automatic'], ['h264', 'H.264'], ['vp9', 'VP9'], ['av1', 'AV1'], ['vp8', 'VP8']])}</div>
      <div class="field"><div class="label">Stream stats overlay<small>Frame rate, bitrate and latency on every share</small></div>${toggle('hud', state.share.hud, 'Stream stats overlay')}</div>
      <div class="field"><div class="label">Share audio<small>When the browser allows it</small></div>${toggle('shareAudio', true, 'Share audio')}</div>`;
    case 'notifications': return `<h3>Notifications</h3><p class="lede">Choose what reaches you when you’re somewhere else.</p>
      ${[['mentions', 'Mentions', 'When someone writes @adam'], ['dms', 'Direct messages', 'Every new DM'], ['sounds', 'Sounds', 'Join, leave and message sounds'], ['desktop', 'Browser notifications', 'Pop-ups while this tab is in the background']].map(([k, l, s]) => `<div class="field"><div class="label">${l}<small>${s}</small></div>${toggle('n_' + k, state.notify[k], l)}</div>`).join('')}`;
    case 'keybinds': return `<h3>Keybinds</h3><p class="lede">Everything important is one shortcut away. Press <kbd>Ctrl</kbd> <kbd>/</kbd> anywhere to see this list.</p><div class="keys">${SHORTCUTS.map(([k, d]) => `<div><span>${d}</span>${keysHtml(k)}</div>`).join('')}</div>`;
    case 'devices': return `<h3>Devices & privacy</h3><p class="lede">Your account lives on your devices. Each one has its own key, and you can remove any of them.</p>
      <div class="devices">${D.devices.map((d) => `<div class="device"><span class="ico">${icon(d.icon)}</span><div class="t"><b>${esc(d.name)}</b><small>${esc(d.detail)} · ${d.seen}</small></div>${d.current ? '<span class="pillnote">This device</span>' : `<button class="btn sm danger" data-act="revoke" data-id="${d.id}">Remove</button>`}</div>`).join('')}</div>
      <div class="link-qr">${linkGrid('adam-link')}<div><h4>Link a new device</h4><p>Open Krypt on the other device, choose <b>Link to an existing account</b> and scan this code. Your history transfers encrypted, directly between devices.</p><button class="btn sm" data-act="toastCopy">${icon('copy', 'sm')}Copy link code</button></div></div>
      <div class="field gap-top"><div class="label">Recovery code<small>Gets your account back if you lose every device</small></div><div class="recovery-row"><code class="recovery" id="recovery">KRPT-7F3Q-M2XA-99LD-ZE4C</code><button class="btn sm" data-act="reveal" id="revealBtn">${icon('eye', 'sm')}Reveal</button></div></div>`;
    case 'about': return `<div class="about">${brandMark(80, true)}<h3>Krypt Web</h3><p class="ver">Version ${VERSION} · design preview</p>
      <p class="blurb">Private chat, voice and screen sharing between friends. Messages and calls are end-to-end encrypted; the server only ever sees scrambled data.</p>
      <div class="actions"><a class="btn" href="join.html">${icon('link', 'sm')}Preview the invite page</a><button class="btn" data-act="shortcuts">${icon('keyboard', 'sm')}Shortcuts</button></div></div>`;
  }
  return '';
}
function wirePane() {
  const pane = $('#pane'); if (!pane) return;
  const reading = $('#reading', pane);
  if (reading) {
    const paint = () => reading.style.setProperty('--p', `${((reading.value - 13) / 7) * 100}%`);
    paint(); reading.addEventListener('input', () => { state.theme.reading = Number(reading.value); $('#readingValue').textContent = reading.value + 'px'; paint(); applyTheme(); });
  }
  $('#customSurface', pane)?.addEventListener('input', (e) => { state.theme.custom = parseHex(e.target.value); applyTheme(); });
  $('#customAccent', pane)?.addEventListener('input', (e) => { state.theme.accent = parseHex(e.target.value); applyTheme(); });
  $('#customSurface', pane)?.addEventListener('change', rerenderPane);
  $('#customAccent', pane)?.addEventListener('change', rerenderPane);
}
function rerenderPane() {
  const pane = $('#pane'); if (!pane) return;
  const scroll = pane.scrollTop; pane.innerHTML = settingsPane(); pane.scrollTop = scroll; wirePane();
  $$('.settings nav button').forEach((b) => b.setAttribute('aria-current', b.dataset.id === state.settingsPage));
}

let micStream = null, micRaf = 0;
async function micTest() {
  if (micStream) { micStop(); return; }
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ctx = new AudioContext(); const src = ctx.createMediaStreamSource(micStream); const an = ctx.createAnalyser(); an.fftSize = 512; src.connect(an);
    const buf = new Uint8Array(an.fftSize);
    const loop = () => { an.getByteTimeDomainData(buf); let peak = 0; for (const v of buf) peak = Math.max(peak, Math.abs(v - 128)); const el = $('#micLevel'); if (el) el.style.width = Math.min(100, peak * 1.6) + '%'; micRaf = requestAnimationFrame(loop); };
    loop(); const b = $('#micTestBtn'); if (b) b.innerHTML = icon('x', 'sm') + 'Stop test';
    micStream.ctx = ctx;
  } catch { toast('Microphone unavailable', 'The browser didn’t allow access — check the address bar', 'micOff', 'warn'); }
}
function micStop() { cancelAnimationFrame(micRaf); if (micStream) { micStream.getTracks().forEach((t) => t.stop()); micStream.ctx?.close(); micStream = null; } }

// ------------------------------------------------------------------ other dialogs
function sharePicker() {
  if (!state.voice.channel) { toast('Join voice first', 'Screen shares go to the voice channel you’re in', 'info', 'warn'); return; }
  let chosen = D.shareSources[0].id;
  const s = modal(`<header>${icon('monitorUp')}<h2>Share your screen</h2><button class="ibtn" data-act="closeModal" aria-label="Close">${icon('x')}</button></header>
    <div class="mbody"><div class="sources">${D.shareSources.map((x, i) => `<button class="source" data-src="${x.id}" aria-pressed="${i === 0}"><img src="${x.img}" alt=""><div><b>${icon(x.kind === 'screen' ? 'monitor' : 'appWindow', 'sm')}${esc(x.name)}</b><small>${esc(x.detail)}</small></div></button>`).join('')}</div>
    <div class="quality"><span class="label">Quality</span>${seg('quality', state.share.quality, [['smooth', '1080p · 60'], ['crisp', '1440p · 60'], ['balanced', '720p · 30']])}<span class="grow"></span><span class="note">${icon('lock', 'xs')}Encrypted end to end</span></div></div>
    <footer><button class="btn ghost" data-act="closeModal">Cancel</button><button class="btn primary" id="goShare">${icon('monitorUp', 'sm')}Go live</button></footer>`, { cls: 'share-picker', label: 'Share your screen' });
  s.addEventListener('click', (e) => {
    const b = e.target.closest('[data-src]');
    if (b) { chosen = b.dataset.src; $$('.source', s).forEach((x) => x.setAttribute('aria-pressed', x === b)); }
    if (e.target.closest('#goShare')) {
      state.voice.sharing = chosen; closeModal();
      toast('You’re live', `${D.shareSources.find((x) => x.id === chosen).name} · ${state.share.quality === 'crisp' ? '1440p60' : state.share.quality === 'balanced' ? '720p30' : '1080p60'}`, 'monitorUp', 'ok');
      renderVoicebar(); if (state.channel === state.voice.channel) renderMain();
    }
  });
}
function inviteModal() {
  closePopover();
  const code = `${community().id}-${Math.random().toString(36).slice(2, 10)}`;
  const link = `https://krypt.example/join#${code}`;
  modal(`<header>${icon('link')}<h2>Invite people to ${esc(community().name)}</h2><button class="ibtn" data-act="closeModal" aria-label="Close">${icon('x')}</button></header>
    <div class="mbody"><p class="lede-sm">Anyone with this link can join. The secret after the <code>#</code> never reaches the server’s logs.</p>
    <div class="invite-row"><input class="input" id="inviteLink" readonly value="${link}" aria-label="Invite link" onfocus="this.select()"><button class="btn primary" data-act="copyNewInvite" data-id="${code}">${icon('copy', 'sm')}Copy</button></div>
    <div class="inline-field"><div class="label">Link expires</div>${seg('expire', '7d', [['1d', '1 day'], ['7d', '7 days'], ['never', 'Never']])}</div>
    <p class="invite-note" id="inviteNote">Expires in 7 days. See what they’ll see: <a href="join.html#${code}">open the invite page</a></p></div>`, { label: 'Invite people' });
}
// ------------------------------------------------------------------ community settings
const CS_PAGES = [['overview', 'Overview', 'globe'], ['members', 'Members', 'users'], ['roles', 'Roles', 'shield'], ['invites', 'Invites', 'link'], ['danger', 'Leave or delete', 'alert']];
const PERMS = [['rooms', 'Create and edit rooms'], ['invite', 'Invite people'], ['pin', 'Pin messages'], ['share', 'Share their screen'], ['remove', 'Remove members']];
const csState = { page: 'overview', focus: null, q: '' };
function communitySettings(page, focus) {
  closePopover();
  csState.page = page || 'overview'; csState.focus = focus || null; csState.q = '';
  const c = community();
  modal(`<header><span class="cs-tile">${communityTile(c.id + 'cs', c.hue)}</span><h2>${esc(c.name)} <small>Community settings</small></h2><button class="ibtn" data-act="closeModal" aria-label="Close">${icon('x')}</button></header>
    <div class="split"><nav aria-label="Community settings sections">${CS_PAGES.map(([id, name, ic]) => `<button data-act="csPage" data-id="${id}" aria-current="${csState.page === id}" class="${id === 'danger' ? 'danger' : ''}">${icon(ic)}${name}</button>`).join('')}</nav>
    <div class="pane" id="csPane"></div></div>`, { cls: 'settings community-settings', label: 'Community settings' });
  renderCsPane();
}
function renderCsPane() {
  const pane = $('#csPane'); if (!pane) return;
  $$('.community-settings nav button').forEach((b) => b.setAttribute('aria-current', b.dataset.id === csState.page));
  const c = community();
  const members = c.members;
  switch (csState.page) {
    case 'overview': pane.innerHTML = `<h3>Overview</h3><p class="lede">How ${esc(c.name)} appears to members and to people you invite.</p>
      <div class="field"><label for="csName">Name<small>Up to 32 characters</small></label><input class="input" id="csName" maxlength="32" value="${esc(c.name)}" autocomplete="off"></div>
      <div class="field"><div class="label">Icon<small>A landscape tinted with your colour</small></div><div class="cs-icon"><span class="cs-tile lg" id="csTilePreview">${communityTile(c.id + 'cs', c.hue)}</span>
        <input type="range" class="hue" id="csHue" min="0" max="359" value="${c.hue}" aria-label="Icon colour"></div></div>
      <div class="field top"><label for="csAbout">Description<small>Shown on the invite page</small></label><textarea class="input" id="csAbout" rows="3" maxlength="200" placeholder="What’s this community for?">${esc(c.about || '')}</textarea></div>
      <div class="field"><div class="label">Members<small>People in ${esc(c.name)}</small></div><div class="cs-stat"><b>${members.length}</b> members · <b>${c.rooms.length}</b> rooms · <b>${members.filter((m) => m !== 'me' && person(m).status !== 'offline').length}</b> online now</div></div>`;
      wireOverview(); break;
    case 'members': {
      const q = csState.q.toLowerCase();
      const list = members.filter((m) => !q || person(m).name.toLowerCase().includes(q) || person(m).handle.includes(q));
      pane.innerHTML = `<h3>Members</h3><p class="lede">Roles decide what each person can do. Only owners can change another owner.</p>
        <input class="input" id="csFind" placeholder="Find a member" value="${esc(csState.q)}" autocomplete="off" aria-label="Find a member">
        <div class="cs-members">${list.map((m) => `<div class="cs-member ${csState.focus === m ? 'focus' : ''}" data-member="${m}">${avatar(m, 'sm', true)}<div class="t"><b>${esc(person(m).name)}${m === 'me' ? ' <span class="you">You</span>' : ''}</b><small>@${person(m).handle} · ${STATUS_LABEL[m === 'me' ? state.status : person(m).status]}</small></div>
          ${roleOf(m) === 'Owner' ? `<span class="role-chip owner">${icon('crown', 'xs')}Owner</span>` : `<select class="select sm" data-role="${m}" aria-label="Role for ${esc(person(m).name)}">${['Admin', 'Member', 'Guest'].map((r) => `<option ${roleOf(m) === r ? 'selected' : ''}>${r}</option>`).join('')}</select>`}</div>`).join('') || `<div class="mp-empty">No one called “${esc(csState.q)}”</div>`}</div>`;
      const f = $('#csFind', pane);
      f.addEventListener('input', () => { csState.q = f.value; csState.focus = null; renderCsPane(); const n = $('#csFind'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); });
      $$('select[data-role]', pane).forEach((sel) => sel.addEventListener('change', () => { D.roles[sel.dataset.role] = sel.value; toast('Role updated', `${person(sel.dataset.role).name} is now ${sel.value === 'Admin' ? 'an' : 'a'} ${sel.value}`, 'shield', 'ok'); }));
      if (csState.focus) setTimeout(() => $(`.cs-member[data-member="${csState.focus}"]`, pane)?.scrollIntoView({ block: 'center' }), 60);
      break;
    }
    case 'roles': pane.innerHTML = `<h3>Roles</h3><p class="lede">What each role can do in ${esc(c.name)}. Owners can always do everything.</p>
      <div class="role-grid"><div class="rg-head"><span></span>${['Admin', 'Member', 'Guest'].map((r) => `<b>${r}<small>${members.filter((m) => roleOf(m) === r).length}</small></b>`).join('')}</div>
      ${PERMS.map(([k, label]) => `<div class="rg-row"><span>${label}</span>${['Admin', 'Member', 'Guest'].map((r) => `<span>${toggle(`perm:${r}:${k}`, D.rolePerms[r].includes(k), `${r}: ${label}`)}</span>`).join('')}</div>`).join('')}</div>`; break;
    case 'invites': {
      const inv = D.invites.filter((i) => i.community === c.id);
      pane.innerHTML = `<h3>Invites</h3><p class="lede">Anyone with an active link can join. Revoking a link stops it working immediately.</p>
        <div class="cs-invites">${inv.map((i) => `<div class="cs-invite"><span class="ico">${icon('link', 'sm')}</span><div class="t"><code>krypt.example/join#${esc(i.id)}</code><small>Made by ${esc(person(i.by).name)} · ${i.uses} ${i.uses === 1 ? 'use' : 'uses'} · expires ${esc(i.expires)}</small></div>
          <button class="btn sm" data-act="copyInvite" data-id="${esc(i.id)}">${icon('copy', 'sm')}Copy</button><button class="btn sm danger" data-act="revokeInvite" data-id="${esc(i.id)}">Revoke</button></div>`).join('') || `<div class="cs-none">${icon('link')}<b>No active invites</b><span>Make one to bring people in.</span></div>`}</div>
        <div class="pane-actions"><button class="btn primary" data-act="invite">${icon('plus', 'sm')}New invite link</button></div>`; break;
    }
    case 'danger': {
      const owner = roleOf('me') === 'Owner';
      pane.innerHTML = `<h3>Leave or delete</h3><p class="lede">These can’t be undone from here.</p>
        <div class="danger-card"><div><b>Leave ${esc(c.name)}</b><small>${owner ? 'You own this community. Make someone else an owner before you leave.' : 'You’ll need a new invite to come back.'}</small></div><button class="btn danger" data-act="leaveCommunity" ${owner ? 'disabled' : ''}>Leave</button></div>
        <div class="danger-card"><div><b>Delete ${esc(c.name)}</b><small>Removes every room, message and file for everyone. Type <b>${esc(c.name)}</b> to confirm.</small><input class="input sm" id="csDeleteName" placeholder="Type ${esc(c.name)}" autocomplete="off" aria-label="Type the community name to confirm"></div><button class="btn danger" id="csDelete" data-act="deleteCommunity" disabled>Delete</button></div>`;
      const inp = $('#csDeleteName', pane);
      inp.addEventListener('input', () => { $('#csDelete').disabled = inp.value.trim() !== c.name; });
      break;
    }
  }
  pane.scrollTop = 0;
}
function wireOverview() {
  const c = community();
  $('#csName').addEventListener('input', (e) => { const v = e.target.value.trim(); if (!v) return; c.name = v; renderCommunity(); $('.community-settings > header h2').firstChild.textContent = v + ' '; });
  $('#csName').addEventListener('change', () => toast('Name saved', c.name, 'checkCircle', 'ok'));
  $('#csAbout').addEventListener('input', (e) => { c.about = e.target.value; });
  const hue = $('#csHue');
  hue.addEventListener('input', () => {
    c.hue = Number(hue.value);
    $('#csTilePreview').innerHTML = communityTile(c.id + 'cs', c.hue); $('.community-settings .cs-tile').innerHTML = communityTile(c.id + 'cs', c.hue);
    renderCommunity();
  });
}

function newRoomModal() {
  closePopover();
  const templates = [['hangout', 'Hangout', 'Chat and a voice channel', ['text', 'voice']], ['plan', 'Planning', 'Chat, calendar and tasks', ['text', 'calendar', 'tasks']], ['blank', 'Just chat', 'One text channel', ['text']]];
  modal(`<header>${icon('plus')}<h2>Create a room</h2><button class="ibtn" data-act="closeModal" aria-label="Close">${icon('x')}</button></header>
    <div class="mbody"><label class="stack-label" for="roomNew">Room name</label><input class="input" id="roomNew" placeholder="e.g. Movie night" maxlength="40" autocomplete="off">
    <div class="stack-label gap-top">Start with</div><div class="templates">${templates.map(([id, n, d, chs], i) => `<button class="pal tpl" data-tpl="${id}" aria-pressed="${i === 0}"><span class="tpl-icons">${chs.map((t) => icon(typeIcon[t], 'sm')).join('')}</span><b>${n}</b><small>${d}</small></button>`).join('')}</div></div>
    <footer><button class="btn ghost" data-act="closeModal">Cancel</button><button class="btn primary" id="mkRoom">Create room</button></footer>`, { label: 'Create a room' });
  let tpl = 'hangout';
  const s = $('#scrim');
  const create = () => {
    const input = $('#roomNew'); const name = input.value.trim();
    if (!name) { input.focus(); input.classList.add('invalid'); input.placeholder = 'Give the room a name'; return; }
    const id = 'r' + Date.now(); const chans = templates.find((t) => t[0] === tpl)[3];
    D.rooms[id] = { name, owner: 'me', channels: [] };
    chans.forEach((type, i) => { const ch = `${id}-${i}`; D.channels[ch] = { type, name: type === 'text' ? 'general' : type === 'voice' ? 'Voice' : type === 'calendar' ? 'Calendar' : 'Tasks', topic: '' }; D.messages[ch] = []; if (type === 'voice') D.voiceOccupants[ch] = []; D.rooms[id].channels.push(ch); });
    community().rooms.push(id); closeModal(); go(state.community, id, D.rooms[id].channels[0]); toast('Room created', name, 'plus', 'ok');
  };
  s.addEventListener('click', (e) => { const b = e.target.closest('[data-tpl]'); if (b) { tpl = b.dataset.tpl; $$('[data-tpl]', s).forEach((x) => x.setAttribute('aria-pressed', x === b)); } if (e.target.closest('#mkRoom')) create(); });
  $('#roomNew').addEventListener('keydown', (e) => { if (e.key === 'Enter') create(); });
  $('#roomNew').addEventListener('input', (e) => e.target.classList.remove('invalid'));
}

function joinCreateModal(mode = 'create') {
  closePopover();
  const hues = [96, 150, 190, 215, 265, 320, 12, 36];
  let hue = hues[0];
  modal(`<header>${icon('users')}<h2>Join or create a community</h2><button class="ibtn" data-act="closeModal" aria-label="Close">${icon('x')}</button></header>
    <div class="mbody"><div class="seg jc-seg" role="tablist"><button data-jc="create" aria-pressed="${mode === 'create'}">${icon('plus', 'sm')}Create</button><button data-jc="join" aria-pressed="${mode === 'join'}">${icon('link', 'sm')}Join with a link</button></div>
    <div class="jc-pane" data-pane="create" ${mode === 'create' ? '' : 'hidden'}><div class="jc-preview"><span class="cs-tile lg" id="jcTile">${communityTile('new-community', hue)}</span><div><label class="stack-label" for="jcName">Community name</label><input class="input" id="jcName" placeholder="e.g. Saturday league" maxlength="32" autocomplete="off"></div></div>
      <div class="stack-label gap-top">Colour</div><div class="swatches">${hues.map((h, i) => `<button class="swatch" data-hue="${h}" aria-pressed="${i === 0}" aria-label="Colour ${i + 1}" style="--sw:hsl(${h} 55% 50%)"></button>`).join('')}</div></div>
    <div class="jc-pane" data-pane="join" ${mode === 'join' ? '' : 'hidden'}><label class="stack-label" for="jcLink">Invite link</label><input class="input" id="jcLink" placeholder="krypt.example/join#…" autocomplete="off"><p class="jc-note" id="jcNote">Paste the link someone sent you. <a href="join.html#${community().id}-preview">See what an invite looks like</a></p></div></div>
    <footer><button class="btn ghost" data-act="closeModal">Cancel</button><button class="btn primary" id="jcGo">${mode === 'create' ? 'Create community' : 'Join'}</button></footer>`, { label: 'Join or create a community' });
  const s = $('#scrim'); let current = mode;
  const setMode = (m) => { current = m; $$('[data-jc]', s).forEach((b) => b.setAttribute('aria-pressed', b.dataset.jc === m)); $$('.jc-pane', s).forEach((p) => { p.hidden = p.dataset.pane !== m; }); $('#jcGo').textContent = m === 'create' ? 'Create community' : 'Join'; $(m === 'create' ? '#jcName' : '#jcLink').focus(); };
  const go_ = () => {
    if (current === 'create') {
      const input = $('#jcName'); const name = input.value.trim();
      if (!name) { input.classList.add('invalid'); input.focus(); return; }
      const id = 'c' + Date.now(), room = id + '-room', ch = id + '-general';
      D.rooms[room] = { name: 'Lobby', owner: 'me', channels: [ch] }; D.channels[ch] = { type: 'text', name: 'general', topic: `Welcome to ${name}` }; D.messages[ch] = [];
      D.communities.push({ id, name, hue, members: ['me'], rooms: [room] }); D.roles.me = 'Owner';
      closeModal(); go(id, room, ch); toast('Community created', `Invite people from the ${name} menu`, 'checkCircle', 'ok');
    } else {
      const v = $('#jcLink').value.trim(); const m = v.match(/join#([a-z0-9]+)-/i); const c = m && D.communities.find((x) => x.id === m[1]);
      const note = $('#jcNote');
      if (!c) { $('#jcLink').classList.add('invalid'); note.classList.add('error'); note.textContent = 'That isn’t a Krypt invite link. It should look like krypt.example/join#name-code.'; return; }
      closeModal(); go(c.id, c.rooms[0]); toast(`You’re already in ${c.name}`, 'Took you there instead', 'users');
    }
  };
  s.addEventListener('click', (e) => {
    const t = e.target.closest('[data-jc]'); if (t) setMode(t.dataset.jc);
    const sw = e.target.closest('[data-hue]'); if (sw) { hue = Number(sw.dataset.hue); $$('[data-hue]', s).forEach((x) => x.setAttribute('aria-pressed', x === sw)); $('#jcTile').innerHTML = communityTile('new-community', hue); }
    if (e.target.closest('#jcGo')) go_();
  });
  $$('#jcName, #jcLink', s).forEach((i) => { i.addEventListener('keydown', (e) => { if (e.key === 'Enter') go_(); }); i.addEventListener('input', () => { i.classList.remove('invalid'); $('#jcNote')?.classList.remove('error'); }); });
  setTimeout(() => $(mode === 'create' ? '#jcName' : '#jcLink')?.focus(), 40);
}

const SHORTCUTS = [
  ['Ctrl K', 'Search and jump anywhere'], ['Ctrl ,', 'Open settings'], ['Ctrl Shift M', 'Mute or unmute'], ['Ctrl Shift D', 'Deafen'],
  ['Alt ↑', 'Previous channel'], ['Alt ↓', 'Next channel'], ['Ctrl F', 'Search this conversation'], ['/', 'Focus the message box'],
  ['↑', 'Edit your last message'], ['Ctrl Shift L', 'Switch light or dark'], ['Esc', 'Close or cancel'], ['Ctrl /', 'Show shortcuts'],
];
function shortcutSheet() {
  modal(`<header>${icon('keyboard')}<h2>Keyboard shortcuts</h2><button class="ibtn" data-act="closeModal" aria-label="Close">${icon('x')}</button></header>
    <div class="mbody"><div class="sheet-grid">${SHORTCUTS.map(([k, d]) => `<div><span>${d}</span>${keysHtml(k)}</div>`).join('')}</div></div>`, { cls: 'sheet', label: 'Keyboard shortcuts' });
}
// Full-window viewer for images and screen shares. A click anywhere or Esc closes it.
let lightboxReturn = null;
function lightbox(html, { cls = '', title = '', sub = '', download = '', share = false } = {}) {
  closeLightbox(); closePopover();
  const el = document.createElement('div'); el.className = `lightbox ${cls}`; el.id = 'lightbox';
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', share ? 'Screen share, full screen' : 'Image viewer');
  el.innerHTML = `<div class="lb-bar"><div class="lb-title"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</div>
    ${download ? `<button class="ibtn" data-lb="download" aria-label="Download ${esc(download)}" title="Download">${icon('download')}</button>` : ''}
    ${share ? `<button class="btn sm lb-exit" data-lb="close">${icon('shrink', 'sm')}Exit full screen<kbd>Esc</kbd></button>` : `<button class="ibtn" data-lb="close" aria-label="Close" title="Close (Esc)">${icon('x')}</button>`}</div>${html}`;
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-lb="download"]')) { e.stopPropagation(); toast('Saved to Downloads', download, 'download', 'ok'); return; }
    closeLightbox();
  });
  // Over a screen share the bar steps aside when the mouse rests.
  if (share) { let t; const wake = () => { el.classList.remove('idle'); clearTimeout(t); t = setTimeout(() => el.isConnected && el.classList.add('idle'), 2400); }; el.addEventListener('pointermove', wake); wake(); }
  lightboxReturn = document.activeElement;
  $('#app')?.setAttribute('inert', '');
  document.body.append(el);
  $('[data-lb="close"]', el).focus({ preventScroll: true });
}
function closeLightbox() {
  const el = $('#lightbox'); if (!el) return;
  el.removeAttribute('id'); el.classList.add('closing');
  if (!$('#scrim')) $('#app')?.removeAttribute('inert');
  const back = lightboxReturn; lightboxReturn = null;
  if (back?.isConnected) back.focus({ preventScroll: true });
  setTimeout(() => el.remove(), reduceMotion() ? 0 : 180);
}

// ------------------------------------------------------------------ navigation
function go(communityId, roomId, channelId) {
  const changedCommunity = communityId !== state.community;
  state.community = communityId; state.room = roomId; state.dm = null;
  state.channel = channelId || state.lastChannel[roomId] || D.rooms[roomId].channels[0];
  state.lastChannel[roomId] = state.channel;
  state.unread[state.channel] = 0; state.replyTo = null; state.editing = null; state.searchOpen = false; state.search = ''; state.pending = [];
  state.drawer = false;
  if (changedCommunity) { renderTitle(); renderCommunity(); }
  renderSide(); renderTabs(); renderMain();
  if (state.voice.channel) renderVoicebar();
}
function openDm(id) {
  state.dm = id; state.unread[id] = 0; state.replyTo = null; state.editing = null; state.searchOpen = false; state.search = ''; state.drawer = false;
  renderSide(); renderTabs(); renderMain();
  if (state.voice.channel) renderVoicebar();
}
function startDm(personId) {
  let d = D.dms.find((x) => x.with === personId);
  if (!d) { d = { id: 'dm-' + personId, with: personId, unread: 0 }; D.dms.unshift(d); D.messages[d.id] = []; }
  openDm(d.id);
}
function stepChannel(dir) {
  if (state.dm) return;
  const list = D.rooms[state.room].channels; const i = list.indexOf(state.channel);
  go(state.community, state.room, list[(i + dir + list.length) % list.length]);
}

// ------------------------------------------------------------------ actions (event delegation)
const act = {
  drawer() { state.drawer = !state.drawer; $('#app').classList.toggle('drawer', state.drawer); $('.drawer-scrim')?.remove(); if (state.drawer) { const s = document.createElement('div'); s.className = 'drawer-scrim'; s.onclick = () => act.drawer(); document.body.append(s); } },
  room(el) { go(state.community, el.dataset.id); $('.drawer-scrim')?.remove(); },
  dm(el) { openDm(el.dataset.id); $('.drawer-scrim')?.remove(); },
  channel(el) { go(state.community, state.room, el.dataset.id); },
  communityMenu(el) {
    openPopover(el, `<div class="menu-label">Communities</div>${D.communities.map((c) => `<button class="menu-item ${c.id === state.community ? 'checked' : ''}" data-act="switchCommunity" data-id="${c.id}"><span class="mtile">${communityTile(c.id + 'm', c.hue)}</span>${esc(c.name)}<span class="hint">${c.members.length} members</span></button>`).join('')}
      <div class="menu-sep"></div><button class="menu-item" data-act="invite">${icon('link')}Invite people</button><button class="menu-item" data-act="joinCommunity">${icon('plus')}Join or create a community</button><button class="menu-item" data-act="communitySettings">${icon('settings')}Community settings</button>`, { cls: '' }).style.minWidth = el.offsetWidth - 16 + 'px';
  },
  switchCommunity(el) { closePopover(); const c = D.communities.find((x) => x.id === el.dataset.id); go(c.id, c.rooms[0]); toast(`Switched to ${c.name}`, '', 'users'); },
  invite() { closePopover(); inviteModal(); },
  joinCommunity() { joinCreateModal(); },
  communitySettings(el) { communitySettings(el?.dataset?.page, el?.dataset?.focus); },
  csPage(el) { csState.page = el.dataset.id; renderCsPane(); },
  channelMenu(el) {
    openPopover(el, `<div class="menu-label">${esc(D.rooms[state.room].name)}</div>${D.rooms[state.room].channels.map((id) => `<button class="menu-item ${id === state.channel ? 'checked' : ''}" data-act="channel" data-id="${id}">${icon(typeIcon[D.channels[id].type])}${esc(D.channels[id].name)}</button>`).join('')}<div class="menu-sep"></div><button class="menu-item" data-act="newChannel">${icon('plus')}Add a channel</button>`, { align: 'end' });
  },
  newChannel() {
    closePopover();
    const types = { text: ['Text', 'Messages, files and links', 'clips'], voice: ['Voice', 'Talk, and share your screen at full speed', 'Lounge'], calendar: ['Calendar', 'Events everyone in the room can see and join', 'Game nights'], docs: ['Document', 'One page the whole room can edit live', 'House rules'], tasks: ['Tasks', 'A board of to-dos you drag between columns', 'Road trip'] };
    modal(`<header>${icon('plus')}<h2>Add a channel to ${esc(D.rooms[state.room].name)}</h2><button class="ibtn" data-act="closeModal" aria-label="Close">${icon('x')}</button></header>
      <div class="mbody"><div class="stack-label">Type</div><div class="type-grid" role="radiogroup" aria-label="Channel type">${Object.entries(types).map(([t, [n]], i) => `<button class="pal type" data-ctype="${t}" role="radio" aria-checked="${i === 0}" aria-pressed="${i === 0}">${icon(typeIcon[t], 'lg')}<b>${n}</b></button>`).join('')}</div>
      <p class="type-hint" id="typeHint">${types.text[1]}</p>
      <label class="stack-label gap-top" for="chName">Name</label><input class="input" id="chName" placeholder="e.g. ${types.text[2]}" maxlength="40" autocomplete="off"></div>
      <footer><button class="btn ghost" data-act="closeModal">Cancel</button><button class="btn primary" id="mkChannel">Create channel</button></footer>`, { label: 'Add a channel' });
    let type = 'text';
    const create = () => {
      const name = $('#chName').value.trim() || types[type][0];
      const id = 'c' + Date.now(); D.channels[id] = { type, name, topic: '' }; D.rooms[state.room].channels.push(id); D.messages[id] = [];
      if (type === 'voice') D.voiceOccupants[id] = [];
      closeModal(); go(state.community, state.room, id); toast('Channel created', name, typeIcon[type], 'ok');
    };
    $('#scrim').addEventListener('click', (e) => {
      const b = e.target.closest('[data-ctype]');
      if (b) {
        type = b.dataset.ctype; $$('[data-ctype]').forEach((x) => { x.setAttribute('aria-pressed', x === b); x.setAttribute('aria-checked', x === b); });
        $('#typeHint').textContent = types[type][1]; $('#chName').placeholder = `e.g. ${types[type][2]}`;
      }
      if (e.target.closest('#mkChannel')) create();
    });
    $('#chName').addEventListener('keydown', (e) => { if (e.key === 'Enter') create(); });
    setTimeout(() => $('#chName')?.focus(), 40);
  },
  newRoom() { newRoomModal(); },
  newDm() { openPalette(''); },
  cmdk() { openPalette(); },
  cmdkVoice() { openPalette('voice'); },
  settings() { openSettings(); },
  settingsPage(el) { state.settingsPage = el.dataset.id; micStop(); rerenderPane(); },
  closeModal() { closeModal(); },
  shortcuts() { shortcutSheet(); },
  meMenu(el) {
    openPopover(el, `<div class="me-head">${avatar('me', 'md', true)}<div><b>${esc(person('me').name)}</b><small>@${person('me').handle}</small></div></div><div class="menu-sep"></div>
      ${[['online', 'Online'], ['idle', 'Away'], ['dnd', 'Do not disturb'], ['offline', 'Invisible']].map(([s, n]) => `<button class="menu-item ${state.status === s ? 'checked' : ''}" data-act="status" data-v="${s}"><span class="status-dot ${s}"></span>${n}</button>`).join('')}
      <div class="menu-sep"></div><button class="menu-item" data-act="profile" data-id="me">${icon('user')}View profile</button><button class="menu-item" data-act="themeFlip">${icon(currentLight() ? 'moon' : 'sun')}${currentLight() ? 'Dark mode' : 'Light mode'}<span class="hint">Ctrl Shift L</span></button><button class="menu-item" data-act="settings">${icon('settings')}Settings<span class="hint">Ctrl ,</span></button><button class="menu-item" data-act="shortcuts">${icon('keyboard')}Shortcuts<span class="hint">Ctrl /</span></button>
      <div class="menu-sep"></div><button class="menu-item danger" data-act="signout">${icon('logout')}Sign out of this browser</button>`, { align: 'end' });
  },
  status(el) { state.status = el.dataset.v; closePopover(); renderTitle(); toast('Status updated', { online: 'Online', idle: 'Away', dnd: 'Do not disturb', offline: 'Invisible' }[state.status], 'user'); },
  themeFlip() { closePopover(); state.theme.mode = currentLight() ? 'dark' : 'light'; applyTheme(true); },
  signout() { closePopover(); toast('This is a design preview', 'Signing out would remove this browser’s device key', 'info'); },
  profile(el) { if (popover?.el.contains(el)) closePopover(); profileCard(el.closest('button, .avatar, b') || el, el.dataset.id || el.closest('[data-person]')?.dataset.person); },
  openDm(el) { closePopover(); startDm(el.dataset.id); },
  members(el) { membersPopover(el); },
  memberCard(el) { const id = el.dataset.id; closePopover(); profileCard($('#onlineStack'), id); },
  copyName(el) { const h = '@' + person(el.dataset.id).handle; navigator.clipboard?.writeText(h).catch(() => {}); toast('Username copied', h, 'copy', 'ok'); },
  localMute(el) { const id = el.dataset.id, s = state.voice.localMute; if (s.has(id)) s.delete(id); else s.add(id); refreshVolume(id); toast(s.has(id) ? `${person(id).name} muted for you` : `${person(id).name} unmuted`, 'Only changes what you hear', s.has(id) ? 'micOff' : 'volume'); },
  resetVolume(el) { const id = el.dataset.id; delete state.voice.volume[id]; state.voice.localMute.delete(id); refreshVolume(id); },
  roomMenu(el) {
    openPopover(el, `<div class="menu-label">${esc(D.rooms[state.room].name)}</div><button class="menu-item" data-act="roomSettings">${icon('settings')}Room settings</button><button class="menu-item" data-act="newChannel">${icon('plus')}Add a channel</button><button class="menu-item" data-act="invite">${icon('users')}Invite people</button><div class="menu-sep"></div><button class="menu-item" data-act="markRead">${icon('check')}Mark all as read</button><button class="menu-item" data-act="muteRoom">${icon(roomMuted() ? 'bell' : 'bellOff')}${roomMuted() ? 'Unmute room' : 'Mute room'}</button><button class="menu-item" data-act="toastCopy">${icon('link')}Copy room link</button>`, { align: 'end' });
  },
  roomSettings() { roomSettingsModal(); },
  copyNewInvite(el) {
    const exp = $('[data-k="expire"][aria-pressed="true"]')?.dataset.v || '7d';
    const expires = { '1d': 'in 1 day', '7d': 'in 7 days', never: 'never' }[exp];
    if (!D.invites.some((i) => i.id === el.dataset.id)) D.invites.unshift({ id: el.dataset.id, community: community().id, by: 'me', uses: 0, expires });
    else D.invites.find((i) => i.id === el.dataset.id).expires = expires;
    navigator.clipboard?.writeText($('#inviteLink').value).catch(() => $('#inviteLink').select());
    el.innerHTML = icon('check', 'sm') + 'Copied'; setTimeout(() => { if (el.isConnected) el.innerHTML = icon('copy', 'sm') + 'Copy'; }, 1600);
    toast('Invite link copied', expires === 'never' ? 'This link never expires' : `It stops working ${expires}`, 'link', 'ok');
  },
  copyInvite(el) { navigator.clipboard?.writeText('https://krypt.example/join#' + el.dataset.id).catch(() => {}); toast('Invite link copied', 'Paste it anywhere', 'link', 'ok'); },
  revokeInvite(el) { const i = D.invites.findIndex((x) => x.id === el.dataset.id); if (i >= 0) D.invites.splice(i, 1); renderCsPane(); toast('Invite revoked', 'That link no longer works', 'link'); },
  leaveCommunity() { toast('Make someone else an owner first', 'Then you can leave', 'info', 'warn'); },
  deleteCommunity() { const c = community(); if (D.communities.length < 2) { toast('Can’t delete your only community', 'Create or join another one first', 'info', 'warn'); return; } D.communities.splice(D.communities.indexOf(c), 1); closeModal(); const n = D.communities[0]; go(n.id, n.rooms[0]); renderTitle(); renderCommunity(); toast(`${c.name} deleted`, 'Removed for everyone', 'trash'); },
  saveRoom() { const name = $('#roomName')?.value.trim(); if (name) D.rooms[state.room].name = name; closeModal(); renderSide(); renderTabs(); renderMain(); toast('Room saved', name || '', 'checkCircle', 'ok'); },
  muteRoom() { closePopover(); const on = !roomMuted(); D.rooms[state.room].channels.forEach((c) => on ? state.muted.add(c) : state.muted.delete(c)); renderTabs(); renderSide(); toast(on ? 'Room muted' : 'Room unmuted', D.rooms[state.room].name, on ? 'bellOff' : 'bell'); },
  markRead() { closePopover(); for (const c of D.rooms[state.room].channels) delete state.unread[c]; renderSide(); renderTabs(); toast('All caught up', D.rooms[state.room].name, 'check', 'ok'); },
  dmCall(el) { closePopover(); const who = el.dataset.id || D.dms.find((d) => d.id === state.dm)?.with; toast(`Calling ${person(who).name}…`, 'Ringing on their devices', 'phone'); },
  // chat
  send() { send(); },
  attach() { $('#fileInput')?.click(); },
  unpend(el) { state.pending.splice(Number(el.dataset.i), 1); rerenderComposer(); },
  emoji(el) { if (popover?.anchor === el) { closePopover(); return; } emojiPicker(el, (e) => { const t = $('#input'); t.setRangeText(e, t.selectionStart, t.selectionEnd, 'end'); t.focus(); updateSend(); }, 'above', 'start', 'Emoji'); },
  format() { state.format = !state.format; rerenderComposer(); },
  fmt(el) { const f = el.dataset.f; if (f === 'bold') wrapSel('**'); else if (f === 'italic') wrapSel('*'); else if (f === 'code') wrapSel('`'); else if (f === 'block') wrapSel('', true); else { const t = $('#input'); t.setRangeText('> ', t.selectionStart, t.selectionStart, 'end'); t.focus(); } },
  react(el) { react(el.dataset.id, el.dataset.e); },
  reactPick(el) { el.closest('.msg')?.classList.add('menu-open'); emojiPicker(el, (e) => react(el.dataset.id, e), 'below'); },
  reply(el) { state.replyTo = Number(el.dataset.id); rerenderComposer(); },
  cancelReply() { state.replyTo = null; rerenderComposer(); },
  edit(el) { state.editing = Number(el.dataset.id); refreshFeed(false); focusEdit(); },
  saveEdit(el) { saveEdit(Number(el.dataset.id)); },
  cancelEdit() { state.editing = null; refreshFeed(false); },
  msgMenu(el) {
    const m = findMsg(el.dataset.id); el.closest('.msg').classList.add('menu-open');
    openPopover(el, `<button class="menu-item" data-act="reply" data-id="${m.id}">${icon('reply')}Reply</button><button class="menu-item" data-act="copyText" data-id="${m.id}">${icon('copy')}Copy text</button><button class="menu-item" data-act="pinMsg" data-id="${m.id}">${icon('pin')}${isPinned(m.id) ? 'Unpin message' : 'Pin message'}</button>
      ${m.author === 'me' ? `<button class="menu-item" data-act="edit" data-id="${m.id}">${icon('edit')}Edit</button><div class="menu-sep"></div><button class="menu-item danger" data-act="deleteMsg" data-id="${m.id}">${icon('trash')}Delete</button>` : `<div class="menu-sep"></div><button class="menu-item" data-act="profile" data-id="${m.author}">${icon('user')}View ${esc(person(m.author).name)}’s profile</button>`}`, { align: 'end' });
  },
  copyText(el) { closePopover(); navigator.clipboard?.writeText(findMsg(el.dataset.id).text).catch(() => {}); toast('Copied', '', 'copy', 'ok'); },
  pinMsg(el) {
    const id = Number(el.dataset.id); const key = convKey(); const list = (D.pinned[key] ||= []);
    const fromList = !!el.closest('.pins-pop'); const anchor = popover?.anchor;
    const was = list.includes(id);
    D.pinned[key] = was ? list.filter((x) => x !== id) : [...list, id];
    closePopover(); refreshFeed(false); updatePinbar();
    if (fromList && anchor?.isConnected && D.pinned[key].length) pinsPopover(anchor);
    toast(was ? 'Unpinned' : 'Pinned', was ? 'Removed from this conversation’s pins' : 'Everyone here can find it under Pinned', 'pin', 'ok');
  },
  openDoc() { go('server', 'alex-room', 'docs'); },
  gotoPin(el) { closePopover(); act.gotoMsg(el); },
  deleteMsg(el) { closePopover(); const key = convKey(); D.messages[key] = D.messages[key].filter((m) => m.id !== Number(el.dataset.id)); refreshFeed(false); renderSide(); toast('Message deleted', 'Removed from every device', 'trash'); },
  gotoMsg(el) { const t = $(`.msg[data-mid="${el.dataset.id}"]`); if (t) { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); t.classList.remove('flash'); void t.offsetWidth; t.classList.add('flash'); } },
  pins(el) {
    const anchor = el.closest('.popover') ? popover.anchor : el;
    if (popover?.anchor === anchor && popover.el.classList.contains('pins-pop')) { closePopover(); return; }
    pinsPopover(anchor);
  },
  jumpLatest() { scrollFeed(false); $('#jump').classList.remove('show'); },
  expandGroup(el) { expandedGroups.add(Number(el.dataset.id)); refreshFeed(false); },
  search() { state.searchOpen = !state.searchOpen; if (!state.searchOpen) state.search = ''; renderMain(); },
  convMenu(el) {
    const muted = state.muted.has(convKey());
    openPopover(el, `<button class="menu-item" data-act="search">${icon('search')}Search<span class="hint">Ctrl F</span></button><button class="menu-item" data-act="pins">${icon('pin')}Pinned messages<span class="hint">${pinsFor(convKey()).length || ''}</span></button><button class="menu-item" data-act="toastMute">${icon(muted ? 'bell' : 'bellOff')}${muted ? 'Unmute notifications' : 'Mute notifications'}</button><button class="menu-item" data-act="toastCopy">${icon('link')}Copy link</button><button class="menu-item" data-act="invite">${icon('users')}Invite people</button>`, { align: 'end' });
  },
  toastMute() {
    closePopover(); const k = convKey(); const on = !state.muted.has(k);
    if (on) state.muted.add(k); else state.muted.delete(k);
    renderTabs(); renderSide();
    toast(on ? 'Notifications muted' : 'Notifications on', on ? 'You won’t be pinged here until you unmute' : 'You’ll be notified about new messages here', on ? 'bellOff' : 'bell');
  },
  toastCopy() { closePopover(); toast('Link copied', 'Paste it anywhere', 'link', 'ok'); },
  lightbox(el) {
    const m = findMsg(el.dataset.id); const a = m.attachments[0];
    lightbox(a.url ? `<img class="lb-media" src="${a.url}" alt="${esc(a.name)}">` : `<div class="lb-media lb-art" role="img" aria-label="${esc(a.name)}">${a.art === 'poster' ? poster() : desk()}</div>`,
      { title: esc(a.name), sub: `Shared by ${esc(person(m.author).name)} · ${dayLabel(m.t)} ${clock(m.t)}`, download: a.name });
  },
  // voice
  joinVoice(el) { joinVoice(el.dataset.id); },
  leave() { leaveVoice(); },
  gotoVoice() { const ch = state.voice.channel; const r = roomOf(ch); const c = D.communities.find((x) => x.rooms.includes(r)); go(c.id, r, ch); },
  mute() { state.voice.muted = !state.voice.muted; if (!state.voice.muted && state.voice.deafened) state.voice.deafened = false; renderVoicebar(); if (D.channels[state.channel]?.type === 'voice') renderMain(); toast(state.voice.muted ? 'Microphone muted' : 'Microphone on', '', state.voice.muted ? 'micOff' : 'mic'); },
  deafen() { state.voice.deafened = !state.voice.deafened; if (state.voice.deafened) state.voice.muted = true; renderVoicebar(); toast(state.voice.deafened ? 'Deafened' : 'Undeafened', state.voice.deafened ? 'You won’t hear anyone, and your mic is off' : '', state.voice.deafened ? 'headphonesOff' : 'headphones'); },
  micMenu(el) { openPopover(el, `<div class="menu-label">Input device</div><button class="menu-item checked">${icon('mic')}Shure MV7</button><button class="menu-item">${icon('mic')}Headset microphone</button><div class="menu-sep"></div><button class="menu-item" data-act="settingsVoice">${icon('settings')}Voice settings</button>`, { place: 'above', align: 'end' }); },
  outMenu(el) { openPopover(el, `<div class="menu-label">Output device</div><button class="menu-item checked">${icon('volume')}Speakers (Realtek)</button><button class="menu-item">${icon('headphones')}Headphones</button><div class="menu-sep"></div><button class="menu-item" data-act="settingsVoice">${icon('settings')}Voice settings</button>`, { place: 'above', align: 'end' }); },
  settingsVoice() { openSettings('voice'); },
  micTest() { micTest(); },
  sharePicker() { sharePicker(); },
  stopShare() { state.voice.sharing = null; renderVoicebar(); if (state.channel === state.voice.channel) renderMain(); toast('Stopped sharing', '', 'monitorOff'); },
  layout(el) { state.voice.focus = el.dataset.v === 'focus'; renderMain(); },
  hud() { state.share.hud = !state.share.hud; store.set('share', state.share); renderMain(); },
  dockToggle() { state.voice.dock = !state.voice.dock; renderMain(); },
  shareFull(el) {
    const i = Number(el.dataset.i); const img = $('img', el).src;
    if (state.voice.focus || innerWidth < 820) {
      const who = el.dataset.who;
      lightbox(`<img class="lb-media" src="${img}" alt="">`, { cls: 'share', share: true, title: `<span class="live-dot"></span>${who === 'me' ? 'Your screen' : `${esc(person(who).name)}’s screen`}`, sub: `${esc(el.dataset.name)} · ${state.share.quality === 'crisp' ? '1440p60' : state.share.quality === 'balanced' ? '720p30' : '1080p60'}` });
      return;
    }
    state.voice.focus = true; renderMain();
    if (i === 0) setTimeout(() => popOutHint(), 400);
  },
  // calendar / tasks
  cal(el) { const d = Number(el.dataset.d); state.calendarOffset = d === 0 ? 0 : state.calendarOffset + d; renderMain(); },
  eventInfo(el) {
    const e = D.events[Number(el.dataset.ev)]; if (!e) return;
    const d = new Date(); d.setDate(d.getDate() + e.day);
    const going = e.who.includes('me');
    const pop = openPopover(el, `<div class="ev-card" style="--eh:${e.hue}"><div class="ev-top"><i></i><div><b>${esc(e.title)}</b><small>${d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })} · ${pad(e.h)}:00</small></div></div>
      <div class="ev-who">${e.who.map((w) => avatar(w, 'xs')).join('')}<span>${e.who.length} going${going ? ' · including you' : ''}</span></div>
      <div class="ev-actions"><button class="btn sm ${going ? '' : 'primary'}" data-act="rsvp" data-ev="${el.dataset.ev}">${icon(going ? 'x' : 'check', 'sm')}${going ? 'Can’t make it' : 'I’m going'}</button><button class="btn sm danger" data-act="deleteEvent" data-ev="${el.dataset.ev}">${icon('trash', 'sm')}Delete</button></div></div>`, { cls: 'ev-pop' });
    pop.addEventListener('click', (x) => { if (!x.target.closest('[data-act]')) x.stopPropagation(); });
  },
  rsvp(el) { const e = D.events[Number(el.dataset.ev)]; const on = !e.who.includes('me'); e.who = on ? [...e.who, 'me'] : e.who.filter((w) => w !== 'me'); closePopover(); renderMain(); toast(on ? 'You’re going' : 'Marked as not going', e.title, 'calendar', on ? 'ok' : ''); },
  deleteEvent(el) { const [e] = D.events.splice(Number(el.dataset.ev), 1); closePopover(); renderMain(); toast('Event deleted', e.title, 'trash'); },
  addEvent(el) {
    if (popover?.anchor === el) { closePopover(); return; }
    const date = el.dataset.date ? new Date(el.dataset.date) : new Date();
    const pop = openPopover(el, `<div class="ev-new"><div class="menu-label">New event · ${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</div><input class="input sm" id="evTitle" placeholder="What’s happening?" autocomplete="off"><div class="row2"><select class="select sm" id="evHour" aria-label="Time">${Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${h === 20 ? 'selected' : ''}>${pad(h)}:00</option>`).join('')}</select><button class="btn sm primary" id="evSave">Add to calendar</button></div></div>`, { keepFocus: true });
    $('#evTitle').focus();
    const save = () => { const title = $('#evTitle').value.trim(); if (!title) return; const day = Math.round((new Date(date.toDateString()) - new Date(new Date().toDateString())) / 86400000); D.events.push({ day, h: clamp(Number($('#evHour').value), 0, 23), title, who: ['me'], hue: Math.floor(Math.random() * 360) }); closePopover(); renderMain(); toast('Event added', title, 'calendar', 'ok'); };
    $('#evSave').onclick = save; $('#evTitle').onkeydown = (e) => { if (e.key === 'Enter') save(); };
    pop.addEventListener('click', (e) => e.stopPropagation());
  },
  addTask(el) {
    // An inline draft card instead of a browser prompt.
    $('.card.new')?.remove();
    const col = $(`.col[data-col="${el.dataset.col || 'todo'}"] .cards`); if (!col) return;
    col.insertAdjacentHTML('afterbegin', `<div class="card new"><textarea id="taskDraft" rows="2" placeholder="What needs doing?" aria-label="New task"></textarea><footer><button class="btn sm ghost" data-act="cancelTask">Cancel</button><button class="btn sm primary" data-act="saveTask" data-col="${el.dataset.col || 'todo'}">Add</button></footer></div>`);
    const t = $('#taskDraft'); t.focus();
    t.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); act.saveTask($('[data-act="saveTask"]')); } if (e.key === 'Escape') { e.stopPropagation(); act.cancelTask(); } });
  },
  saveTask(el) { const title = $('#taskDraft')?.value.trim(); if (!title) { $('#taskDraft')?.focus(); return; } D.tasks.items.unshift({ id: 't' + Date.now(), col: el.dataset.col, title, who: 'me', tag: 'Plan' }); renderMain(); toast('Task added', title, 'checkCircle', 'ok'); },
  cancelTask() { $('.card.new')?.remove(); },
  // settings
  set(el) {
    const { k, v } = el.dataset;
    if (['mode', 'density', 'motion'].includes(k)) { state.theme[k] = v; applyTheme(k === 'mode'); }
    else if (k === 'quality' || k === 'codec') { state.share[k] = v; store.set('share', state.share); }
    else if (k === 'expire') { const n = $('#inviteNote'); if (n) n.firstChild.textContent = v === 'never' ? 'Never expires. See what they’ll see: ' : `Expires in ${v === '1d' ? '1 day' : '7 days'}. See what they’ll see: `; }
    $$(`[data-act="set"][data-k="${k}"]`).forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === v));
    if (k === 'mode') setTimeout(rerenderPane, 50);
  },
  palette(el) { state.theme.preset = el.dataset.id; state.theme.custom = null; state.theme.accent = null; applyTheme(true); setTimeout(rerenderPane, 30); },
  resetColours() { state.theme.custom = null; state.theme.accent = null; applyTheme(true); rerenderPane(); },
  toggle(el) {
    const on = el.getAttribute('aria-checked') !== 'true'; el.setAttribute('aria-checked', on);
    const k = el.dataset.k;
    if (k === 'hud') { state.share.hud = on; store.set('share', state.share); }
    if (k === 'room_notify') D.rooms[state.room].channels.forEach((c) => on ? state.muted.delete(c) : state.muted.add(c));
    if (k.startsWith('perm:')) { const [, r, perm] = k.split(':'); const l = D.rolePerms[r]; if (on && !l.includes(perm)) l.push(perm); if (!on) D.rolePerms[r] = l.filter((x) => x !== perm); }
    if (k.startsWith('n_')) { state.notify[k.slice(2)] = on; store.set('notify', state.notify); if (k === 'n_desktop' && on && 'Notification' in window) Notification.requestPermission(); }
  },
  revoke(el) { const d = D.devices.find((x) => x.id === el.dataset.id); D.devices.splice(D.devices.indexOf(d), 1); rerenderPane(); toast(`${d.name} removed`, 'Its key no longer opens your account', 'shield', 'ok'); },
  reveal() { const r = $('#recovery'); const on = r.classList.toggle('revealed'); const b = $('#revealBtn'); if (b) b.innerHTML = icon(on ? 'x' : 'eye', 'sm') + (on ? 'Hide' : 'Reveal'); },
};

function popOutHint() { toast('Focus view', 'Click the share again for full screen · P pops it out', 'expand'); }
// A small always-on-top copy of the share while you read chat elsewhere. Drag it
// anywhere; a click (without dragging) takes you back to the call.
function popOut() {
  const img = $('.tile.share img')?.src || (remoteShare()?.img); if (!img) return;
  closeMini();
  const who = remoteShare()?.who || 'me';
  const el = document.createElement('div'); el.className = 'mini-player';
  el.setAttribute('role', 'region'); el.setAttribute('aria-label', `${person(who).name}’s screen, pop-out`);
  el.innerHTML = `<img src="${img}" alt=""><div class="bar"><span class="live-dot"></span><span class="t">${who === 'me' ? 'Your screen' : `${esc(person(who).name)}’s screen`}</span><button class="ibtn" data-mini="back" aria-label="Back to the call" title="Back to the call">${icon('expand', 'sm')}</button><button class="ibtn" data-mini="close" aria-label="Close pop-out" title="Close">${icon('x', 'sm')}</button></div>`;
  document.body.append(el);
  el.addEventListener('click', (e) => { const b = e.target.closest('[data-mini]'); if (!b) return; if (b.dataset.mini === 'back') act.gotoVoice(); else closeMini(); });
  let sx = null, sy, ox, oy, dragged = false;
  el.onpointerdown = (e) => { if (e.target.closest('.ibtn')) return; el.setPointerCapture(e.pointerId); sx = e.clientX; sy = e.clientY; dragged = false; const r = el.getBoundingClientRect(); ox = r.left; oy = r.top; };
  el.onpointermove = (e) => {
    if (sx == null) return;
    if (!dragged && Math.hypot(e.clientX - sx, e.clientY - sy) < 4) return;
    dragged = true; el.classList.add('moved', 'dragging');
    el.style.left = clamp(ox + e.clientX - sx, 8, innerWidth - el.offsetWidth - 8) + 'px'; el.style.top = clamp(oy + e.clientY - sy, 8, innerHeight - el.offsetHeight - 8) + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto';
  };
  el.onpointerup = (e) => { if (sx == null) return; sx = null; el.classList.remove('dragging'); if (dragged) placeCorner(); else if (!e.target.closest('.ibtn')) act.gotoVoice(); };
  placeCorner();
}
function closeMini() { const el = $('.mini-player:not(.closing)'); if (!el) return; el.classList.add('closing'); setTimeout(() => el.remove(), reduceMotion() ? 0 : 160); document.documentElement.style.setProperty('--toast-lift', '0px'); }

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (popover && !popover.el.contains(e.target) && !(el && popover.anchor === el)) closePopover();
  if (!el) return;
  const name = el.dataset.act;
  if (popover && popover.anchor === el && ['communityMenu', 'meMenu', 'channelMenu', 'micMenu', 'outMenu', 'convMenu', 'roomMenu', 'members'].includes(name)) { closePopover(); return; }
  if (act[name]) { e.preventDefault(); act[name](el, e); }
});
document.addEventListener('keydown', (e) => {
  const typing = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); return; }
  if (mod && e.key === ',') { e.preventDefault(); openSettings(); return; }
  if (mod && e.key === '/') { e.preventDefault(); if ($('#scrim .sheet-grid')) closeModal(); else shortcutSheet(); return; }
  if (mod && e.shiftKey && e.key.toLowerCase() === 'l') { e.preventDefault(); act.themeFlip(); return; }
  if (mod && e.shiftKey && e.key.toLowerCase() === 'm') { e.preventDefault(); act.mute(); return; }
  if (mod && e.shiftKey && e.key.toLowerCase() === 'd') { e.preventDefault(); act.deafen(); return; }
  if (mod && e.key.toLowerCase() === 'f' && (state.dm || D.channels[state.channel]?.type === 'text')) { e.preventDefault(); if (!state.searchOpen) act.search(); else $('#searchInput')?.focus(); return; }
  if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); stepChannel(e.key === 'ArrowUp' ? -1 : 1); return; }
  if (popover && (e.key === 'ArrowDown' || e.key === 'ArrowUp') && !popover.el.classList.contains('mention-pop') && !/INPUT|TEXTAREA/.test(e.target.tagName)) {
    const items = $$('.menu-item:not([disabled]), .emoji-grid button, .pp-item button', popover.el); if (items.length) {
      e.preventDefault(); const i = items.indexOf(document.activeElement);
      items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus(); return;
    }
  }
  if (e.key === 'Escape') {
    if ($('#lightbox')) { closeLightbox(); return; }
    if (popover) { const a = popover.anchor; const inside = popover.el.contains(document.activeElement); closePopover(); if (inside) a?.focus?.({ preventScroll: true }); return; }
    if ($('#scrim')) { closeModal(); return; }
    if (state.voice.focus && D.channels[state.channel]?.type === 'voice') { state.voice.focus = false; renderMain(); return; }
    if (state.searchOpen) { act.search(); return; }
  }
  if (typing) return;
  if (e.key === '?' && !$('#scrim')) { e.preventDefault(); shortcutSheet(); }
  else if (e.key === '/') { e.preventDefault(); $('#input')?.focus(); }
  else if (e.key.toLowerCase() === 'p' && state.voice.channel) { if ($('.mini-player:not(.closing)')) closeMini(); else popOut(); }
  else if (e.key.length === 1 && !mod && !e.altKey && $('#input') && !$('#scrim')) $('#input').focus();
});
addEventListener('resize', () => { moveIndicator(); placeCorner(); });
document.fonts?.ready.then(() => moveIndicator());

// ------------------------------------------------------------------ boot
applyTheme();
renderShell();
// A gentle sign of life: someone starts typing a little after you arrive.
setTimeout(() => {
  if (convKey() !== 'general') return;
  state.typing.general = 'mel'; renderTyping();
  setTimeout(() => {
    delete state.typing.general; renderTyping();
    D.messages.general.push({ id: Date.now(), author: 'mel', t: Date.now(), text: 'ok who’s bringing the frogs @adam', reactions: [] });
    if (convKey() === 'general') refreshFeed(false); else state.unread.general = (state.unread.general || 0) + 1;
    renderSide();
  }, 2600);
}, 3500);
