# Community Connect

A residential-community app: pre-approved visitors at the gate, complaint tracking, amenity bookings, a resident marketplace, announcements/events and an in-app admin panel — built as one Expo (React Native) app plus a Node/Express API on SQLite.

---

## What is inside

| Folder | What it is |
| --- | --- |
| `server/` | Express REST API, SQL migrations, seed data, 56 automated tests (built-in `node:test`) |
| `mobile/` | Expo SDK 53 app — resident, security and admin roles in one binary |
| `docs/` | API reference, database schema, test report, design spec, APK build guide |

### Feature set

**Resident**
- Mobile OTP login (dev OTP is `123456`), first-login profile setup
- Home dashboard: quick actions, pending visitors, open complaints, upcoming bookings, notices
- Visitors: pre-approve a guest → 6-digit gate OTP + `CC:{token}` QR, live status, cancel
- Complaints: raise with photo, category, priority; live status track and history
- Bookings: amenity → date → slot grid → confirm; history and cancellation
- Marketplace: browse/search approved listings, contact the seller, post your own listing (admin-approved)
- Announcements & events: notices by category, event registration
- Notifications feed with unread count and mark-read

**Security**
- Gate verification: OTP or QR scan → entry / exit / deny
- Walk-in & delivery logging with host notification
- Live "currently inside" list with one-tap exit and shift stats
- Full searchable visitor history

**Admin (role-gated screens inside the same app)**
- Dashboard with report cards and complaint/booking breakdowns
- Residents directory: search, create, change role/flat, deactivate
- Complaints queue with status transitions
- Marketplace moderation (approve/reject)
- Visitor management, announcements & events authoring, amenity slot generation/blocking
- More tab → account, notifications, logout

---

## Quick start

### 1. API

```bash
cd server
npm install
copy .env.example .env      # SQLITE_PATH defaults to server/data/community.db
npm run migrate             # creates the SQLite file and applies migrations
npm run seed                # demo flats, users, amenities, slots, notices
npm run dev                 # http://localhost:4000
```

Health check: `GET http://localhost:4000/health`

### 2. App

```bash
cd mobile
npm install
npm start                   # Expo dev server → scan the QR with Expo Go
```

Point the app at your machine (same Wi-Fi) by editing `mobile/app.json` → `expo.extra.apiUrl`, or create `mobile/.env`:

```
EXPO_PUBLIC_API_URL=http://192.168.1.5:4000
```

### 3. Demo logins (seeded)

| Role | Phone | OTP |
| --- | --- | --- |
| Admin (Aarav Sharma) | `9000000001` | `123456` |
| Security | `9000000002` | `123456` |
| Resident (Rahul Verma) | `9000000003` | `123456` |
| Resident | `9000000004` | `123456` |
| Resident | `9000000005` | `123456` |

---

## Verification commands

```bash
# server: 56 tests (validators, OTP, policies, auth middleware, notifications, HTTP API)
cd server  &&  npm test

# mobile: Babel-parses every source file
cd mobile  &&  npm run lint

# mobile: full Android JS bundle (proves every import resolves)
cd mobile  &&  npx expo export -p android --output-dir dist
```

---

## Documentation

- [docs/API.md](docs/API.md) — every endpoint, request/response shape
- [docs/DATABASE.md](docs/DATABASE.md) — tables, constraints, relationships, seed data
- [docs/TESTING.md](docs/TESTING.md) — test strategy and full results
- [docs/DESIGN_SPEC.md](docs/DESIGN_SPEC.md) — Figma-style design system + screen specs
- [docs/BUILD_APK.md](docs/BUILD_APK.md) — producing a installable Android APK

---

## Architecture notes

- `server/src/container.js` builds services with a `db` interface (`query/one/many/scalar/tx`); `server/src/app.js` wires routes. Tests inject fakes — no database needed.
- Auth is stateless JWT (`sub`, `role`, `phone`, `name`, `flat`) issued after OTP verification; OTPs are stored SHA-256 hashed and salted by phone number, and rate-limited.
- Notifications are a database table (always shown in-app) plus best-effort Firebase Cloud Messaging via `firebase-admin`; push silently no-ops when credentials are absent.
- Roles are enforced twice: `requireRole` middleware at the route, and navigation stacks chosen by `user.role` in `mobile/src/navigation/RootNavigator.js`.
