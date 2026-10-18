// Rename the app here — this is the only place the name lives.
export const APP_NAME = 'TDM Chat';

// Firebase web config is public by design; access is enforced by Firestore security rules.
export const firebaseConfig = {
  apiKey: 'AIzaSyDUCCsYG1YnjAtf2MY_rs5AdTmwZCBfzA8',
  authDomain: 'tdm-chat-804774.firebaseapp.com',
  projectId: 'tdm-chat-804774',
  storageBucket: 'tdm-chat-804774.firebasestorage.app',
  messagingSenderId: '347614884761',
  appId: '1:347614884761:web:3bb911afc2cfba5fbf9908',
};

// Public Google STUN only. Without a TURN server, some strict-NAT / cellular networks can't connect.
export const ICE_SERVERS = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
];

export const HEARTBEAT_MS = 45_000;
export const STALE_MS = 2 * 60_000;
export const RING_TIMEOUT_MS = 30_000;
