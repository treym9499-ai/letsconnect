# TDM Chat (working name)

Messenger-style web app: email/password auth, @username friends + requests, real-time presence ("Active Friends"),
1:1 real-time chat (seen / typing / unread), and 1:1 WebRTC voice calls with Firestore signaling.

- Frontend: Vite + vanilla JS, deployed to GitHub Pages by `.github/workflows/pages.yml` on every push to `main`.
- Backend: Firebase (Spark/free) — Authentication (Email/Password) + Cloud Firestore. Rules in `firestore.rules`.
- **Rename the app:** edit `APP_NAME` in `src/config.js`.

## Develop / deploy
```
npm install && npm run dev                  # local
npx firebase-tools deploy --only firestore  # rules + indexes
git push                                    # frontend deploy via Actions
```

## Data model
- `users/{uid}` public profile + presence (`lastActive`, `online`, `inCall`) — no email stored.
- `usernames/{name}` → `{uid}` (uniqueness).
- `users/{uid}/friends/{friendUid}`; `friendRequests/{from}_{to}`.
- `chats/{uidA}_{uidB}` (sorted) with `messages` subcollection; `unread`, `read`, `typing` maps.
- `calls/{id}` with `offer/answer/status` + `callerCandidates`/`calleeCandidates`; deleted after the call.

## Known limits
- Presence: heartbeat every 45 s while tab visible; >2 min stale = offline.
- Calls use public Google STUN only — no TURN. Users behind symmetric/strict NAT or some cellular carriers may fail to connect.
  Add a TURN server (e.g. a free tier from Metered/Twilio, or self-hosted coturn) to `ICE_SERVERS` in `src/config.js`.
- No push notifications: incoming calls/messages only arrive while the app is open in a tab.
- Firestore Spark quotas: 50k reads / 20k writes / 20k deletes per day, 1 GiB storage.
