

I'm continuing work on a D&D campaign tracker called **Dead Signal**. The code is in this repo and was previously scaffolded by another Claude instance with the explicit goal of being Firebase-ready. I'm Trevor, a developer. I need you to help me wire up Firebase Auth + Firestore + Storage to replace the current localStorage adapter.

### What's already done

- **Architecture**: clean adapter pattern. The data layer in `js/data.js` is a thin wrapper that delegates to whatever adapter is imported at the top. Currently uses `js/adapters/localStorageAdapter.js`. The Firebase adapter stub is at `js/adapters/firebaseAdapter.js` with TODO markers on every method.
- **Auth**: `js/auth.js` is a similar passthrough. Currently uses `sessionStorage` for fake "sessions". DM signs in (no password, just creates a uid). Players join with a 6-char campaign code + their name.
- **Three pages**: `index.html` (landing/join), `pages/dm.html` (DM dashboard), `pages/play.html` (player view), `pages/summary.html` (session recaps).
- **Mobile-first CSS**: design system in `css/styles.css`. All breakpoints scale up from mobile baseline. 44px tap targets, sticky bottom tabbar on mobile only, bottom-sheet modals.
- **Quota guard**: `js/data.js` has a daily circuit breaker that tracks reads/writes/uploads per day in localStorage and stops the service from running once thresholds are crossed. Adjust constants in `QUOTA` object.
- **All UI talks to dataLayer only** — no UI code reaches into localStorage directly. Swapping the adapter should require zero UI changes.

### Collections used by the app

```
players  — { id, name, hp, maxHp, inf, hum, mods, tiers, primaries, items, notes, publicNotes }
enemies  — { id, name, hp, maxHp, tier, sts, notes, dead }
quests   — { id, title, desc, status }      // status: active|secret|completed|failed
maps     — { id, title, imageUrl, description, visibleToPlayers }
notes    — { id, body }                      // id='dm' for the DM's private notepad
scenes   — { id, title, desc, updatedAt }    // id='current' for the active scene
summaries — { id, title, body, sessionDate }
```

### What I need you to do

1. **Multi-tenancy.** Each campaign should be isolated. Use a Firestore structure like `/campaigns/{campaignId}/{collection}/{docId}`. Read the campaignId from the authenticated user's session — store it during `auth.signInDM()` (DM creates a new campaign on first sign-in, gets a code) and during `auth.joinAsPlayer(code, name)` (player validates the code and joins).

2. **Auth model:**
   - **DM**: Google sign-in via `signInWithPopup(auth, GoogleAuthProvider)`. On first sign-in, generate a campaign code (use `auth.generateCampaignCode()` already in `auth.js`), create `/campaigns/{code}` with `{ ownerUid: user.uid, createdAt }`. On subsequent sign-ins, look up the campaign owned by this UID.
   - **Player**: anonymous sign-in (`signInAnonymously`). The campaign code + their entered name becomes their identity. Store `playerId` linking them to a player doc. There's an existing pattern in play.js: it auto-links by name match, but you should improve this — when a player joins, check if a player doc with their name exists, otherwise create a new player doc and store the playerId on the auth.

3. **Firestore security rules** (suggested):
   ```
   match /campaigns/{campaignId} {
     allow read: if request.auth != null;
     allow write: if request.auth != null && resource.data.ownerUid == request.auth.uid;
     match /{collection}/{docId} {
       allow read: if request.auth != null;
       allow write: if request.auth != null;
       // tighten this later — currently any authed user in any campaign can write to any doc
     }
   }
   ```

4. **Realtime mixed pattern (per spec):**
   - DM dashboard uses `onSnapshot` for everything — it's command center, live is fine.
   - Player dashboard uses `onSnapshot` for `players` (their own HP) and `scenes` (current scene). Uses one-shot `getDocs` for `quests`, `maps` — refreshed via the existing pull-to-refresh in `js/ui.js` (`attachPullToRefresh`). The wiring for that is already in `play.js`.

5. **Image uploads.** Implement `uploadImage(file)` to:
   - Upload to Firebase Storage at `campaigns/{campaignId}/uploads/{timestamp}_{filename}`
   - Return the download URL via `getDownloadURL`
   - Keep base64 fallback only for tiny images (< 100kb) if you want to skip the round-trip, otherwise always upload to Storage.

6. **Quota guard.** The existing client-side quota in `data.js` is a soft cap. Add a Firestore-backed daily counter at `/campaigns/{campaignId}/_meta/quota` that increments on every write and is checked before reads/writes. If you want to be extra safe, set up Firebase Cloud Function budget alerts and disable the API at the Firebase project level if billing crosses a threshold — there's no in-app way to truly prevent fees, only soft caps.

### Files you should NOT need to touch

- `js/pages/dm.js`, `js/pages/play.js` — UI only, talks to dataLayer
- `js/ui.js` — UI primitives
- `js/constants.js` — shared model factories
- `css/styles.css` — design system
- HTML files — static markup

### Files you WILL touch

- `js/adapters/firebaseAdapter.js` — implement all stubs
- `js/auth.js` — replace passthrough methods with Firebase Auth calls
- `js/data.js` — change one import line to swap adapters
- `index.html` — add Firebase SDK script tags or use ES modules from CDN

### What I want from you in this conversation

- Don't refactor the UI code. The architecture is intentional.
- Match the function signatures of `localStorageAdapter` exactly so swapping is trivial.
- Use Firebase v9+ modular SDK (the `firebase/app`, `firebase/firestore` style).
- When you finish, give me Firestore security rules and Storage rules to paste into the Firebase console.
- Tell me the exact files I need to edit at the end so I can verify nothing was missed.

Start by reading `js/data.js`, `js/adapters/localStorageAdapter.js`, `js/adapters/firebaseAdapter.js`, and `js/auth.js`. Then propose your implementation plan before writing code.

## Copy until here ⬆

---

## Setup steps you'll do before pasting that

1. **Create a Firebase project** at console.firebase.google.com
2. **Enable Authentication**: Google sign-in + Anonymous
3. **Enable Firestore Database** in production mode
4. **Enable Storage**
5. **Copy your Firebase config** from Project Settings → Your apps → Web app → Config object
6. Paste it into `js/adapters/firebaseAdapter.js` where the `firebaseConfig` object is
7. Set up a billing budget alert in GCP Console for the Firebase project, capped low (e.g. $5/month) — this is your real safety net against runaway costs, the in-app quota guard is just a soft layer

## Notes

- Mark's localStorage data won't migrate automatically. If he's been using it, his existing campaigns are gone when you flip the adapter. Worth warning him.
- The DM uid → campaign mapping needs to be reliable. If Mark signs in on a different browser, you'll need a way to either look up his existing campaign or let him "claim" it with the code.
- The auto-link-by-name in `play.js` is fragile — players need to type their name exactly matching the player doc Mark created. Consider improving this so Mark can drag-and-drop a player onto a joining player.

### Deferred Features
- **Character Avatars**: Profile picture uploads and displaying character avatars in the DM/Player dashboard have been temporarily removed. We will readdress this feature in the future when we have more time.
