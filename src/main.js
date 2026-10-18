import './style.css';
import { APP_NAME, firebaseConfig, ICE_SERVERS, HEARTBEAT_MS, STALE_MS, RING_TIMEOUT_MS } from './config.js';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, deleteUser } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, orderBy, limit,
  onSnapshot, serverTimestamp, writeBatch, increment, getDocs, deleteField } from 'firebase/firestore';

document.title = APP_NAME;
const fb = initializeApp(firebaseConfig);
const auth = getAuth(fb);
const db = getFirestore(fb);
const $ = (s, r = document) => r.querySelector(s);
const app = $('#app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const COLORS = ['#0866ff', '#a033ff', '#e41e3f', '#f7b928', '#31a24c', '#ff6f00', '#00a3a3', '#d6249f', '#5b5bd6', '#444950'];
const EMOJI = '😀 😂 😍 🥰 😎 🤔 😢 😡 👍 👎 👏 🙏 🔥 🎉 ❤️ 💯 😴 🤯 😅 😉 🙌 💀 🥳 😬 🤝 ✅ 👀 🍕 ☕ 🚀 ⭐ 👋'.split(' ');
const chatIdOf = (a, b) => [a, b].sort().join('_');

// ---------- state ----------
const S = {
  user: null, me: null, tab: 'chats', friends: new Map(), friendUnsubs: new Map(), reqIn: [], reqOut: [], chats: [],
  openChat: null, msgs: [], unsubs: [], chatUnsubs: [], call: null, theme: localStorage.getItem('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
};
document.documentElement.dataset.theme = S.theme;
window.__app = S; // handy for debugging/tests

function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.append(d); setTimeout(() => d.remove(), 3000); }
const ms = (ts) => (ts?.toMillis ? ts.toMillis() : typeof ts === 'number' ? ts : 0);
function isActive(u) { return !!u && u.online && Date.now() - ms(u.lastActive) < STALE_MS; }
function ago(u) {
  if (!u) return '';
  if (isActive(u)) return 'Active now';
  const t = ms(u.lastActive); if (!t) return 'Offline';
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 60) return `Active ${Math.max(m, 1)}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `Active ${h}h ago`;
  return `Active ${Math.floor(h / 24)}d ago`;
}
function initials(u) { return esc((u?.displayName || u?.username || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('')); }
function av(u, size = 40, dot = true) {
  return `<div class="av" style="width:${size}px;height:${size}px;background:${esc(u?.color || '#888')};font-size:${size * 0.38}px">${initials(u)}${dot && isActive(u) ? '<span class="on"></span>' : ''}</div>`;
}
function fmtTime(t) {
  const d = new Date(t), now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (now - d < 6 * 864e5) return d.toLocaleDateString([], { weekday: 'short' }) + ' ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ---------- auth screens ----------
function renderAuth(mode = 'login', err = '') {
  let color = COLORS[Math.floor(Math.random() * COLORS.length)];
  app.innerHTML = `<div class="auth"><form class="card" id="af" autocomplete="on">
    <div class="logo">💬</div><h1>${esc(APP_NAME)}</h1>
    <p class="sub">${mode === 'login' ? 'Log in to chat with friends' : 'Create your account'}</p>
    ${mode === 'signup' ? `<input class="field" id="dn" placeholder="Display name" required maxlength="40">
      <input class="field" id="un" placeholder="@username (a-z, 0-9, _)" required pattern="[a-zA-Z0-9_]{3,20}" maxlength="20">
      <div style="font-size:13px;color:var(--muted)">Avatar color</div><div class="colors" id="cols">${COLORS.map((c) => `<button type="button" data-c="${c}" style="background:${c}" class="${c === color ? 'sel' : ''}"></button>`).join('')}</div>` : ''}
    <input class="field" id="em" type="email" placeholder="Email" required autocomplete="email">
    <input class="field" id="pw" type="password" placeholder="Password (6+ chars)" required minlength="6" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}">
    <div class="err" id="err">${esc(err)}</div>
    <button class="btn" style="width:100%;padding:12px" id="go">${mode === 'login' ? 'Log in' : 'Sign up'}</button>
    <p style="text-align:center;margin:16px 0 0">${mode === 'login' ? `New here? <a href="#" class="link" id="sw">Create account</a>` : `Have an account? <a href="#" class="link" id="sw">Log in</a>`}</p>
    <p style="text-align:center;margin:10px 0 0"><a href="#" class="link" id="th" style="font-weight:400;font-size:13px">Toggle ${S.theme === 'dark' ? 'light' : 'dark'} mode</a></p>
  </form></div>`;
  $('#sw').onclick = (e) => { e.preventDefault(); renderAuth(mode === 'login' ? 'signup' : 'login'); };
  $('#th').onclick = (e) => { e.preventDefault(); toggleTheme(); renderAuth(mode); };
  $('#cols')?.addEventListener('click', (e) => { const c = e.target.dataset.c; if (!c) return; color = c; [...$('#cols').children].forEach((b) => b.classList.toggle('sel', b.dataset.c === c)); });
  $('#af').onsubmit = async (e) => {
    e.preventDefault(); const go = $('#go'); go.disabled = true; $('#err').textContent = '';
    const email = $('#em').value.trim(), pw = $('#pw').value;
    try {
      if (mode === 'login') await signInWithEmailAndPassword(auth, email, pw);
      else {
        const username = $('#un').value.trim().toLowerCase(), displayName = $('#dn').value.trim();
        if (!/^[a-z0-9_]{3,20}$/.test(username)) throw new Error('Username must be 3-20 chars: a-z, 0-9, _');
        S.pendingProfile = { username, displayName, color };
        const cred = await createUserWithEmailAndPassword(auth, email, pw);
        try {
          await setDoc(doc(db, 'usernames', username), { uid: cred.user.uid });
        } catch { await deleteUser(cred.user).catch(() => {}); S.pendingProfile = null; throw new Error('That username is taken.'); }
        await setDoc(doc(db, 'users', cred.user.uid), { username, displayName, color, createdAt: serverTimestamp(), lastActive: serverTimestamp(), online: true, inCall: false });
        S.pendingProfile = null; startApp(cred.user);
      }
    } catch (ex) {
      $('#err').textContent = (ex.code || ex.message || '').replace('auth/', '').replace(/-/g, ' ');
      go.disabled = false;
    }
  };
}
function toggleTheme() { S.theme = S.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = S.theme; localStorage.setItem('theme', S.theme); }

onAuthStateChanged(auth, (u) => {
  if (!u) { stopApp(); renderAuth(); return; }
  if (S.pendingProfile) return; // signup flow will call startApp
  startApp(u);
});

// ---------- presence ----------
let hbTimer = null;
function heartbeat(online = true) {
  if (!S.user) return;
  updateDoc(doc(db, 'users', S.user.uid), { lastActive: serverTimestamp(), online }).catch(() => {});
}
function startPresence() {
  const tick = () => { if (document.visibilityState === 'visible') heartbeat(true); };
  tick(); hbTimer = setInterval(tick, HEARTBEAT_MS);
  document.addEventListener('visibilitychange', onVis);
  addEventListener('beforeunload', onUnload);
}
function onVis() { if (document.visibilityState === 'visible') { heartbeat(true); markRead(); } }
function onUnload() { heartbeat(false); if (S.call) endCall('ended', true); }

// ---------- app lifecycle ----------
async function startApp(user) {
  if (S.user?.uid === user.uid) return;
  S.user = user;
  app.innerHTML = '<div class="placeholder" style="height:100vh">Loading…</div>';
  S.unsubs.push(onSnapshot(doc(db, 'users', user.uid), (s) => {
    if (!s.exists()) { app.innerHTML = '<div class="placeholder" style="height:100vh">Profile missing. <button class="btn" id="lo">Log out</button></div>'; $('#lo').onclick = () => signOut(auth); return; }
    const first = !S.me; S.me = { id: s.id, ...s.data() };
    if (first) { renderShell(); startPresence(); } else renderSide();
  }));
  S.unsubs.push(onSnapshot(collection(db, 'users', user.uid, 'friends'), (snap) => {
    const ids = new Set(snap.docs.map((d) => d.id));
    for (const [id, un] of S.friendUnsubs) if (!ids.has(id)) { un(); S.friendUnsubs.delete(id); S.friends.delete(id); }
    for (const id of ids) if (!S.friendUnsubs.has(id)) {
      S.friendUnsubs.set(id, onSnapshot(doc(db, 'users', id), (u) => { if (u.exists()) S.friends.set(id, { id, ...u.data() }); else S.friends.delete(id); renderSide(); renderChatHead(); }, () => {}));
    }
    renderSide();
  }));
  S.unsubs.push(onSnapshot(query(collection(db, 'friendRequests'), where('to', '==', user.uid)), async (snap) => {
    S.reqIn = await Promise.all(snap.docs.map(async (d) => ({ id: d.id, ...d.data(), user: await profile(d.data().from) })));
    renderSide();
  }));
  S.unsubs.push(onSnapshot(query(collection(db, 'friendRequests'), where('from', '==', user.uid)), async (snap) => {
    S.reqOut = await Promise.all(snap.docs.map(async (d) => ({ id: d.id, ...d.data(), user: await profile(d.data().to) })));
    renderSide();
  }));
  const subChats = () => S.unsubs.push(onSnapshot(query(collection(db, 'chats'), where('members', 'array-contains', user.uid), orderBy('lastAt', 'desc'), limit(100)), (snap) => {
    S.chats = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderSide();
    if (S.openChat) { const c = S.chats.find((x) => x.id === S.openChat.id); if (c) { S.openChat.data = c; renderMsgs(); } }
    const unread = S.chats.reduce((n, c) => n + (c.unread?.[user.uid] || 0), 0);
    document.title = (unread ? `(${unread}) ` : '') + APP_NAME;
  }, (e) => { console.warn('chats', e); setTimeout(() => { if (S.user?.uid === user.uid) subChats(); }, 15000); }));
  subChats();
  S.unsubs.push(onSnapshot(query(collection(db, 'calls'), where('callee', '==', user.uid), where('status', '==', 'ringing')), (snap) => {
    snap.docChanges().forEach((ch) => { if (ch.type === 'added') onIncomingCall(ch.doc); });
  }, (e) => console.warn('calls', e)));
  S.ticker = setInterval(() => { renderSide(); renderChatHead(); }, 30000);
}
function stopApp() {
  S.unsubs.forEach((u) => u()); S.unsubs = []; S.chatUnsubs.forEach((u) => u()); S.chatUnsubs = [];
  S.friendUnsubs.forEach((u) => u()); S.friendUnsubs.clear(); S.friends.clear();
  clearInterval(hbTimer); clearInterval(S.ticker); document.removeEventListener('visibilitychange', onVis); removeEventListener('beforeunload', onUnload);
  Object.assign(S, { user: null, me: null, reqIn: [], reqOut: [], chats: [], openChat: null, msgs: [] });
}
const profCache = new Map();
async function profile(uid) {
  if (S.friends.has(uid)) return S.friends.get(uid);
  if (profCache.has(uid)) return profCache.get(uid);
  const s = await getDoc(doc(db, 'users', uid)).catch(() => null);
  const p = s?.exists() ? { id: uid, ...s.data() } : { id: uid, displayName: 'Unknown', username: '?' };
  profCache.set(uid, p); return p;
}

// ---------- shell ----------
function renderShell() {
  app.innerHTML = `<div class="shell" id="shell">
    <aside class="side">
      <div class="top" style="position:relative"><div id="meav" style="cursor:pointer"></div><h2>${esc(APP_NAME)}</h2>
        <button class="icon" id="reqbtn" title="Friend requests">👥<span id="reqbadge"></span></button>
        <button class="icon" id="menubtn" title="Menu">⚙️</button></div>
      <div class="tabs"><button data-t="chats">Chats</button><button data-t="active">Active</button><button data-t="friends">Friends</button><button data-t="requests">Requests</button></div>
      <div class="list" id="list"></div>
    </aside>
    <main class="main" id="main"><div class="placeholder"><div class="logo">💬</div><div>Select a chat or start a new one from Friends</div></div></main>
    <section class="info" id="info"></section>
  </div>`;
  $('.tabs').onclick = (e) => { const t = e.target.closest('button')?.dataset.t; if (t) { S.tab = t; renderSide(); } };
  $('#reqbtn').onclick = () => { S.tab = 'requests'; renderSide(); };
  $('#menubtn').onclick = (e) => { e.stopPropagation(); showMenu(); };
  $('#meav').onclick = editProfile;
  renderSide();
}
function showMenu() {
  $('.menu')?.remove();
  const m = document.createElement('div'); m.className = 'menu';
  m.innerHTML = `<div style="padding:8px 10px;color:var(--muted);font-size:13px">Signed in as @${esc(S.me.username)}</div>
    <button data-a="profile">✏️ Edit profile</button><button data-a="theme">🌓 ${S.theme === 'dark' ? 'Light' : 'Dark'} mode</button><button data-a="out">🚪 Log out</button>`;
  $('.side .top').append(m);
  m.onclick = async (e) => {
    const a = e.target.closest('button')?.dataset.a; m.remove();
    if (a === 'theme') { toggleTheme(); }
    if (a === 'profile') editProfile();
    if (a === 'out') { heartbeat(false); setTimeout(() => signOut(auth), 300); }
  };
  setTimeout(() => document.addEventListener('click', () => m.remove(), { once: true }));
}
function editProfile() {
  const me = S.me; let color = me.color;
  const ov = document.createElement('div'); ov.className = 'auth'; ov.style.cssText = 'position:fixed;inset:0;z-index:40';
  ov.innerHTML = `<form class="card"><h1 style="margin-bottom:12px">Profile</h1><div style="display:flex;justify-content:center;margin-bottom:10px" id="pav">${av(me, 72, false)}</div>
    <div style="text-align:center;color:var(--muted)">@${esc(me.username)}</div>
    <input class="field" id="pdn" value="${esc(me.displayName)}" maxlength="40" required>
    <div class="colors" id="pcols">${COLORS.map((c) => `<button type="button" data-c="${c}" style="background:${c}" class="${c === color ? 'sel' : ''}"></button>`).join('')}</div>
    <div style="display:flex;gap:8px;margin-top:12px"><button class="btn sec" type="button" id="pc" style="flex:1">Cancel</button><button class="btn" style="flex:1">Save</button></div></form>`;
  document.body.append(ov);
  $('#pcols', ov).onclick = (e) => { const c = e.target.dataset.c; if (!c) return; color = c; [...$('#pcols', ov).children].forEach((b) => b.classList.toggle('sel', b.dataset.c === c)); $('#pav', ov).innerHTML = av({ ...me, color, displayName: $('#pdn', ov).value }, 72, false); };
  $('#pc', ov).onclick = () => ov.remove();
  $('form', ov).onsubmit = async (e) => { e.preventDefault(); await updateDoc(doc(db, 'users', S.user.uid), { displayName: $('#pdn', ov).value.trim() || me.displayName, color }); ov.remove(); };
}

function renderSide() {
  const list = $('#list'); if (!list || !S.me) return;
  $('#meav').innerHTML = av(S.me, 36, false);
  const nIn = S.reqIn.length;
  $('#reqbadge').innerHTML = nIn ? `<span class="badge">${nIn}</span>` : '';
  document.querySelectorAll('.tabs button').forEach((b) => {
    b.classList.toggle('on', b.dataset.t === S.tab);
    if (b.dataset.t === 'requests') b.innerHTML = `Requests${nIn ? `<span class="badge">${nIn}</span>` : ''}`;
    if (b.dataset.t === 'chats') { const u = S.chats.filter((c) => c.unread?.[S.user.uid]).length; b.innerHTML = `Chats${u ? `<span class="badge">${u}</span>` : ''}`; }
  });
  const friends = [...S.friends.values()].sort((a, b) => (isActive(b) - isActive(a)) || ms(b.lastActive) - ms(a.lastActive));
  const active = friends.filter(isActive);
  const uid = S.user.uid;
  let h = '';
  if (S.tab === 'chats') {
    if (active.length) h += `<div class="active-strip" id="strip">${active.map((f) => `<div class="a" data-open="${f.id}">${av(f, 52)}<div>${esc(f.displayName.split(' ')[0])}</div></div>`).join('')}</div>`;
    h += S.chats.length ? S.chats.map((c) => {
      const oid = c.members.find((m) => m !== uid); const f = S.friends.get(oid) || profCache.get(oid) || { id: oid, displayName: '…' };
      if (!profCache.has(oid) && !S.friends.has(oid)) profile(oid).then(renderSide);
      const un = c.unread?.[uid] || 0;
      const tp = c.typing?.[oid] && Date.now() - c.typing[oid] < 6000;
      return `<div class="row ${S.openChat?.id === c.id ? 'on' : ''}" data-open="${oid}">${av(f, 52)}<div class="meta"><div class="name">${esc(f.displayName)}</div>
        <div class="snip ${un ? 'unread' : ''}">${tp ? '<i>typing…</i>' : `${c.lastFrom === uid ? 'You: ' : ''}${esc(c.lastMessage || '')} · ${c.lastAt ? fmtTime(ms(c.lastAt)) : ''}`}</div></div>${un ? `<span class="cnt">${un}</span>` : ''}</div>`;
    }).join('') : `<div class="empty">No conversations yet.<br>Add friends and say hi 👋</div>`;
  } else if (S.tab === 'active') {
    h += `<div class="sect">Active now (${active.length})</div>`;
    h += active.length ? active.map((f) => friendRow(f)).join('') : '<div class="empty">None of your friends are active right now.</div>';
    const recent = friends.filter((f) => !isActive(f));
    if (recent.length) h += `<div class="sect">Recently active</div>` + recent.map((f) => friendRow(f)).join('');
  } else if (S.tab === 'friends') {
    h += `<div class="sect">All friends (${friends.length})</div>`;
    h += friends.length ? friends.map((f) => friendRow(f, true)).join('') : '<div class="empty">No friends yet. Use the Requests tab to find people by @username.</div>';
  } else {
    h += `<form id="sf" style="display:flex;gap:6px;padding:0 4px 8px"><input class="field" id="sq" placeholder="Find by @username" style="margin:0" value="${esc(S.searchQ || '')}"><button class="btn">Search</button></form><div id="sres">${S.searchRes || ''}</div>`;
    h += `<div class="sect">Received (${S.reqIn.length})</div>` + (S.reqIn.length ? S.reqIn.map((r) => `<div class="row">${av(r.user, 44)}<div class="meta"><div class="name">${esc(r.user.displayName)}</div><div class="snip">@${esc(r.user.username)}</div></div>
      <button class="btn sm" data-acc="${r.id}">Accept</button><button class="btn sm sec" data-del="${r.id}">Decline</button></div>`).join('') : '<div class="empty" style="padding:10px">No pending requests</div>');
    h += `<div class="sect">Sent (${S.reqOut.length})</div>` + (S.reqOut.length ? S.reqOut.map((r) => `<div class="row">${av(r.user, 44)}<div class="meta"><div class="name">${esc(r.user.displayName)}</div><div class="snip">@${esc(r.user.username)} · pending</div></div>
      <button class="btn sm sec" data-del="${r.id}">Cancel</button></div>`).join('') : '<div class="empty" style="padding:10px">No sent requests</div>');
  }
  const focusSearch = document.activeElement?.id === 'sq';
  list.innerHTML = h;
  if (focusSearch) { const i = $('#sq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  list.onclick = onListClick;
  const sf = $('#sf'); if (sf) sf.onsubmit = (e) => { e.preventDefault(); searchUser($('#sq').value); };
}
function friendRow(f, actions) {
  return `<div class="row" data-open="${f.id}">${av(f, 44)}<div class="meta"><div class="name">${esc(f.displayName)}</div><div class="snip">@${esc(f.username)} · ${ago(f)}</div></div>
    <button class="icon" data-call="${f.id}" title="Voice call">📞</button>${actions ? `<button class="icon" data-rm="${f.id}" title="Remove friend">✖</button>` : ''}</div>`;
}
async function onListClick(e) {
  const t = e.target.closest('[data-acc],[data-del],[data-add],[data-rm],[data-call],[data-open]'); if (!t) return;
  e.stopPropagation();
  try {
    if (t.dataset.acc) return acceptReq(S.reqIn.find((r) => r.id === t.dataset.acc));
    if (t.dataset.del) { await deleteDoc(doc(db, 'friendRequests', t.dataset.del)); return; }
    if (t.dataset.add) return sendReq(t.dataset.add);
    if (t.dataset.rm) { const f = S.friends.get(t.dataset.rm); if (confirm(`Remove ${f?.displayName} from friends?`)) return removeFriend(t.dataset.rm); return; }
    if (t.dataset.call) return startCall(t.dataset.call);
    if (t.dataset.open) return openChat(t.dataset.open);
  } catch (ex) { console.error(ex); toast('Something went wrong: ' + (ex.code || ex.message)); }
}

// ---------- friends ----------
async function searchUser(q) {
  q = q.trim().replace(/^@/, '').toLowerCase(); S.searchQ = q;
  if (!/^[a-z0-9_]{3,20}$/.test(q)) { S.searchRes = '<div class="empty" style="padding:8px">Enter a valid username</div>'; return renderSide(); }
  const s = await getDoc(doc(db, 'usernames', q));
  if (!s.exists()) S.searchRes = `<div class="empty" style="padding:8px">No user @${esc(q)}</div>`;
  else {
    const uid = s.data().uid, p = await profile(uid);
    let act;
    if (uid === S.user.uid) act = '<span class="snip">That\'s you</span>';
    else if (S.friends.has(uid)) act = '<span class="snip">Friends ✓</span>';
    else if (S.reqOut.some((r) => r.to === uid)) act = '<span class="snip">Requested</span>';
    else act = `<button class="btn sm" data-add="${uid}">Add friend</button>`;
    S.searchRes = `<div class="row">${av(p, 44, false)}<div class="meta"><div class="name">${esc(p.displayName)}</div><div class="snip">@${esc(p.username)}</div></div>${act}</div>`;
  }
  renderSide();
}
async function sendReq(uid) {
  const rev = S.reqIn.find((r) => r.from === uid);
  if (rev) return acceptReq(rev);
  await setDoc(doc(db, 'friendRequests', `${S.user.uid}_${uid}`), { from: S.user.uid, to: uid, createdAt: serverTimestamp() });
  toast('Friend request sent'); S.searchRes = ''; renderSide();
}
async function acceptReq(r) {
  const me = S.user.uid, b = writeBatch(db);
  b.set(doc(db, 'users', me, 'friends', r.from), { since: serverTimestamp() });
  b.set(doc(db, 'users', r.from, 'friends', me), { since: serverTimestamp() });
  b.delete(doc(db, 'friendRequests', r.id));
  await b.commit(); toast(`You and ${r.user.displayName} are now friends`);
}
async function removeFriend(uid) {
  const me = S.user.uid, b = writeBatch(db);
  b.delete(doc(db, 'users', me, 'friends', uid)); b.delete(doc(db, 'users', uid, 'friends', me));
  await b.commit();
  if (S.openChat?.other === uid) closeChat();
}

// ---------- chat ----------
function closeChat() {
  S.chatUnsubs.forEach((u) => u()); S.chatUnsubs = []; S.openChat = null;
  $('#shell')?.classList.remove('chatting');
  $('#main').innerHTML = '<div class="placeholder"><div class="logo">💬</div><div>Select a chat</div></div>'; $('#info').innerHTML = '';
  renderSide();
}
async function openChat(other) {
  const me = S.user.uid, id = chatIdOf(me, other);
  if (!S.friends.has(other)) { toast('You can only message friends'); return; }
  S.chatUnsubs.forEach((u) => u()); S.chatUnsubs = [];
  S.openChat = { id, other, data: S.chats.find((c) => c.id === id) || null }; S.msgs = [];
  $('#shell').classList.add('chatting');
  await setDoc(doc(db, 'chats', id), { members: [me, other].sort() }, { merge: true });
  const main = $('#main');
  main.innerHTML = `<div class="chead"><button class="icon back" id="back">←</button><div id="chav"></div><div class="meta"><div class="name" id="chn"></div><div class="st" id="chs"></div></div>
    <button class="icon" id="callbtn" title="Voice call">📞</button></div>
    <div class="msgs" id="msgs"></div>
    <form class="composer" id="cf"><button type="button" class="icon" id="emb">😊</button><textarea id="ta" rows="1" placeholder="Aa"></textarea><button class="icon" id="sendb" title="Send">➤</button></form>`;
  $('#back').onclick = closeChat;
  $('#callbtn').onclick = () => startCall(other);
  const ta = $('#ta');
  let lastTyping = 0;
  ta.oninput = () => {
    ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    if (Date.now() - lastTyping > 2500 && ta.value) { lastTyping = Date.now(); updateDoc(doc(db, 'chats', id), { [`typing.${me}`]: Date.now() }).catch(() => {}); }
  };
  ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#cf').requestSubmit(); } };
  $('#cf').onsubmit = (e) => { e.preventDefault(); const t = ta.value.trim(); if (!t) return; ta.value = ''; ta.style.height = 'auto'; lastTyping = 0; sendMsg(id, other, t); ta.focus(); };
  $('#emb').onclick = (e) => {
    e.stopPropagation(); const ex = $('.emoji'); if (ex) return ex.remove();
    const p = document.createElement('div'); p.className = 'emoji'; p.innerHTML = EMOJI.map((x) => `<button type="button">${x}</button>`).join('');
    p.onclick = (ev) => { if (ev.target.tagName === 'BUTTON') { ta.value += ev.target.textContent; ta.focus(); } ev.stopPropagation(); };
    $('#cf').append(p); setTimeout(() => document.addEventListener('click', () => p.remove(), { once: true }));
  };
  renderChatHead();
  S.chatUnsubs.push(onSnapshot(query(collection(db, 'chats', id, 'messages'), orderBy('at', 'desc'), limit(200)), (snap) => {
    S.msgs = snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) })).reverse();
    renderMsgs(); markRead();
  }, (e) => console.warn('msgs', e)));
  S.chatUnsubs.push(onSnapshot(doc(db, 'chats', id), (s) => { if (s.exists() && S.openChat?.id === id) { S.openChat.data = { id, ...s.data() }; renderMsgs(); markRead(); } }));
  const tt = setInterval(renderMsgs, 3000); S.chatUnsubs.push(() => clearInterval(tt));
  renderSide();
  if (matchMedia('(min-width:761px)').matches) ta.focus();
}
function renderChatHead() {
  if (!S.openChat || !$('#chn')) return;
  const f = S.friends.get(S.openChat.other) || { displayName: 'Former friend' };
  $('#chav').innerHTML = av(f, 40); $('#chn').textContent = f.displayName; $('#chs').textContent = ago(f);
  $('#info').innerHTML = `<div style="display:flex;justify-content:center">${av(f, 80)}</div><h3 style="margin:10px 0 2px">${esc(f.displayName)}</h3>
    <div style="color:var(--muted)">@${esc(f.username)}</div><div style="color:var(--muted);font-size:13px;margin-top:4px">${ago(f)}</div>
    <div style="display:flex;gap:8px;justify-content:center;margin-top:16px"><button class="btn sec" id="icall">📞 Call</button></div>`;
  $('#icall').onclick = () => startCall(S.openChat.other);
}
let lastMsgCount = 0;
function renderMsgs() {
  const box = $('#msgs'); if (!box || !S.openChat) return;
  const me = S.user.uid, other = S.openChat.other, c = S.openChat.data || {};
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
  let h = '', prev = 0;
  for (const m of S.msgs) {
    const t = ms(m.at) || Date.now();
    if (t - prev > 15 * 60000) h += `<div class="ts">${fmtTime(t)}</div>`;
    prev = t;
    const big = /^(\p{Extended_Pictographic}|\uFE0F|\u200D){1,6}$/u.test(m.text);
    h += `<div class="m ${m.from === me ? 'me' : ''} ${big ? 'big' : ''}" title="${esc(new Date(t).toLocaleString())}">${esc(m.text)}</div>`;
  }
  const mine = [...S.msgs].reverse().find((m) => m.from === me);
  const last = S.msgs[S.msgs.length - 1];
  if (last && last.from === me) {
    const seen = ms(c.read?.[other]) >= ms(last.at) && ms(last.at);
    h += `<div class="seen" id="seen">${seen ? 'Seen' : 'Sent'}</div>`;
  } else if (mine) { /* nothing */ }
  if (c.typing?.[other] && Date.now() - c.typing[other] < 6000) h += '<div class="typing" id="typing"><i></i><i></i><i></i></div>';
  if (!S.msgs.length) h = `<div class="placeholder">${av(S.friends.get(other), 72)}<div>Say hi to ${esc(S.friends.get(other)?.displayName || '')} 👋</div></div>`;
  box.innerHTML = h;
  if (nearBottom || S.msgs.length !== lastMsgCount) box.scrollTop = box.scrollHeight;
  lastMsgCount = S.msgs.length;
}
async function sendMsg(id, other, text) {
  const me = S.user.uid;
  await addDoc(collection(db, 'chats', id, 'messages'), { from: me, text, at: serverTimestamp() });
  await updateDoc(doc(db, 'chats', id), { lastMessage: text.slice(0, 100), lastAt: serverTimestamp(), lastFrom: me, [`unread.${other}`]: increment(1), [`typing.${me}`]: deleteField() });
}
function markRead() {
  const c = S.openChat; if (!c || document.visibilityState !== 'visible') return;
  const me = S.user.uid, d = c.data || {};
  const last = S.msgs[S.msgs.length - 1];
  if ((d.unread?.[me] || 0) > 0 || (last && last.from !== me && ms(d.read?.[me]) < ms(last.at))) {
    updateDoc(doc(db, 'chats', c.id), { [`unread.${me}`]: 0, [`read.${me}`]: serverTimestamp() }).catch(() => {});
  }
}

// ---------- voice calls (WebRTC + Firestore signaling) ----------
let audioCtx = null;
function tone(kind) {
  stopTone();
  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  audioCtx.resume?.();
  const play = () => {
    const now = audioCtx.currentTime, g = audioCtx.createGain(); g.connect(audioCtx.destination);
    const freqs = kind === 'ring' ? [[880, 0], [660, 0.2], [880, 0.4], [660, 0.6]] : [[440, 0], [480, 0]];
    const dur = kind === 'ring' ? 0.18 : 1.2;
    g.gain.setValueAtTime(0.0001, now);
    for (const [f, off] of freqs) {
      const o = audioCtx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(g);
      o.start(now + off); o.stop(now + off + dur);
      g.gain.setValueAtTime(0.15, now + off); g.gain.setValueAtTime(0.0001, now + off + dur);
    }
  };
  play(); S.toneTimer = setInterval(play, kind === 'ring' ? 2000 : 3000);
}
function stopTone() { clearInterval(S.toneTimer); }

function callUI() {
  const c = S.call; if (!c) { $('#callov')?.remove(); return; }
  let ov = $('#callov'); if (!ov) { ov = document.createElement('div'); ov.id = 'callov'; ov.className = 'call'; document.body.append(ov); }
  const p = c.peer || {};
  const stText = { calling: 'Calling…', ringing: 'Ringing…', incoming: 'Incoming voice call', connecting: 'Connecting…', active: '', ended: c.endText || 'Call ended' }[c.state];
  let btns = '';
  if (c.state === 'incoming') btns = `<button class="cb red" id="cdecl" title="Decline">✆</button><button class="cb green pulse" id="cacc" title="Accept">📞</button>`;
  else if (c.state !== 'ended') btns = `<button class="cb ${c.muted ? 'on' : ''}" id="cmute" title="Mute">${c.muted ? '🔇' : '🎤'}</button><button class="cb red" id="chang" title="Hang up">✆</button>`;
  ov.dataset.state = c.state;
  ov.innerHTML = `<div class="${c.state === 'incoming' || c.state === 'calling' || c.state === 'ringing' ? 'pulse' : ''}" style="border-radius:50%">${av(p, 120, false)}</div>
    <h2 style="margin:6px 0 0">${esc(p.displayName || '')}</h2><div class="st" id="cst">${stText}</div><div class="timer" id="ctimer">${c.state === 'active' ? fmtDur() : ''}</div>
    <div class="btns">${btns}</div>`;
  $('#cacc', ov)?.addEventListener('click', acceptCall);
  $('#cdecl', ov)?.addEventListener('click', () => endCall('declined'));
  $('#chang', ov)?.addEventListener('click', () => endCall('ended'));
  $('#cmute', ov)?.addEventListener('click', () => { c.muted = !c.muted; c.stream?.getAudioTracks().forEach((t) => (t.enabled = !c.muted)); callUI(); });
}
function fmtDur() { const s = Math.floor((Date.now() - (S.call?.startedAt || Date.now())) / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }

function newPC(callId, mySide, theirSide) {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  window.__pc = pc;
  const c = S.call;
  c.stream.getTracks().forEach((t) => pc.addTrack(t, c.stream));
  const sendCand = (cand) => { c.sent = (c.sent || 0) + 1; return addDoc(collection(db, 'calls', callId, mySide), cand).then(() => { c.sentOk = (c.sentOk || 0) + 1; }).catch((er) => console.warn('ice', er)); };
  c.pendingCands = [];
  c.flushCands = () => { c.docReady = true; c.pendingCands.forEach(sendCand); c.pendingCands = []; };
  pc.onicecandidate = (e) => { if (!e.candidate) return; const j = e.candidate.toJSON(); if (c.docReady) sendCand(j); else c.pendingCands.push(j); };
  pc.ontrack = (e) => { if (!c.audio) { c.audio = new Audio(); c.audio.autoplay = true; } c.audio.srcObject = e.streams[0]; c.audio.play().catch(() => {}); };
  const onState = () => {
    const ok = pc.connectionState === 'connected' || ['connected', 'completed'].includes(pc.iceConnectionState);
    if (ok && S.call && S.call.state !== 'active' && S.call.state !== 'ended') {
      S.call.state = 'active'; S.call.startedAt = Date.now(); stopTone(); callUI();
      S.call.timer = setInterval(() => { const t = $('#ctimer'); if (t) t.textContent = fmtDur(); }, 1000);
    }
    if (pc.connectionState === 'failed') endCall('ended', false, 'Connection failed (network may need a TURN server)');
  };
  c.remoteCands = [];
  const drainRemote = () => { if (!pc.remoteDescription) return; c.remoteCands.splice(0).forEach((d) => pc.addIceCandidate(new RTCIceCandidate(d)).catch((er) => console.warn('addIce', er))); };
  c.drainRemote = drainRemote;
  pc.onconnectionstatechange = onState; pc.oniceconnectionstatechange = onState;
  c.unsubs.push(onSnapshot(collection(db, 'calls', callId, theirSide), (snap) => {
    snap.docChanges().forEach((ch) => { if (ch.type === 'added') c.remoteCands.push(ch.doc.data()); });
    c.gotRemote = (c.gotRemote || 0) + snap.docChanges().length;
    drainRemote();
  }, (er) => console.warn('cands', er)));
  return pc;
}
async function getMic() {
  return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
}
async function startCall(uid) {
  if (S.call) return toast('Already in a call');
  const peer = S.friends.get(uid); if (!peer) return toast('You can only call friends');
  S.call = { role: 'caller', peer, state: 'calling', unsubs: [] }; callUI();
  try { S.call.stream = await getMic(); } catch { S.call.endText = 'Microphone access denied'; return endCall('cancel', true); }
  if (!S.call) return;
  const ref = doc(collection(db, 'calls')); S.call.id = ref.id;
  const pc = newPC(ref.id, 'callerCandidates', 'calleeCandidates'); S.call.pc = pc;
  const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
  await setDoc(ref, { caller: S.user.uid, callee: uid, status: 'ringing', createdAt: serverTimestamp(), offer: { type: offer.type, sdp: offer.sdp } });
  S.call.flushCands();
  updateDoc(doc(db, 'users', S.user.uid), { inCall: true }).catch(() => {});
  S.call.state = 'ringing'; callUI(); tone('ringback');
  S.call.unsubs.push(onSnapshot(ref, async (s) => {
    const c = S.call; if (!c || c.id !== ref.id) return;
    if (!s.exists()) return endCall(null, true);
    const d = s.data();
    if (d.answer && !pc.currentRemoteDescription) { c.state = 'connecting'; stopTone(); callUI(); await pc.setRemoteDescription(new RTCSessionDescription(d.answer)); c.drainRemote(); }
    if (d.status === 'declined') endCall(null, false, 'Call declined');
    else if (d.status === 'busy') endCall(null, false, `${peer.displayName} is on another call`);
    else if (d.status === 'ended') endCall(null, false, 'Call ended');
  }));
  S.call.ringTimeout = setTimeout(() => { if (S.call?.id === ref.id && ['ringing', 'calling'].includes(S.call.state)) endCall('missed', false, 'No answer'); }, RING_TIMEOUT_MS);
}
async function onIncomingCall(snap) {
  const d = snap.data();
  if (Date.now() - ms(d.createdAt) > RING_TIMEOUT_MS + 10000 && ms(d.createdAt)) return; // stale
  if (S.call) { updateDoc(snap.ref, { status: 'busy' }).catch(() => {}); return; }
  const peer = await profile(d.caller);
  S.call = { role: 'callee', id: snap.id, peer, state: 'incoming', offer: d.offer, unsubs: [] };
  callUI(); tone('ring');
  S.call.unsubs.push(onSnapshot(snap.ref, (s) => {
    const c = S.call; if (!c || c.id !== snap.id) return;
    if (!s.exists()) return endCall(null, true);
    const st = s.data().status;
    if (st === 'ended' || st === 'missed') endCall(null, false, c.state === 'incoming' ? `Missed call from ${peer.displayName}` : 'Call ended');
  }));
  S.call.ringTimeout = setTimeout(() => { if (S.call?.id === snap.id && S.call.state === 'incoming') endCall('missed', false, `Missed call from ${peer.displayName}`); }, RING_TIMEOUT_MS + 2000);
}
async function acceptCall() {
  const c = S.call; if (!c || c.state !== 'incoming') return;
  stopTone(); clearTimeout(c.ringTimeout); c.state = 'connecting'; callUI();
  try { c.stream = await getMic(); } catch { c.endText = 'Microphone access denied'; return endCall('declined'); }
  c.docReady = true;
  const pc = newPC(c.id, 'calleeCandidates', 'callerCandidates'); c.pc = pc; c.docReady = true;
  await pc.setRemoteDescription(new RTCSessionDescription(c.offer));
  c.drainRemote();
  const ans = await pc.createAnswer(); await pc.setLocalDescription(ans);
  await updateDoc(doc(db, 'calls', c.id), { answer: { type: ans.type, sdp: ans.sdp }, status: 'active' });
  updateDoc(doc(db, 'users', S.user.uid), { inCall: true }).catch(() => {});
}
async function endCall(status, silent, text) {
  const c = S.call; if (!c || c.state === 'ended') return;
  stopTone(); clearTimeout(c.ringTimeout); clearInterval(c.timer);
  c.unsubs.forEach((u) => u());
  c.pc?.close(); c.stream?.getTracks().forEach((t) => t.stop()); if (c.audio) c.audio.srcObject = null;
  const dur = c.startedAt ? fmtDur() : '';
  c.state = 'ended'; c.endText = text || c.endText || (dur ? `Call ended · ${dur}` : 'Call ended');
  if (c.id && status) {
    const ref = doc(db, 'calls', c.id);
    await updateDoc(ref, { status }).catch(() => {});
    // cleanup signaling docs shortly after so the other side sees the final status
    setTimeout(async () => {
      for (const side of ['callerCandidates', 'calleeCandidates']) {
        const s = await getDocs(collection(db, 'calls', c.id, side)).catch(() => null);
        s?.docs.forEach((d) => deleteDoc(d.ref).catch(() => {}));
      }
      deleteDoc(ref).catch(() => {});
    }, 2500);
  }
  if (S.user) updateDoc(doc(db, 'users', S.user.uid), { inCall: false }).catch(() => {});
  window.__lastCall = { endText: c.endText, wasActive: !!c.startedAt };
  if (silent && !text) { S.call = null; return callUI(); }
  callUI();
  setTimeout(() => { if (S.call === c) { S.call = null; callUI(); } }, 2000);
}
