# LetsConnect

Messenger-style web app (black + neon-green theme): Google sign-in or email/password, @username friends + requests, real-time presence ("Active Friends"),
1:1 real-time chat (seen / typing / unread), and 1:1 WebRTC voice calls with Firestore signaling (Pick Up / Forward It), call history, swipe-to-delete conversations.

- Frontend: Vite + vanilla JS, deployed to GitHub Pages by `.github/workflows/pages.yml` on every push to `main`.
- Backend: Firebase (Spark/free) — Authentication (Email/Password) + Cloud Firestore. Rules in `firestore.rules`.
- **Rename the app:** edit `APP_NAME` in `src/config.js`.

## Develop / deploy
```
npm install && npm run dev                  # local
npx firebase-tools deploy --only firestore  # rules + indexes
git push                                    # frontend deploy via Actions
```

## Behaviour notes
- A conversation row appears in Chats only after the first message.
- **Delete conversation** (swipe left, right-click, or ⋯ on desktop) is per-user: it stores `clearedAt.{uid}` on the chat; the
  row and all older messages are hidden for you only. If the friend messages again, the row reappears with only the new messages.
  The other person keeps their full history.
- **Forward It** declines the call and sends the caller: "They didn't want to answer 🤷🏻‍♂️".
- Presence includes `inCall`, so friends see "Having a conversation".
- Each user's call log lives in `users/{uid}/callHistory` (owner-only).
- Local testing: `npx firebase-tools emulators:start --only auth,firestore` + `npm run build && npx vite preview`, open `http://localhost:4173/?emu=1`; `test/e2e.cjs` runs with `EMU=1`.

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
