import './style.css';
import { APP_NAME, FORWARD_MESSAGE, firebaseConfig, ICE_SERVERS, HEARTBEAT_MS, STALE_MS, RING_TIMEOUT_MS } from './config.js';
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, orderBy, limit,
  onSnapshot, serverTimestamp, writeBatch, increment, getDocs, deleteField } from 'firebase/firestore';

document.title = APP_NAME;
const fb = initializeApp(firebaseConfig);
const auth = getAuth(fb);
const db = getFirestore(fb);
// Local testing against the Firebase emulators: add ?emu=1 to the URL (only honoured on localhost).
if (new URLSearchParams(location.search).has('emu') && ['localhost', '127.0.0.1'].includes(location.hostname)) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true }); connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
setPersistence(auth, browserLocalPersistence).catch(() => {});
getRedirectResult(auth).catch((e) => console.warn('redirect', e));

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const COLORS = ['#39ff14', '#00e5ff', '#ff2d55', '#ffd60a', '#bf5af2', '#ff9f0a', '#64d2ff', '#30d158', '#ff375f', '#e5e5e5'];
const EMOJI = '😀 😂 😍 🥰 😎 🤔 😢 😡 👍 👎 👏 🙏 🔥 🎉 ❤️ 💯 😴 🤯 😅 😉 🙌 💀 🥳 😬 🤝 ✅ 👀 🍕 ☕ 🚀 ⭐ 👋'.split(' ');
const THEMES = [
  { id: 'default', name: 'Default', desc: 'Black · white · neon green', bg: '#000', fg: '#fff', ac: '#39ff14' },
  { id: 'pink', name: 'Neon Pink', desc: 'Black · neon pink', bg: '#000', fg: '#ff3ec8', ac: '#ff3ec8' },
  { id: 'blue', name: 'Neon Blue', desc: 'Black · neon blue', bg: '#000', fg: '#1fb8ff', ac: '#1fb8ff' },
  { id: 'usa', name: 'USA', desc: 'Navy · white · red & blue', bg: '#0a1a3f', fg: '#fff', ac: '#ff2d3d' },
  { id: 'currency', name: 'Currency', desc: 'Black · money green 💰💵', bg: '#000', fg: '#85e05a', ac: '#2ecc40' },
];
function applyTheme(t) { if (!THEMES.some((x) => x.id === t)) t = 'default'; document.documentElement.dataset.theme = t; localStorage.setItem('lc-theme', t); }
applyTheme(localStorage.getItem('lc-theme'));
const chatIdOf = (a, b) => [a, b].sort().join('_');
const ICON = {
  phone: '<svg viewBox="0 0 24 24"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z"/></svg>',
  chats: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3C6.5 3 2 7 2 12c0 2.6 1.2 4.9 3.2 6.5V22l3.3-1.8c1.1.3 2.3.5 3.5.5 5.5 0 10-4 10-9s-4.5-9-10-9z"/></svg>',
  calls: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  friends: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.5 3.3-5.5 6.5-5.5s5.9 2 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.6c2.8-.3 5 1.4 5.5 4.4"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.6 7.6 0 0 0-1.7-1L15 3.3h-4l-.4 2.6a7.6 7.6 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.5 7.5 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1c.5.4 1.1.7 1.7 1l.4 2.6h4l.4-2.6c.6-.3 1.2-.6 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" transform="translate(-1 0)"/></svg>',
  bubble: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5C6.2 2.5 1.5 6.6 1.5 11.7c0 2.9 1.5 5.4 3.9 7.1L4.5 22l4-2c1.1.3 2.3.5 3.5.5 5.8 0 10.5-4.1 10.5-9.2S17.8 2.5 12 2.5z"/></svg>',
  person: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="7.5" r="4.5"/><path d="M3 21.5c.7-5 4.4-7.5 9-7.5s8.3 2.5 9 7.5z"/></svg>',
  phoneW: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z"/></svg>',
  compose: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>',
};

// ---------- state ----------
const S = { user: null, me: null, tab: 'home', friends: new Map(), friendUnsubs: new Map(), reqIn: [], reqOut: [], chats: [], history: [],
  openChat: null, msgs: [], unsubs: [], chatUnsubs: [], call: null, chatQ: '', dd: { active: true, requests: true } };
window.__app = S;

function shell(inner) {
  document.body.innerHTML = `<header class="appbar"><span id="hleft"></span><div class="brand" id="brand">${esc(APP_NAME)}</div><div id="hbtns"></div></header><div class="body" id="body">${inner}</div>`;
}
function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.append(d); setTimeout(() => d.remove(), 3000); }
const ms = (ts) => (ts?.toMillis ? ts.toMillis() : typeof ts === 'number' ? ts : 0);
const isActive = (u) => !!u && u.online && Date.now() - ms(u.lastActive) < STALE_MS;
function status(u) {
  if (!u) return '';
  if (isActive(u)) return u.inCall ? 'Having a conversation' : 'Active now';
  const t = ms(u.lastActive); if (!t) return 'Offline';
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 60) return `Active ${Math.max(m, 1)}m ago`;
  const h = Math.floor(m / 60); return h < 24 ? `Active ${h}h ago` : `Active ${Math.floor(h / 24)}d ago`;
}
const initials = (u) => esc((u?.displayName || u?.username || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join(''));
function av(u, size = 40, dot = true) {
  const img = u?.photoURL ? `<img src="${esc(u.photoURL)}" referrerpolicy="no-referrer" style="width:100%;height:100%;border-radius:50%;object-fit:cover" alt="">` : initials(u);
  return `<div class="av" style="width:${size}px;height:${size}px;background:${esc(u?.color || '#39ff14')};font-size:${size * 0.38}px">${img}${dot && isActive(u) ? '<span class="gdot"></span>' : ''}</div>`;
}
const nameDot = (u) => `${esc(u?.displayName || '')}${isActive(u) ? ' <span class="gdot" title="Active"></span>' : ''}`;
const phoneBtn = (uid, extra = '') => `<button class="phone" data-call="${uid}" title="Voice call" ${extra}>${ICON.phone}</button>`;
function fmtTime(t) {
  const d = new Date(t), now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (now - d < 6 * 864e5) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
const fmtDur = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// ---------- auth ----------
function renderAuth(mode = 'login', err = '') {
  shell(`<div class="auth"><form class="card" id="af">
    <h1>${esc(APP_NAME)}</h1><p class="sub">${mode === 'login' ? 'Sign in to connect with friends' : 'Create your account'}</p>
    <button type="button" class="btn" id="gbtn" style="width:100%;padding:12px;display:flex;gap:10px;justify-content:center;align-items:center">
      <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z"/></svg>
      Sign in with Google</button>
    <div style="text-align:center;color:var(--dim);margin:14px 0 6px;font-size:13px">— or use email —</div>
    ${mode === 'signup' ? `<input class="field" id="dn" placeholder="Display name" required maxlength="40">
      <input class="field" id="un" placeholder="@username (a-z, 0-9, _)" required pattern="[a-zA-Z0-9_]{3,20}" maxlength="20">` : ''}
    <input class="field" id="em" type="email" placeholder="Email" required autocomplete="email">
    <input class="field" id="pw" type="password" placeholder="Password (6+ chars)" required minlength="6" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}">
    <div class="err" id="err">${esc(err)}</div>
    <button class="btn" style="width:100%;padding:12px" id="go">${mode === 'login' ? 'Log in' : 'Sign up'}</button>
    <p style="text-align:center;margin:16px 0 0">${mode === 'login' ? `New here? <a href="#" class="link" id="sw">Create account</a>` : `Have an account? <a href="#" class="link" id="sw">Log in</a>`}</p>
  </form></div>`);
  $('#sw').onclick = (e) => { e.preventDefault(); renderAuth(mode === 'login' ? 'signup' : 'login'); };
  $('#gbtn').onclick = googleSignIn;
  $('#af').onsubmit = async (e) => {
    e.preventDefault(); const go = $('#go'); go.disabled = true; $('#err').textContent = '';
    const email = $('#em').value.trim(), pw = $('#pw').value;
    try {
      if (mode === 'login') await signInWithEmailAndPassword(auth, email, pw);
      else {
        const username = $('#un').value.trim().toLowerCase(), displayName = $('#dn').value.trim();
        if (!/^[a-z0-9_]{3,20}$/.test(username)) throw new Error('Username must be 3-20 chars: a-z, 0-9, _');
        const taken = await getDoc(doc(db, 'usernames', username)).then((s) => s.exists()).catch(() => false);
        S.pendingProfile = { username, displayName };
        await createUserWithEmailAndPassword(auth, email, pw);
        if (taken) { S.pendingProfile = null; return; } // onAuthStateChanged will ask for another username
      }
    } catch (ex) { S.pendingProfile = null; $('#err').textContent = (ex.code || ex.message || '').replace('auth/', '').replace(/-/g, ' '); go.disabled = false; }
  };
}
async function googleSignIn() {
  const provider = new GoogleAuthProvider(); provider.setCustomParameters({ prompt: 'select_account' });
  const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  window.__googleAttempt = 'started';
  try {
    if (mobile) { window.__googleAttempt = 'redirect'; return await signInWithRedirect(auth, provider); }
    window.__googleAttempt = 'popup'; await signInWithPopup(auth, provider);
  } catch (e) {
    window.__googleAttempt = 'error:' + e.code;
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-environment', 'auth/web-storage-unsupported'].includes(e.code)) return signInWithRedirect(auth, provider);
    if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') $('#err') && ($('#err').textContent = e.code || e.message);
  }
}
// Profile creation (first sign-in for Google, or email signup).
async function createProfile(user, username, displayName, color) {
  await setDoc(doc(db, 'usernames', username), { uid: user.uid });
  const p = { username, displayName, color, createdAt: serverTimestamp(), lastActive: serverTimestamp(), online: true, inCall: false };
  if (user.photoURL) p.photoURL = user.photoURL;
  await setDoc(doc(db, 'users', user.uid), p);
}
function renderPickUsername(user, err = '') {
  let color = COLORS[0];
  const suggestion = (user.displayName || user.email || '').split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 16);
  shell(`<div class="auth"><form class="card" id="pf"><h1>Welcome!</h1><p class="sub">Choose your unique @username so friends can find you</p>
    <div style="display:flex;justify-content:center;margin-bottom:8px" id="pav">${av({ displayName: user.displayName, photoURL: user.photoURL, color }, 72, false)}</div>
    <input class="field" id="dn" placeholder="Display name" required maxlength="40" value="${esc(user.displayName || '')}">
    <input class="field" id="un" placeholder="@username" required maxlength="20" value="${esc(suggestion)}">
    ${user.photoURL ? '' : `<div class="colors" id="cols">${COLORS.map((c) => `<button type="button" data-c="${c}" style="background:${c}" class="${c === color ? 'sel' : ''}"></button>`).join('')}</div>`}
    <div class="err" id="err">${esc(err)}</div><button class="btn" style="width:100%;padding:12px" id="go">Continue</button>
    <p style="text-align:center"><a href="#" class="link" id="lo">Sign out</a></p></form></div>`);
  $('#cols')?.addEventListener('click', (e) => { const c = e.target.dataset.c; if (!c) return; color = c; [...$('#cols').children].forEach((b) => b.classList.toggle('sel', b.dataset.c === c)); });
  $('#lo').onclick = (e) => { e.preventDefault(); signOut(auth); };
  $('#pf').onsubmit = async (e) => {
    e.preventDefault(); $('#go').disabled = true;
    const username = $('#un').value.trim().toLowerCase().replace(/^@/, ''), displayName = $('#dn').value.trim();
    if (!/^[a-z0-9_]{3,20}$/.test(username)) return renderPickUsername(user, 'Username must be 3-20 chars: a-z, 0-9, _');
    try { await createProfile(user, username, displayName, color); startApp(user, true); }
    catch { renderPickUsername(user, 'That username is taken — try another.'); }
  };
}
onAuthStateChanged(auth, async (u) => {
  if (!u) { stopApp(); renderAuth(); return; }
  if (S.user?.uid === u.uid) return;
  const snap = await getDoc(doc(db, 'users', u.uid)).catch(() => null);
  if (snap?.exists()) return startApp(u);
  if (S.pendingProfile) {
    const { username, displayName } = S.pendingProfile; S.pendingProfile = null;
    try { await createProfile(u, username, displayName, COLORS[Math.floor(Math.random() * COLORS.length)]); return startApp(u, true); }
    catch { return renderPickUsername(u, 'That username is taken — try another.'); }
  }
  renderPickUsername(u);
});

// ---------- presence ----------
let hbTimer = null;
function heartbeat(online = true) { if (S.user) updateDoc(doc(db, 'users', S.user.uid), { lastActive: serverTimestamp(), online }).catch(() => {}); }
function startPresence() {
  const tick = () => { if (document.visibilityState === 'visible') heartbeat(true); };
  tick(); hbTimer = setInterval(tick, HEARTBEAT_MS);
  document.addEventListener('visibilitychange', onVis); addEventListener('beforeunload', onUnload);
}
function onVis() { if (document.visibilityState === 'visible') { heartbeat(true); markRead(); } }
function onUnload() { heartbeat(false); if (S.call) endCall('ended', { silent: true }); }

// ---------- lifecycle ----------
function startApp(user) {
  if (S.user?.uid === user.uid) return;
  S.user = user;
  shell('<div class="placeholder" style="height:100%">Loading…</div>');
  S.unsubs.push(onSnapshot(doc(db, 'users', user.uid), (s) => {
    if (!s.exists()) return;
    const first = !S.me; S.me = { id: s.id, ...s.data() };
    if (S.me.theme && S.me.theme !== document.documentElement.dataset.theme) applyTheme(S.me.theme);
    if (first) { renderShell(); startPresence(); } else renderHeader();
  }));
  S.unsubs.push(onSnapshot(collection(db, 'users', user.uid, 'friends'), (snap) => {
    const ids = new Set(snap.docs.map((d) => d.id));
    for (const [id, un] of S.friendUnsubs) if (!ids.has(id)) { un(); S.friendUnsubs.delete(id); S.friends.delete(id); }
    for (const id of ids) if (!S.friendUnsubs.has(id)) {
      S.friendUnsubs.set(id, onSnapshot(doc(db, 'users', id), (u) => { if (u.exists()) S.friends.set(id, { id, ...u.data() }); else S.friends.delete(id); renderSide(); renderChatHead(); }, () => {}));
    }
    renderSide();
  }));
  const reqSub = (field, key) => S.unsubs.push(onSnapshot(query(collection(db, 'friendRequests'), where(field, '==', user.uid)), async (snap) => {
    S[key] = await Promise.all(snap.docs.map(async (d) => ({ id: d.id, ...d.data(), user: await profile(field === 'to' ? d.data().from : d.data().to) })));
    renderSide();
  }));
  reqSub('to', 'reqIn'); reqSub('from', 'reqOut');
  const subChats = () => S.unsubs.push(onSnapshot(query(collection(db, 'chats'), where('members', 'array-contains', user.uid), orderBy('lastAt', 'desc'), limit(100)), (snap) => {
    S.chats = snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }));
    renderSide();
    const unread = visibleChats().reduce((n, c) => n + (c.unread?.[user.uid] || 0), 0);
    document.title = (unread ? `(${unread}) ` : '') + APP_NAME;
  }, (e) => { console.warn('chats', e); setTimeout(() => { if (S.user?.uid === user.uid) subChats(); }, 15000); }));
  subChats();
  S.unsubs.push(onSnapshot(query(collection(db, 'users', user.uid, 'callHistory'), orderBy('at', 'desc'), limit(100)), (snap) => {
    S.history = snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) })); if (S.tab === 'calls') renderSide();
  }, (e) => console.warn('history', e)));
  S.unsubs.push(onSnapshot(query(collection(db, 'calls'), where('callee', '==', user.uid), where('status', '==', 'ringing')), (snap) => {
    snap.docChanges().forEach((ch) => { if (ch.type === 'added') onIncomingCall(ch.doc); });
  }, (e) => console.warn('calls', e)));
  S.ticker = setInterval(() => { renderSide(); renderChatHead(); }, 30000);
  S.clock = setInterval(() => { const c = $('#clock'); if (c) c.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }, 1000);
}
function stopApp() {
  S.unsubs.forEach((u) => u()); S.unsubs = []; S.chatUnsubs.forEach((u) => u()); S.chatUnsubs = [];
  S.friendUnsubs.forEach((u) => u()); S.friendUnsubs.clear(); S.friends.clear();
  clearInterval(hbTimer); clearInterval(S.ticker); clearInterval(S.clock); document.removeEventListener('visibilitychange', onVis); removeEventListener('beforeunload', onUnload);
  Object.assign(S, { tab: 'home', user: null, me: null, reqIn: [], reqOut: [], chats: [], history: [], openChat: null, msgs: [] });
}
const profCache = new Map();
async function profile(uid) {
  if (S.friends.has(uid)) return S.friends.get(uid);
  if (profCache.has(uid)) return profCache.get(uid);
  const s = await getDoc(doc(db, 'users', uid)).catch(() => null);
  const p = s?.exists() ? { id: uid, ...s.data() } : { id: uid, displayName: 'Unknown user', username: '?' };
  profCache.set(uid, p); return p;
}
const peerOf = (uid) => S.friends.get(uid) || profCache.get(uid) || { id: uid, displayName: '…' };

// ---------- shell ----------
function renderShell() {
  shell(`<div class="shell" id="shell">
    <aside class="side">
      <div class="list" id="list"></div>
    </aside>
    <main class="main" id="main"><div class="placeholder"><div style="font-size:42px">💬</div><div>Select a chat, or tap the pencil to start a new message</div></div></main>
    <section class="info" id="info"></section></div>`);
  renderHeader(); renderSide();
}
function go(t) {
  S.tab = t; $('.drawer')?.remove(); $('.drawer-bg')?.remove();
  if (S.openChat && (t === 'home' || innerWidth <= 760)) closeChat(true);
  renderSide();
}
function openDrawer() {
  const bg = document.createElement('div'); bg.className = 'drawer-bg'; bg.onclick = () => { bg.remove(); d.remove(); };
  const d = document.createElement('nav'); d.className = 'drawer';
  d.innerHTML = [['home', '🏠 Home'], ['chats', '💬 Messages'], ['calls', '📞 Calls'], ['friends', '👥 Friends'], ['settings', '⚙️ Settings']].map(([t, l]) => `<button data-go="${t}">${l}</button>`).join('') + '<button data-go="signout">🚪 Sign out</button>';
  d.onclick = (e) => { const t = e.target.closest('button')?.dataset.go; if (!t) return; if (t === 'signout') { bg.remove(); d.remove(); doSignOut(); } else go(t); };
  document.body.append(bg, d);
}
function doSignOut() { heartbeat(false); if (S.call) endCall('ended', { silent: true }); setTimeout(() => signOut(auth), 300); }
function renderHeader() {
  const h = $('#hbtns'); if (!h || !S.me) return;
  $('#hleft').innerHTML = '<button class="hamb" id="hamb" title="Menu"><i></i><i></i><i></i></button>'; $('#hamb').onclick = openDrawer;
  h.style.cssText = 'display:flex;gap:8px;align-items:center';
  h.innerHTML = `<button class="hbtn" id="compose" title="New message">${ICON.compose}</button><button id="mebtn" title="Profile">${av(S.me, 36, false)}</button>`;
  $('#compose').onclick = openCompose;
  $('#mebtn').onclick = (e) => { e.stopPropagation(); showMenu(); };
}
function showMenu() {
  $('.menu')?.remove();
  const m = document.createElement('div'); m.className = 'menu';
  m.innerHTML = `<div style="padding:8px 10px;color:var(--muted);font-size:13px">${esc(S.me.displayName)} · @${esc(S.me.username)}</div><button data-a="profile">Edit profile</button><button data-a="settings">Settings</button><button data-a="out">Log out</button>`;
  document.body.append(m);
  m.onclick = (e) => { const a = e.target.closest('button')?.dataset.a; m.remove(); if (a === 'profile') editProfile(); if (a === 'settings') go('settings'); if (a === 'out') doSignOut(); };
  setTimeout(() => document.addEventListener('click', () => m.remove(), { once: true }));
}
function editProfile() {
  const me = S.me; let color = me.color;
  const ov = document.createElement('div'); ov.className = 'modal';
  ov.innerHTML = `<form class="card"><h1 style="margin-bottom:12px">Profile</h1><div style="display:flex;justify-content:center;margin-bottom:6px">${av(me, 72, false)}</div>
    <div style="text-align:center;color:var(--muted)">@${esc(me.username)}</div><input class="field" id="pdn" value="${esc(me.displayName)}" maxlength="40" required>
    <div class="colors" id="pcols">${COLORS.map((c) => `<button type="button" data-c="${c}" style="background:${c}" class="${c === color ? 'sel' : ''}"></button>`).join('')}</div>
    <div style="display:flex;gap:8px;margin-top:12px"><button class="btn" type="button" id="pc" style="flex:1">Cancel</button><button class="btn" style="flex:1">Save</button></div></form>`;
  document.body.append(ov);
  $('#pcols', ov).onclick = (e) => { const c = e.target.dataset.c; if (!c) return; color = c; [...$('#pcols', ov).children].forEach((b) => b.classList.toggle('sel', b.dataset.c === c)); };
  $('#pc', ov).onclick = () => ov.remove();
  $('form', ov).onsubmit = async (e) => { e.preventDefault(); await updateDoc(doc(db, 'users', S.user.uid), { displayName: $('#pdn', ov).value.trim() || me.displayName, color }); ov.remove(); };
}

// Chats a user can see: at least one message, and newer than their own "delete conversation" point.
function visibleChats() {
  const uid = S.user.uid;
  return S.chats.filter((c) => c.lastAt && ms(c.lastAt) > ms(c.clearedAt?.[uid]));
}
function chatRow(c) {
  const uid = S.user.uid, oid = c.members.find((m) => m !== uid), f = peerOf(oid);
  if (!S.friends.has(oid) && !profCache.has(oid)) profile(oid).then(renderSide);
  const un = c.unread?.[uid] || 0, tp = c.typing?.[oid] && Date.now() - c.typing[oid] < 6000;
  return `<div class="swipe" data-chat="${c.id}"><button class="del" data-delchat="${c.id}">Delete</button>
    <div class="row ${S.openChat?.id === c.id ? 'on' : ''}" data-open="${oid}">${av(f, 52)}<div class="meta"><div class="name">${nameDot(f)}</div>
    <div class="snip ${un ? 'unread' : ''}">${tp ? '<i>typing…</i>' : `${c.lastFrom === uid ? 'You: ' : ''}${esc(c.lastMessage || '')}`}</div></div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px"><span class="time">${fmtTime(ms(c.lastAt))}</span>${un ? `<span class="cnt">${un}</span>` : ''}</div>
    <button class="more" data-more="${c.id}" title="More">⋯</button></div></div>`;
}
function friendRow(f, extra = '') {
  return `<div class="row" data-open="${f.id}">${av(f, 44)}<div class="meta"><div class="name">${nameDot(f)}</div>
    <div class="snip">${isActive(f) && f.inCall ? '<span class="sub2">Having a conversation</span>' : `@${esc(f.username)} · ${status(f)}`}</div></div>${phoneBtn(f.id)}${extra}</div>`;
}
function renderSide() {
  const list = $('#list'); if (!list || !S.me) return;
  const uid = S.user.uid, nIn = S.reqIn.length;
  const unreadChats = visibleChats().filter((c) => c.unread?.[uid]).length;
  $('#shell')?.classList.toggle('home', S.tab === 'home');
  const back = '<button class="backhome" id="backhome" data-t="home" title="Back to menu">‹</button>';
  const friends = [...S.friends.values()].sort((a, b) => (isActive(b) - isActive(a)) || a.displayName.localeCompare(b.displayName));
  const active = friends.filter(isActive);
  let h = '';
  const focusId = document.activeElement?.id, caret = document.activeElement?.selectionStart;
  if (S.tab === 'home') {
    const pill = (t, icon, label, n) => `<button class="hpill" data-t="${t}">${icon}<span>${label}</span>${n ? `<span class="badge">${n}</span>` : ''}</button>`;
    h += `<div class="home"><h1>Let's<br>Connect</h1>${pill('chats', ICON.bubble, 'Messages', unreadChats)}${pill('calls', ICON.phoneW, 'Calls', 0)}${pill('friends', ICON.person, 'Friends', nIn)}${pill('settings', ICON.gear, 'Settings', 0)}
      <div class="clock" id="clock">${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div></div>`;
  } else if (S.tab === 'settings') {
    const cur = document.documentElement.dataset.theme;
    h += `<div class="ttl">${back}Settings</div><div class="sect">Color scheme</div><div class="themes">${THEMES.map((t) => `<button class="theme ${t.id === cur ? 'sel' : ''}" data-theme-id="${t.id}" style="background:${t.bg};color:${t.fg};border-color:${t.ac};box-shadow:0 0 8px ${t.ac}"><b>${t.name}</b><small>${t.desc}</small></button>`).join('')}</div>
      <div class="sect">Account</div><div class="row" style="cursor:default">${av(S.me, 44, false)}<div class="meta"><div class="name">${esc(S.me.displayName)}</div><div class="snip">@${esc(S.me.username)}${S.user.email ? ' · ' + esc(S.user.email) : ''}</div></div></div>
      <div style="display:flex;gap:8px;padding:8px"><button class="btn" data-act="profile" style="flex:1">Edit profile</button><button class="btn red" data-act="signout" style="flex:1" id="signoutbtn">Sign out</button></div>`;
  } else if (S.tab === 'chats') {
    h += `<div class="ttl">${back}Messages</div><input class="field" id="cq" placeholder="Search friends" value="${esc(S.chatQ)}" autocomplete="off">`;
    const q = S.chatQ.trim().toLowerCase();
    if (q) {
      const hits = friends.filter((f) => f.displayName.toLowerCase().includes(q) || f.username.includes(q.replace(/^@/, '')));
      h += hits.length ? hits.map((f) => {
        const c = visibleChats().find((x) => x.id === chatIdOf(uid, f.id));
        return c ? chatRow(c) : `<div class="row" data-open="${f.id}">${av(f, 52)}<div class="meta"><div class="name">${nameDot(f)}</div><div class="snip">Start a chat with @${esc(f.username)}</div></div></div>`;
      }).join('') : '<div class="empty">No friends match that search.</div>';
    } else {
      const vc = visibleChats();
      h += vc.length ? vc.map(chatRow).join('') : '<div class="empty">No conversations yet.<br>Tap the pencil to message a friend.</div>';
    }
  } else if (S.tab === 'calls') {
    h += `<div class="ttl">${back}Calls<span class="sp"></span>${phoneBtn('', 'id="pickcall" data-pick-call="1" title="Call a friend"')}</div>`;
    h += S.history.length ? S.history.map((c) => {
      const f = peerOf(c.peer); if (!S.friends.has(c.peer) && !profCache.has(c.peer)) profile(c.peer).then(renderSide);
      const out = c.direction === 'outgoing';
      const miss = c.outcome !== 'completed';
      const label = { completed: out ? 'You called' : 'Received', missed: out ? 'Called · no answer' : 'Missed call', declined: out ? 'Called · declined' : 'Declined (forwarded)', busy: 'Called · busy', cancelled: 'Cancelled', failed: 'Failed to connect' }[c.outcome] || c.outcome;
      return `<div class="row hist" data-open="${c.peer}">${av(f, 44)}<div class="meta"><div class="name">${nameDot(f)}</div>
        <div class="snip dir ${miss ? 'miss' : ''}">${out ? '↗' : '↙'} ${esc(label)}${c.duration ? ` · ${fmtDur(c.duration)}` : ''}</div>
        <div class="snip">${new Date(ms(c.at)).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</div></div>${phoneBtn(c.peer)}</div>`;
    }).join('') : '<div class="empty">No calls yet.</div>';
  } else {
    h += `<div class="ttl">${back}Friends</div>
      <form id="sf" style="display:flex;gap:6px"><input class="field" id="sq" placeholder="Add Connection by @username" value="${esc(S.searchQ || '')}" autocomplete="off"><button class="btn sm" style="margin:6px 0">Find</button></form><div id="sres">${S.searchRes || ''}</div>
      <button class="dd ${S.dd.active ? 'open' : ''}" data-dd="active"><span class="gdot"></span> Active Friends <span class="cnt">${active.length}</span><span class="chev">▾</span></button>
      ${S.dd.active ? `<div class="ddbody" id="activeList">${active.length ? active.map((f) => friendRow(f)).join('') : '<div class="empty" style="padding:10px">No friends are using the app right now.</div>'}</div>` : ''}
      <button class="dd ${S.dd.requests ? 'open' : ''}" data-dd="requests">🤝 Connection Requests <span class="cnt">${nIn}</span><span class="chev">▾</span></button>
      ${S.dd.requests ? `<div class="ddbody" id="reqList">${nIn ? S.reqIn.map((r) => `<div class="row" data-req="${r.id}">${av(r.user, 44, false)}<div class="meta"><div class="name">${esc(r.user.displayName)}</div><div class="snip">@${esc(r.user.username)}</div></div>
          <button class="btn sm" data-acc="${r.id}">Connect</button><button class="btn sm red" data-decl="${r.id}">Decline</button></div>`).join('') : '<div class="empty" style="padding:10px">No pending requests.</div>'}
        ${S.reqOut.length ? `<div class="sect">Sent</div>` + S.reqOut.map((r) => `<div class="row">${av(r.user, 40, false)}<div class="meta"><div class="name">${esc(r.user.displayName)}</div><div class="snip">@${esc(r.user.username)} · pending</div></div><button class="btn sm" data-decl="${r.id}">Cancel</button></div>`).join('') : ''}</div>` : ''}
      <div class="sect">All Friends (${friends.length})</div>
      ${friends.length ? friends.map((f) => friendRow(f, `<button class="icon" data-rm="${f.id}" title="Remove friend">✖</button>`)).join('') : '<div class="empty">No friends yet — add a connection above.</div>'}`;
  }
  list.innerHTML = h;
  if (focusId === 'cq' || focusId === 'sq') { const i = $('#' + focusId); i.focus(); i.setSelectionRange(caret, caret); }
  const cq = $('#cq'); if (cq) cq.oninput = () => { S.chatQ = cq.value; renderSide(); };
  const sf = $('#sf'); if (sf) sf.onsubmit = (e) => { e.preventDefault(); searchUser($('#sq').value); };
  list.onclick = onListClick; list.oncontextmenu = (e) => { const sw = e.target.closest('.swipe'); if (sw) { e.preventDefault(); toggleSwipe(sw); } };
  list.querySelectorAll('.swipe').forEach(bindSwipe);
}
function toggleSwipe(sw, open = !sw.classList.contains('open')) {
  document.querySelectorAll('.swipe.open').forEach((x) => x !== sw && x.classList.remove('open'));
  sw.classList.toggle('open', open);
}
// Swipe-left to reveal Delete (pointer events cover touch, pen and mouse drag).
function bindSwipe(sw) {
  const row = sw.querySelector('.row'); let x0 = null, y0 = 0, dx = 0, base = 0, moved = false;
  row.addEventListener('pointerdown', (e) => { if (e.button > 0) return; x0 = e.clientX; y0 = e.clientY; dx = 0; moved = false; base = sw.classList.contains('open') ? -88 : 0; });
  row.addEventListener('pointermove', (e) => {
    if (x0 === null) return; dx = e.clientX - x0;
    if (!moved && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - y0)) { moved = true; sw.classList.add('dragging'); row.setPointerCapture?.(e.pointerId); }
    if (moved) row.style.transform = `translateX(${Math.min(0, Math.max(-120, base + dx))}px)`;
  });
  const up = () => {
    if (x0 === null) return; x0 = null; sw.classList.remove('dragging'); row.style.transform = '';
    if (moved) { toggleSwipe(sw, base + dx < -44); sw.dataset.justSwiped = '1'; setTimeout(() => delete sw.dataset.justSwiped, 50); }
  };
  row.addEventListener('pointerup', up); row.addEventListener('pointercancel', up);
}
async function onListClick(e) {
  const sw = e.target.closest('.swipe');
  if (sw?.dataset.justSwiped) return;
  const t = e.target.closest('[data-t],[data-theme-id],[data-act],[data-pick-call],[data-acc],[data-decl],[data-add],[data-rm],[data-call],[data-delchat],[data-more],[data-dd],[data-open]'); if (!t) return;
  e.stopPropagation();
  if (sw && sw.classList.contains('open') && !t.dataset.delchat) { toggleSwipe(sw, false); return; }
  try {
    if (t.dataset.t) return go(t.dataset.t);
    if (t.dataset.themeId) { applyTheme(t.dataset.themeId); renderSide(); updateDoc(doc(db, 'users', S.user.uid), { theme: t.dataset.themeId }).catch((er) => console.warn('theme', er)); return; }
    if (t.dataset.act === 'profile') return editProfile();
    if (t.dataset.act === 'signout') return doSignOut();
    if (t.dataset.pickCall) return openCallPicker();
    if (t.dataset.dd) { S.dd[t.dataset.dd] = !S.dd[t.dataset.dd]; return renderSide(); }
    if (t.dataset.acc) return acceptReq(S.reqIn.find((r) => r.id === t.dataset.acc));
    if (t.dataset.decl) { await deleteDoc(doc(db, 'friendRequests', t.dataset.decl)); return; }
    if (t.dataset.add) return sendReq(t.dataset.add);
    if (t.dataset.rm) { const f = S.friends.get(t.dataset.rm); if (confirm(`Remove ${f?.displayName} from friends?`)) await removeFriend(t.dataset.rm); return; }
    if (t.dataset.call) return startCall(t.dataset.call);
    if (t.dataset.more) return toggleSwipe(t.closest('.swipe'));
    if (t.dataset.delchat) return deleteConversation(t.dataset.delchat);
    if (t.dataset.open) return openChat(t.dataset.open);
  } catch (ex) { console.error(ex); toast('Something went wrong: ' + (ex.code || ex.message)); }
}
// "Delete" hides the conversation and its history for this user only.
async function deleteConversation(id) {
  const me = S.user.uid;
  await updateDoc(doc(db, 'chats', id), { [`clearedAt.${me}`]: serverTimestamp(), [`unread.${me}`]: 0 });
  if (S.openChat?.id === id) closeChat();
  toast('Conversation deleted');
}

// ---------- friends ----------
async function searchUser(q) {
  q = q.trim().replace(/^@/, '').toLowerCase(); S.searchQ = q;
  if (!/^[a-z0-9_]{3,20}$/.test(q)) { S.searchRes = '<div class="empty" style="padding:8px">Enter a valid @username</div>'; return renderSide(); }
  const s = await getDoc(doc(db, 'usernames', q));
  if (!s.exists()) S.searchRes = `<div class="empty" style="padding:8px">No user @${esc(q)}</div>`;
  else {
    const uid = s.data().uid, p = await profile(uid);
    let act;
    if (uid === S.user.uid) act = '<span class="snip">That\'s you</span>';
    else if (S.friends.has(uid)) act = '<span class="snip">Connected ✓</span>';
    else if (S.reqOut.some((r) => r.to === uid)) act = '<span class="snip">Requested</span>';
    else act = `<button class="btn sm" data-add="${uid}">Connect</button>`;
    S.searchRes = `<div class="row">${av(p, 44, false)}<div class="meta"><div class="name">${esc(p.displayName)}</div><div class="snip">@${esc(p.username)}</div></div>${act}</div>`;
  }
  renderSide();
}
async function sendReq(uid) {
  const rev = S.reqIn.find((r) => r.from === uid); if (rev) return acceptReq(rev);
  await setDoc(doc(db, 'friendRequests', `${S.user.uid}_${uid}`), { from: S.user.uid, to: uid, createdAt: serverTimestamp() });
  toast('Connection request sent'); S.searchRes = ''; S.searchQ = ''; renderSide();
}
async function acceptReq(r) {
  const me = S.user.uid, b = writeBatch(db);
  b.set(doc(db, 'users', me, 'friends', r.from), { since: serverTimestamp() });
  b.set(doc(db, 'users', r.from, 'friends', me), { since: serverTimestamp() });
  b.delete(doc(db, 'friendRequests', r.id));
  await b.commit(); toast(`You and ${r.user.displayName} are now connected`);
}
async function removeFriend(uid) {
  const me = S.user.uid, b = writeBatch(db);
  b.delete(doc(db, 'users', me, 'friends', uid)); b.delete(doc(db, 'users', uid, 'friends', me));
  await b.commit(); if (S.openChat?.other === uid) closeChat();
}

// ---------- call picker ----------
function openCallPicker() {
  const ov = document.createElement('div'); ov.className = 'modal'; ov.id = 'callPicker';
  const fs = [...S.friends.values()].sort((a, b) => (isActive(b) - isActive(a)) || a.displayName.localeCompare(b.displayName));
  ov.innerHTML = `<div class="card"><div style="display:flex;align-items:center"><h1 style="flex:1;text-align:left;font-size:20px">Call a friend</h1><button class="icon" id="cpx">✖</button></div>
    ${fs.length ? fs.map((f) => `<div class="row" data-callpick="${f.id}">${av(f, 44)}<div class="meta"><div class="name">${nameDot(f)}</div><div class="snip">${isActive(f) && f.inCall ? '<span class="sub2">Having a conversation</span>' : status(f)}</div></div>${phoneBtn(f.id, 'tabindex="-1"')}</div>`).join('') : '<div class="empty">No friends yet.</div>'}</div>`;
  document.body.append(ov);
  ov.onclick = (e) => { if (e.target === ov || e.target.closest('#cpx')) return ov.remove(); const r = e.target.closest('[data-callpick]'); if (r) { ov.remove(); startCall(r.dataset.callpick); } };
}

// ---------- compose ----------
function openCompose() {
  let to = null;
  const ov = document.createElement('div'); ov.className = 'modal'; ov.id = 'composeModal';
  ov.innerHTML = `<form class="card" id="cmf"><div style="display:flex;align-items:center"><h1 style="flex:1;text-align:left;font-size:20px">New message</h1><button type="button" class="icon" id="cx">✖</button></div>
    <div class="to"><b>To:</b><span id="tochip"></span><input id="toq" placeholder="Type a friend's name" autocomplete="off"></div><div id="tolist"></div>
    <textarea class="field" id="cmt" rows="3" placeholder="Message" style="border-radius:14px;resize:vertical"></textarea>
    <button class="btn" style="width:100%" id="cms" disabled>Send</button></form>`;
  document.body.append(ov);
  const upd = () => {
    const q = $('#toq', ov).value.trim().toLowerCase();
    const fs = [...S.friends.values()].filter((f) => !to && (!q || f.displayName.toLowerCase().includes(q) || f.username.includes(q))).slice(0, 8);
    $('#tolist', ov).innerHTML = to ? '' : fs.map((f) => `<div class="row" data-pick="${f.id}">${av(f, 36)}<div class="meta"><div class="name">${nameDot(f)}</div><div class="snip">@${esc(f.username)}</div></div></div>`).join('') || '<div class="empty" style="padding:8px">No matching friends</div>';
    $('#tochip', ov).innerHTML = to ? `<span class="chip">${esc(to.displayName)} <button type="button" id="unpick">✖</button></span>` : '';
    $('#toq', ov).style.display = to ? 'none' : '';
    $('#cms', ov).disabled = !(to && $('#cmt', ov).value.trim());
    $('#unpick', ov)?.addEventListener('click', () => { to = null; upd(); });
  };
  $('#toq', ov).oninput = upd; $('#cmt', ov).oninput = upd;
  $('#tolist', ov).onclick = (e) => { const r = e.target.closest('[data-pick]'); if (r) { to = S.friends.get(r.dataset.pick); upd(); $('#cmt', ov).focus(); } };
  $('#cx', ov).onclick = () => ov.remove();
  $('#cmf', ov).onsubmit = async (e) => {
    e.preventDefault(); const text = $('#cmt', ov).value.trim(); if (!to || !text) return;
    $('#cms', ov).disabled = true;
    const id = chatIdOf(S.user.uid, to.id);
    await setDoc(doc(db, 'chats', id), { members: [S.user.uid, to.id].sort() }, { merge: true });
    await sendMsg(id, to.id, text); ov.remove(); go('chats'); openChat(to.id);
  };
  upd(); $('#toq', ov).focus();
}

// ---------- chat ----------
function closeChat(keepTab) {
  S.chatUnsubs.forEach((u) => u()); S.chatUnsubs = []; S.openChat = null;
  $('#shell')?.classList.remove('chatting');
  const main = $('#main'); if (main) main.innerHTML = '<div class="placeholder"><div style="font-size:42px">💬</div><div>Select a chat</div></div>';
  if ($('#info')) $('#info').innerHTML = '';
  if (!keepTab) renderSide();
}
async function openChat(other) {
  const me = S.user.uid, id = chatIdOf(me, other);
  if (!S.friends.has(other)) { toast('You can only message friends'); return; }
  S.chatUnsubs.forEach((u) => u()); S.chatUnsubs = [];
  S.openChat = { id, other, data: S.chats.find((c) => c.id === id) || null }; S.msgs = [];
  $('#shell').classList.add('chatting');
  $('#main').innerHTML = `<div class="chead"><button class="icon back" id="back">←</button><div id="chav"></div><div class="meta"><div class="name" id="chn"></div><div class="st" id="chs"></div></div>
    ${phoneBtn(other, 'id="callbtn"')}</div><div class="msgs" id="msgs"></div>
    <form class="composer" id="cf"><button type="button" class="icon" id="emb">😊</button><textarea id="ta" rows="1" placeholder="Aa"></textarea><button class="icon" id="sendb" title="Send">➤</button></form>`;
  $('#back').onclick = () => closeChat();
  $('#callbtn').onclick = () => startCall(other);
  const ta = $('#ta'); let lastTyping = 0;
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
  await setDoc(doc(db, 'chats', id), { members: [me, other].sort() }, { merge: true }).catch(() => {});
  if (S.openChat?.id !== id) return;
  S.chatUnsubs.push(onSnapshot(query(collection(db, 'chats', id, 'messages'), orderBy('at', 'desc'), limit(200)), (snap) => {
    S.msgs = snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) })).reverse(); renderMsgs(); markRead();
  }, (e) => console.warn('msgs', e)));
  S.chatUnsubs.push(onSnapshot(doc(db, 'chats', id), (s) => { if (s.exists() && S.openChat?.id === id) { S.openChat.data = { id, ...s.data({ serverTimestamps: 'estimate' }) }; renderMsgs(); markRead(); } }));
  const tt = setInterval(renderMsgs, 3000); S.chatUnsubs.push(() => clearInterval(tt));
  renderSide();
  if (matchMedia('(min-width:761px)').matches) ta.focus();
}
function renderChatHead() {
  if (!S.openChat || !$('#chn')) return;
  const f = S.friends.get(S.openChat.other) || { displayName: 'Former friend' };
  $('#chav').innerHTML = av(f, 40); $('#chn').innerHTML = nameDot(f); $('#chs').textContent = status(f);
  $('#info').innerHTML = `<div style="display:flex;justify-content:center">${av(f, 80)}</div><h3 style="margin:10px 0 2px">${nameDot(f)}</h3>
    <div style="color:var(--muted)">@${esc(f.username)}</div><div style="color:var(--muted);font-size:13px;margin:4px 0 16px">${status(f)}</div>${phoneBtn(S.openChat.other)}`;
  $('#info [data-call]').onclick = () => startCall(S.openChat.other);
}
let lastMsgCount = 0;
function renderMsgs() {
  const box = $('#msgs'); if (!box || !S.openChat) return;
  const me = S.user.uid, other = S.openChat.other, c = S.openChat.data || {};
  const cleared = ms(c.clearedAt?.[me]);
  const msgs = S.msgs.filter((m) => (ms(m.at) || Date.now()) > cleared);
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
  let h = '', prev = 0;
  for (const m of msgs) {
    const t = ms(m.at) || Date.now();
    if (t - prev > 15 * 60000) h += `<div class="ts">${new Date(t).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</div>`;
    prev = t;
    const big = /^(\p{Extended_Pictographic}|\p{Emoji_Modifier}|\uFE0F|\u200D){1,8}$/u.test(m.text);
    h += `<div class="m ${m.from === me ? 'me' : ''} ${big ? 'big' : ''}" title="${esc(new Date(t).toLocaleString())}">${esc(m.text)}</div>`;
  }
  const last = msgs[msgs.length - 1];
  if (last && last.from === me) h += `<div class="seen" id="seen">${ms(c.read?.[other]) >= ms(last.at) && ms(last.at) ? 'Seen' : 'Sent'}</div>`;
  if (c.typing?.[other] && Date.now() - c.typing[other] < 6000) h += '<div class="typing" id="typing"><i></i><i></i><i></i></div>';
  if (!msgs.length) h = `<div class="placeholder">${av(S.friends.get(other), 72)}<div>Say hi to ${esc(S.friends.get(other)?.displayName || '')} 👋</div></div>`;
  box.innerHTML = h;
  if (nearBottom || msgs.length !== lastMsgCount) box.scrollTop = box.scrollHeight;
  lastMsgCount = msgs.length;
}
async function sendMsg(id, other, text) {
  const me = S.user.uid;
  await addDoc(collection(db, 'chats', id, 'messages'), { from: me, text, at: serverTimestamp() });
  await updateDoc(doc(db, 'chats', id), { lastMessage: text.slice(0, 100), lastAt: serverTimestamp(), lastFrom: me, [`unread.${other}`]: increment(1), [`typing.${me}`]: deleteField() });
}
function markRead() {
  const c = S.openChat; if (!c || document.visibilityState !== 'visible') return;
  const me = S.user.uid, d = c.data || {}, last = S.msgs[S.msgs.length - 1];
  // Write at most once per newest message (prevents a snapshot -> write -> snapshot loop).
  const key = `${last?.id || ''}|${d.unread?.[me] || 0}`;
  if (c.markedKey === key) return;
  if ((d.unread?.[me] || 0) > 0 || (last && last.from !== me && ms(d.read?.[me]) < ms(last.at))) {
    c.markedKey = key;
    updateDoc(doc(db, 'chats', c.id), { [`unread.${me}`]: 0, [`read.${me}`]: serverTimestamp() }).catch(() => { c.markedKey = null; });
  }
}

// ---------- voice calls (WebRTC + Firestore signaling) ----------
let audioCtx = null;
function tone(kind) {
  stopTone();
  try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume?.(); } catch { return; }
  const play = () => {
    const now = audioCtx.currentTime, g = audioCtx.createGain(); g.connect(audioCtx.destination);
    const seq = kind === 'ring' ? [[880, 0], [660, 0.2], [880, 0.4], [660, 0.6]] : [[440, 0], [480, 0]];
    const dur = kind === 'ring' ? 0.18 : 1.2;
    g.gain.setValueAtTime(0.0001, now);
    for (const [f, off] of seq) {
      const o = audioCtx.createOscillator(); o.frequency.value = f; o.connect(g); o.start(now + off); o.stop(now + off + dur);
      g.gain.setValueAtTime(0.15, now + off); g.gain.setValueAtTime(0.0001, now + off + dur);
    }
  };
  play(); S.toneTimer = setInterval(play, kind === 'ring' ? 2000 : 3000);
}
function stopTone() { clearInterval(S.toneTimer); }
const elapsed = () => Math.floor((Date.now() - (S.call?.startedAt || Date.now())) / 1000);

function callUI() {
  const c = S.call; if (!c) { $('#callov')?.remove(); return; }
  let ov = $('#callov'); if (!ov) { ov = document.createElement('div'); ov.id = 'callov'; ov.className = 'call'; document.body.append(ov); }
  const p = c.peer || {};
  const title = { incoming: 'Incoming Call', active: 'Active Phone Call', ended: 'Call Ended' }[c.state] || 'Outgoing Call';
  const st = { calling: 'Calling…', ringing: 'Ringing…', incoming: 'is calling you', connecting: 'Connecting…', active: '', ended: c.endText || 'Call ended' }[c.state];
  let btns = '';
  if (c.state === 'incoming') btns = `<button class="pill green" id="cacc">Pick Up</button><button class="pill red" id="cfwd">Forward It</button>`;
  else if (c.state !== 'ended') btns = `<div><button class="cb ${c.muted ? 'on' : ''}" id="cmute" title="Mute">${c.muted ? '🔇' : '🎤'}</button><div class="cblabel">${c.muted ? 'Unmute' : 'Mute'}</div></div>
    <div><button class="cb red" id="chang" title="Hang up">✆</button><div class="cblabel">Hang up</div></div>`;
  ov.dataset.state = c.state;
  ov.innerHTML = `<div class="ctitle" id="ctitle">${title}</div>${av(p, 120, false)}<h2 style="margin:6px 0 0;color:#fff">${esc(p.displayName || '')}</h2>
    <div class="st" id="cst">${st}</div><div class="timer" id="ctimer">${c.state === 'active' ? fmtDur(elapsed()) : ''}</div><div class="btns">${btns}</div>`;
  $('#cacc', ov)?.addEventListener('click', acceptCall);
  $('#cfwd', ov)?.addEventListener('click', forwardCall);
  $('#chang', ov)?.addEventListener('click', () => endCall('ended'));
  $('#cmute', ov)?.addEventListener('click', () => { c.muted = !c.muted; c.stream?.getAudioTracks().forEach((t) => (t.enabled = !c.muted)); callUI(); });
}
function newPC(callId, mySide, theirSide) {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  window.__pc = pc;
  const c = S.call;
  c.stream.getTracks().forEach((t) => pc.addTrack(t, c.stream));
  const sendCand = (cand) => addDoc(collection(db, 'calls', callId, mySide), cand).catch((er) => console.warn('ice', er));
  c.pendingCands = [];
  c.flushCands = () => { c.docReady = true; c.pendingCands.forEach(sendCand); c.pendingCands = []; };
  pc.onicecandidate = (e) => { if (!e.candidate) return; const j = e.candidate.toJSON(); if (c.docReady) sendCand(j); else c.pendingCands.push(j); };
  pc.ontrack = (e) => { if (!c.audio) { c.audio = new Audio(); c.audio.autoplay = true; } c.audio.srcObject = e.streams[0]; c.audio.play().catch(() => {}); };
  const onState = () => {
    const ok = pc.connectionState === 'connected' || ['connected', 'completed'].includes(pc.iceConnectionState);
    if (ok && S.call === c && c.state !== 'active' && c.state !== 'ended') {
      c.state = 'active'; c.startedAt = Date.now(); stopTone(); callUI();
      c.timer = setInterval(() => { const t = $('#ctimer'); if (t) t.textContent = fmtDur(elapsed()); }, 1000);
    }
    if (pc.connectionState === 'failed') endCall('ended', { text: 'Connection failed (network may need a TURN server)', outcome: 'failed' });
  };
  pc.onconnectionstatechange = onState; pc.oniceconnectionstatechange = onState;
  c.remoteCands = [];
  c.drainRemote = () => { if (!pc.remoteDescription) return; c.remoteCands.splice(0).forEach((d) => pc.addIceCandidate(new RTCIceCandidate(d)).catch((er) => console.warn('addIce', er))); };
  c.unsubs.push(onSnapshot(collection(db, 'calls', callId, theirSide), (snap) => {
    snap.docChanges().forEach((ch) => { if (ch.type === 'added') c.remoteCands.push(ch.doc.data()); });
    c.drainRemote();
  }, (er) => console.warn('cands', er)));
  return pc;
}
const getMic = () => navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
const setInCall = (v) => S.user && updateDoc(doc(db, 'users', S.user.uid), { inCall: v }).catch(() => {});

async function startCall(uid) {
  if (S.call) return toast('Already in a call');
  const peer = S.friends.get(uid); if (!peer) return toast('You can only call friends');
  const c = (S.call = { role: 'caller', peer, state: 'calling', unsubs: [] }); callUI();
  try { c.stream = await getMic(); } catch { return endCall(null, { text: 'Microphone access denied', outcome: 'failed' }); }
  if (S.call !== c) return;
  const ref = doc(collection(db, 'calls')); c.id = ref.id;
  // Create the call doc first so the rules (which look up caller/callee on it) allow candidate reads/writes.
  try { await setDoc(ref, { caller: S.user.uid, callee: uid, status: 'preparing', createdAt: serverTimestamp() }); }
  catch { return endCall(null, { text: 'Could not start call', outcome: 'failed' }); }
  if (S.call !== c) { deleteDoc(ref).catch(() => {}); return; }
  c.docReady = true;
  const pc = newPC(ref.id, 'callerCandidates', 'calleeCandidates'); c.pc = pc;
  const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
  try { await updateDoc(ref, { status: 'ringing', createdAt: serverTimestamp(), offer: { type: offer.type, sdp: offer.sdp } }); }
  catch (er) { console.warn('offer write failed', er); return endCall(null, { text: 'Could not start call', outcome: 'failed' }); }
  c.flushCands(); setInCall(true);
  if (c.state === 'calling') { c.state = 'ringing'; callUI(); tone('ringback'); }
  c.unsubs.push(onSnapshot(ref, async (s) => {
    if (S.call !== c) return;
    if (!s.exists()) return endCall(null, { outcome: c.startedAt ? 'completed' : 'cancelled' });
    const d = s.data();
    if (d.answer && !pc.currentRemoteDescription) { c.state = 'connecting'; stopTone(); callUI(); await pc.setRemoteDescription(new RTCSessionDescription(d.answer)); c.drainRemote(); }
    if (d.status === 'declined') endCall(null, { text: `${peer.displayName} didn't pick up`, outcome: 'declined' });
    else if (d.status === 'busy') endCall(null, { text: `${peer.displayName} is on another call`, outcome: 'busy' });
    else if (d.status === 'ended') endCall(null, { text: 'Call ended' });
    else if (d.status === 'missed') endCall(null, { text: 'No answer', outcome: 'missed' });
  }));
  c.ringTimeout = setTimeout(() => { if (S.call === c && ['ringing', 'calling'].includes(c.state)) endCall('missed', { text: 'No answer', outcome: 'missed' }); }, RING_TIMEOUT_MS);
}
async function onIncomingCall(snap) {
  const d = snap.data();
  if (ms(d.createdAt) && Date.now() - ms(d.createdAt) > RING_TIMEOUT_MS + 10000) return; // stale
  if (S.call) { updateDoc(snap.ref, { status: 'busy' }).catch(() => {}); logCall({ peer: d.caller, direction: 'incoming', outcome: 'missed', duration: 0 }); return; }
  const peer = await profile(d.caller);
  const c = (S.call = { role: 'callee', id: snap.id, peer, state: 'incoming', offer: d.offer, unsubs: [] });
  callUI(); tone('ring');
  c.unsubs.push(onSnapshot(snap.ref, (s) => {
    if (S.call !== c) return;
    if (!s.exists()) return endCall(null, { outcome: c.startedAt ? 'completed' : 'missed' });
    const st = s.data().status;
    if (st === 'ended' || st === 'missed') endCall(null, c.state === 'incoming' ? { text: `Missed call from ${peer.displayName}`, outcome: 'missed' } : { text: 'Call ended' });
  }));
  c.ringTimeout = setTimeout(() => { if (S.call === c && c.state === 'incoming') endCall('missed', { text: `Missed call from ${peer.displayName}`, outcome: 'missed' }); }, RING_TIMEOUT_MS + 2000);
}
async function acceptCall() {
  const c = S.call; if (!c || c.state !== 'incoming') return;
  stopTone(); clearTimeout(c.ringTimeout); c.state = 'connecting'; callUI();
  try { c.stream = await getMic(); } catch { return endCall('declined', { text: 'Microphone access denied', outcome: 'failed' }); }
  c.docReady = true;
  const pc = newPC(c.id, 'calleeCandidates', 'callerCandidates'); c.pc = pc; c.docReady = true;
  await pc.setRemoteDescription(new RTCSessionDescription(c.offer)); c.drainRemote();
  const ans = await pc.createAnswer(); await pc.setLocalDescription(ans);
  await updateDoc(doc(db, 'calls', c.id), { answer: { type: ans.type, sdp: ans.sdp }, status: 'active' });
  setInCall(true);
}
// "Forward It": decline and auto-message the caller.
async function forwardCall() {
  const c = S.call; if (!c || c.state !== 'incoming') return;
  const callerId = c.peer.id;
  await endCall('declined', { text: 'Call forwarded', outcome: 'declined' });
  const id = chatIdOf(S.user.uid, callerId);
  try {
    await setDoc(doc(db, 'chats', id), { members: [S.user.uid, callerId].sort() }, { merge: true });
    await sendMsg(id, callerId, FORWARD_MESSAGE);
  } catch (e) { console.warn('forward msg', e); }
}
function logCall(entry) {
  if (!S.user) return;
  addDoc(collection(db, 'users', S.user.uid, 'callHistory'), { ...entry, at: serverTimestamp() }).catch((e) => console.warn('history', e));
}
async function endCall(status, { silent = false, text = '', outcome = '' } = {}) {
  const c = S.call; if (!c || c.state === 'ended') return;
  stopTone(); clearTimeout(c.ringTimeout); clearInterval(c.timer);
  c.unsubs.forEach((u) => u());
  c.pc?.close(); c.stream?.getTracks().forEach((t) => t.stop()); if (c.audio) c.audio.srcObject = null;
  const duration = c.startedAt ? elapsed() : 0;
  c.state = 'ended'; c.endText = (text || 'Call ended') + (duration ? ` · ${fmtDur(duration)}` : '');
  logCall({ peer: c.peer.id, direction: c.role === 'caller' ? 'outgoing' : 'incoming', outcome: c.startedAt ? 'completed' : (outcome || 'cancelled'), duration });
  if (c.id && status) {
    const ref = doc(db, 'calls', c.id);
    await updateDoc(ref, { status }).catch(() => {});
    // Clean up signaling docs shortly after so the other side sees the final status.
    setTimeout(async () => {
      for (const side of ['callerCandidates', 'calleeCandidates']) {
        const s = await getDocs(collection(db, 'calls', c.id, side)).catch(() => null);
        s?.docs.forEach((d) => deleteDoc(d.ref).catch(() => {}));
      }
      deleteDoc(ref).catch(() => {});
    }, 2500);
  }
  setInCall(false);
  window.__lastCall = { endText: c.endText, wasActive: !!c.startedAt, duration };
  if (silent) { S.call = null; return callUI(); }
  callUI();
  setTimeout(() => { if (S.call === c) { S.call = null; callUI(); } }, 2000);
}
