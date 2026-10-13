# Testing Report

**Server: 56 tests, 56 passing** · **Mobile: 43 files parse-clean, Android bundle exports successfully**

---

## 1. How to run

```bash
cd server
npm test                 # node --test --test-reporter spec  (no DB, no network)
```

```bash
cd mobile
npm run lint             # Babel-parses every .js file (scripts/check-syntax.js)
npx expo export -p android --output-dir dist    # full Metro bundle = every import resolves
```

Environment: Node 25, Windows PowerShell. Tests use the built-in Node test runner — no Jest, no Supertest, no Docker.

---

## 2. Strategy

| Layer | Approach |
| --- | --- |
| Pure logic (validators, OTP, policies) | Direct unit tests against exported functions. |
| Middleware (`requireAuth`, `requireRole`) | Run against a hand-built `req/res/next` and assert the error/status. |
| Services (notifications) | In-memory fake `db` returning canned rows; assert SQL-side effects (rows written) and push calls. |
| HTTP surface | Real Express app via `createApp(fakeContainer)` + `fetch` on an ephemeral port. Fakes are injected through the same DI container production uses. |

Because `createApp(container)` never touches a real database, the entire suite runs in ~1.2 s with zero external dependencies.

---

## 3. Results by file

### `validators.test.js` (8)
str required/max · int range · bool coercion · oneOf enum · phone normalisation (`+91`, `0` prefix) · `shape` collects **every** field error rather than failing fast · isoDate rejects junk.

### `otp.test.js` (4)
6-digit codes never start with 0 · the same code hashes differently per phone (salted) · correct code accepted / wrong rejected · a hash issued for phone A cannot verify phone B.

### `policies.test.js` (12)
- **Visitor**: legal status transitions; only the host may approve/reject; gate entry rules; exit only while checked in; `verifyAtGate` rejects missing/rejected passes.
- **Complaint**: transitions cannot skip stages (`submitted → resolved` blocked); ownership protects other residents' complaints; reference format `CC-YYYYMMDD-0007`.
- **Bookings**: `generateSlots` builds a complete day grid and never overflows the closing time; `assertBookable` blocks taken/blocked/past slots; cancellations close 30 minutes before the slot.

### `auth-middleware.test.js` (8)
Missing token · garbage token · valid token loads the user · token for a deleted user · deactivated account locked out · `requireRole` allows listed roles and blocks others · 401 when unauthenticated · `optionalAuth` passes anonymous requests through.

### `notifications.test.js` (6)
Single-user notify writes a row **and** pushes to that user's devices · broadcast reaches every active user · role-targeted notify only hits that role · no device tokens → no push attempt (the regression fixed earlier) · `unreadCount`/`markAllRead` only touch the caller's feed · `markRead` ignores somebody else's notification.

### `api.test.js` (18) — end-to-end over HTTP
health without auth · structured 404 · OTP request validation · OTP verify → token → `/me` profile · wrong OTP rejected · protected routes need a token · resident blocked from `/api/admin/reports` · admin gets the dashboard report · complaint validation returns 422 with field details · resident creates + lists a complaint · **`/api/complaints/all` is admin/security-only (403 for residents)** · resident cannot approve another host's pass · resident cannot create a walk-in pass (403) · pre-approval returns the gate OTP · gate verification accepts the right OTP and rejects junk · marketplace moderation is admin-only · notifications feed + unread counter · booking flow (amenities → slot validation → cancel).

---

## 4. Latest run

```
ℹ tests 56
ℹ suites 0
ℹ pass 56
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1163
```

## 5. Mobile checks

| Check | Command | Result |
| --- | --- | --- |
| Syntax / JSX parse | `npm run lint` | `Checked 43 files • 0 with syntax errors` |
| Import resolution | `node scripts/check-syntax.js` + import audit | 0 missing relative imports |
| Dependency alignment | `npx expo install --check` | `Dependencies are up to date` (SDK 53) |
| Production bundle | `npx expo export -p android` | `_expo/static/js/android/index-*.hbc (4.08 MB)` — 1389 modules bundled |

---

## 6. Manual QA checklist

**Login** → request OTP (`123456`) → profile setup on first login → land on the right stack for your role.

**Resident**: create a visitor pass and read the OTP/QR → raise a complaint with a photo → book an amenity slot and cancel it → post a listing (stays *pending*) → browse announcements, register for an event → open notifications and mark all read.

**Security**: verify the resident's OTP at the gate → record entry → log a walk-in and a delivery → exit a visitor from *Inside* → search history.

**Admin**: dashboard cards → add a resident and assign a flat → move a complaint `submitted → in_progress → resolved` → approve/reject the pending listing → publish an announcement and pin it → generate amenity slots and block one → deactivate a resident.

**Regression hot spots**: double-booking a slot (expect `409`), wrong-OTP gate verify (expect `404/400`), resident hitting any `/api/admin/*` route (expect `403`), FCM unconfigured (app must not crash on notifications).
