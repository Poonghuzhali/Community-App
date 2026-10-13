# Design Spec — Community Connect

A Figma-ready handoff: design tokens first, then component anatomy, then per-screen specs. Every token below maps 1:1 to `mobile/src/theme/index.js`, so engineers can build straight from this document.

---

## 1. Foundations

### 1.1 Colour tokens

| Token | Value | Use |
| --- | --- | --- |
| `color/primary` | `#1B4D3E` | Brand, primary buttons, active tab, active chip |
| `color/primary-dark` | `#12362B` | Pressed states, splash background |
| `color/primary-light` | `#E6F1ED` | Icon tiles, badges, secondary fills |
| `color/accent` | `#F2A65A` | Highlights, pinned markers, QR frame |
| `color/accent-dark` | `#D98B3B` | Accent text on light backgrounds |
| `color/bg` | `#F6F8F7` | App canvas |
| `color/card` | `#FFFFFF` | Cards, sheets, modals |
| `color/border` | `#E2E8E5` | Hairlines, input borders |
| `color/text` | `#14201C` | Primary text |
| `color/text-muted` | `#5F6F69` | Secondary text |
| `color/text-inverse` | `#FFFFFF` | Text on brand |
| `color/success` `#2E9E5B` / `success-bg` `#E5F6EC` | Positive status |
| `color/warning` `#E1A100` / `warning-bg` `#FDF3DC` | Pending, blocked |
| `color/danger` `#D64545` / `danger-bg` `#FCE9E9` | Destructive, emergency |
| `color/info` `#2F6FED` / `info-bg` `#E7EEFE` | Neutral info, inside-state |
| `color/grey` `#8A9791` / `grey-bg` `#EEF1F0` | Disabled, empty |
| `color/overlay` | `rgba(9,20,16,.55)` | Modal scrim |

**Status pill palette** (label auto-generated from status):

| Status | BG / FG | Label |
| --- | --- | --- |
| `pending` | warning-bg / `#9A7100` | Pending |
| `approved`, `published`, `confirmed`, `registered` | success-bg / success | Approved / Published / Confirmed / Registered |
| `rejected`, `cancelled` | danger-bg / grey-bg | Rejected / Cancelled |
| `checked_in` | info-bg / info | Inside |
| `checked_out`, `expired`, `sold`, `inactive`, `draft` | grey-bg / muted | Exited / Expired / Sold / Inactive / Draft |
| `submitted` | info-bg / info | Submitted |
| `in_progress` | warning-bg / `#9A7100` | In Progress |
| `resolved`, `completed` | success-bg, info-bg | Resolved / Completed |
| `preapproved` | primary-light / primary | Pre-approved |
| `walkin` | info-bg / info | Walk-in |
| `delivery` | warning-bg / `#9A7100` | Delivery |

### 1.2 Type scale

| Style | Size / weight / tracking | Use |
| --- | --- | --- |
| `h1` | 26 / 800 / −0.4 | Screen titles (large header) |
| `h2` | 20 / 700 / −0.2 | Visitor name, big numbers |
| `h3` | 17 / 700 / 0 | Section + small-header titles |
| `body` | 15 / 400 / 22 lh | Default content |
| `small` | 13 / 400 / 18 lh | Supporting copy |
| `tiny` | 11 / 400 / +0.3 | Meta rows, timestamps, labels |
| `button` | 15 / 700 / +0.2 | Button labels |

Font: system default (Roboto on Android, SF on iOS).

### 1.3 Spacing & radius

Spacing scale: `4 · 8 · 12 · 16 · 24 · 32` (`xs sm md lg xl xxl`).
Screen padding: **16**. Card padding: **16**. Gap between cards: **12–16**.

Radius: `8 sm` (inputs) · `12 md` (cards-in-card, thumbnails, slots) · `16 lg` (modals) · `24 xl` · `999 pill`.

Shadows: `card = { y4, blur12, 6% #0B1F19 }`, `float = { y8, blur16, 18% }`.

---

## 2. Core components

| Component | Anatomy | States / rules |
| --- | --- | --- |
| **Screen** | Canvas + optional ScrollView + keyboard avoidance | Bottom padding 64; `contentStyle` overrides horizontal padding for full-bleed lists |
| **AppHeader** | Back (22px chevron, hitSlop 10) · title (+subtitle) · right slot | `large` → `h1`, else `h3`; max 1 line, ellipsis |
| **Button** | 52h · radius pill · icon 18 · label `button` | Variants: `primary`, `secondary` (primary-light), `outline` (1.5 border), `danger`; `small` = 40h/13 label; `loading` swaps label for spinner; `disabled` = 40% opacity |
| **Input** | Label `tiny/700` + field: 1.5 border, radius 12, pad 12, bg `bg` | Focus → primary border; `error` → danger border + message; optional leading icon 17; `multiline` aligns top, min-height 96 |
| **SearchBar** | Row: search icon 17 · input · clear (x) | bg card, 1px border, radius 12, 10 v-padding |
| **Card** | White, radius 16, hairline border, `shadow.card` | Optional `onPress` → activeOpacity .85 |
| **StatusPill** | Pill, pad `3/9`, `tiny/800` uppercase-friendly | Palette from §1.1; unknown status → grey |
| **Chip** | Pill, 1.5 border, pad `8/14`, 13/700 | `active` → primary fill + inverse text |
| **Avatar** | Circle, initials `h3` inverse on brand; sizes 40/42/56/78 | Colour derived from name hash |
| **StatCard** | Label `tiny` · value 26/800 · icon tile 36 on 12% tint | Used in dashboard 2-up grid |
| **ListRow** | Icon tile 38 · title + subtitle · chevron | Divider between rows |
| **EmptyState** | Icon 44 · title `h3` · message `small` centred | Used in every list |
| **Banner** | Full-width bar, icon + message + close | Types: info / success / danger |
| **Loader** | Spinner + label centred in canvas | Full-screen while booting |
| **QRView** | `react-native-qrcode-svg`, 200 default | Value `CC:{qr_token}` |

**Modal pattern**: scrim + bottom sheet (forms) or centred card (confirmations) — padding 24, radius 16, actions in a row: outline = cancel (flex 1), primary = confirm (flex 1.3).

---

## 3. Navigation

```
AuthStack            Login → Otp → ProfileSetup   (initialRouteName = ProfileSetup when needsProfile)
├─ ResidentStack     Tabs{ Home, Visitors, Complaints, Bookings, Market }
│                    + VisitorCreate/Detail, ComplaintCreate/Detail, BookingHistory,
│                      MarketCreate/Detail, Announcements, EventDetail, Notifications, Profile
├─ SecurityStack     Tabs{ Gate, Inside, History } + VisitorDetail, Profile
└─ AdminStack        Tabs{ Dashboard, Residents, AdminComplaints, AdminMarket, More }
                     + AdminVisitors, AdminContent, AdminAmenities, ComplaintDetail,
                       MarketDetail, VisitorDetail, EventDetail, Notifications, Profile
```

Tab bar: 62h, white, top hairline, labels 11/700, active = primary, icons filled when focused.

---

## 4. Screen specs

### 4.1 Auth

**Login** — Logo/title block on brand-tinted hero · phone field (10 digits, numeric keypad) · primary “Send OTP” · footnote “You will receive a 6-digit code”. Errors appear as danger Banner above the button.

**Otp** — 6-box code display backed by one numeric input (auto-submit at 6 digits) · resend timer (30 s) · “Change number” back link.

**ProfileSetup** — Avatar placeholder · full name (required) · email (optional) · helper copy about flat assignment · “Continue”. Success → resident stack.

### 4.2 Resident

**Home** — Greeting + avatar (tap → Profile) · notification bell with unread `Badge` · 2×2 quick actions (Pre-approve visitor, Raise complaint, Book amenity, Marketplace) · cards: *Pending visitors*, *Open complaints*, *Upcoming bookings*, *Latest notices* (3 rows each + “See all”).

**Visitors (list)** — Segmented status filter chips (All/Pending/Approved/Inside/Left) · rows: name, purpose, date, `StatusPill` · pending rows show Approve/Cancel · FAB-style header action → **VisitorCreate**.

**VisitorCreate** — Name, mobile, count, purpose chips, vehicle, validity (today+1) · primary “Create pass” → success sheet with **big 6-digit OTP + QR** and a Share button.

**VisitorDetail** — Pass card: name, host flat, purpose, vehicle, validity, status · `QRView` for the host · staff-only row: Entry / Exit / Deny · audit log timeline (action, actor, time).

**Complaints** — Filter chips + open count · rows: title, `reference_no`, category, `StatusPill`, and a 3-step progress track (Submitted → In progress → Resolved) · header action → **ComplaintCreate**.

**ComplaintCreate** — Category grid (icon + name) · title · description · priority chips · optional photo (library → preview, 5 MB cap) · submit → detail screen.

**ComplaintDetail** — Status pill + reference · image (if any) · progress track · resolution note when resolved · `updates[]` timeline · admin: status action sheet with note field.

**Bookings** — Amenity cards (name, price, location, hours) → date strip (14 days, horizontal) → **slot grid 3-up**: free (success-bg), booked (grey), blocked (warning) · tap free slot → confirm sheet (attendees, notes) → success.

**BookingHistory** — Filter chips · rows: amenity, date/time, status pill, Cancel (enabled until 30 min before).

**Marketplace** — Search + category chips + sort · 2-column cards (image, title, price, seller flat) · “Add listing” header action → **MarketCreate**.

**MarketDetail** — Hero image (230h) or placeholder · title + price + category pill · description card · seller card (avatar, name, flat, masked phone) · primary “Contact seller” → message sheet → success shows seller phone · owner: Mark sold / Delete; admin: Approve / Reject card.

**MarketCreate** — Category chips · title/description/price/price-unit/contact · photo picker (1:1 crop) · note: “hidden until admin approves”.

**Announcements** — Tabs: Notices / Events · notice rows: category pill, pin icon, title, body preview, relative time · event rows: date chip, venue, registered count, Register/Registered button · header “New” is admin-only.

**EventDetail** — Date block (day/month) + title + venue + status · About card · registration card (registered → cancel; else Register, disabled when closed).

**Notifications** — Unread subtitle + “Mark all” · type filter chips · rows: tinted icon tile, title, body, time, unread dot · tap marks read.

**Profile** — Big avatar, name, masked phone, role pill · flat details card · preferences card · Edit (modal) · Log out (confirm).

### 4.3 Security

**Gate** — Header with duty subtitle · verify card: segmented OTP/QR + oversized code field (24/800, letter-spaced) + Verify/Scan · full-screen **scanner** (dark canvas, 240 square accent frame, hint text) · matched-pass card: name, host, phone, vehicle, purpose, valid-until → Entry / Exit / Deny buttons · “Recent at the gate” list.

**Inside** — Stat trio (Inside now / Today's entries / 30-day passes) · rows: name, dot for delivery, host flat, entry time, red **Exit** button · header “Log” opens walk-in sheet (Walk-in / Delivery chips → name, mobile, vendor/purpose, vehicle).

**History** — Search (name/flat/vehicle) + status chips · rows: name, type, host, vehicle, created/entry/exit times, status pill · infinite scroll.

### 4.4 Admin

**Dashboard** — Greeting + refresh + bell · 8 stat cards (Residents, Open complaints, Visitors inside, Entries today, Upcoming bookings, Pending listings, Announcements, Upcoming events) · “Complaint health” bar chart by status + avg resolution hours · “Busiest amenities” bars · 4 quick actions · generated-at footnote.

**Residents** — Search + role chips · rows: avatar, name, phone, flat, role pill, active toggle · “Add” → modal (phone, name, email, role chips, flat chips) · tap row → same modal in edit mode.

**AdminComplaints** — Search + status chips · rows: priority dot, title, reference, resident, flat, category, status pill · tap → ComplaintDetail (admin status flow).

**AdminMarket** — Search + status chips (default *Pending*) · rows: thumbnail, title, price, seller, status · pending rows get inline ✓/✗ with confirm dialog.

**AdminVisitors** — Stats trio + search + status chips · paginated rows → VisitorDetail.

**AdminContent** — Tabs Notices/Events + “New” · notice cards with pin/delete actions · event cards with status chips (draft/published/cancelled/completed) · modals: notice (title, body, category, audience, pin) and event (title, description, venue, date + time pickers, capacity).

**AdminAmenities** — Amenity chips · date navigator (‹ today ›) + legend · **slot grid** (tap to block/unblock; booked slots locked) · “Generate slots” card (from/to, max 62 days) · recent bookings list with status pills.

**More** — Profile card · grouped links (Operations / Community) · Log out · version.

---

## 5. Interaction & accessibility rules

- Every tappable row/card uses `activeOpacity 0.7–0.85`; hit targets ≥ 44×44.
- Destructive actions always require a confirm dialog (destructive style).
- Errors surface as danger `Banner` (inline, dismissible) — never a silent failure.
- Lists show `Loader` on first paint, pull-to-refresh afterwards, `EmptyState` when empty.
- Long text: titles `numberOfLines={1}`, body copy `2`.
- Phone numbers are masked (`90000…0003`) in any list/detail visible to non-hosts.
- Colour is never the only signal: every status also carries a text label.

---

## 6. Assets

| Asset | Size | Spec |
| --- | --- | --- |
| `assets/icon.png` | 1024×1024 | Brand `#1B4D3E`, white circle with accent ring, no transparency |
| `assets/adaptive-icon.png` | 1024×1024 | Same mark, 60px safe margin (Android mask) |
| `assets/splash.png` | 1284×2778 | Brand background, centred mark |
| `assets/favicon.png` | 48×48 | Mark only |

Generated by `node mobile/scripts/generate-assets.js` — replace with final art at the same dimensions.

Notifications channel colour: `#1B4D3E` (declared in `app.json` plugins).
