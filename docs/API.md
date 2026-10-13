# API Reference

Base URL: `http://<host>:4000` (health: `GET /health`)

**Conventions**

- All responses are JSON envelopes:
  - Success: `{ "success": true, "data": <payload> }`
  - Error: `{ "success": false, "error": { "code", "message", "details?" } }`
- Validation failure → `422` with `error.details = [{ field, message }]`
- Auth: `Authorization: Bearer <JWT>` on every route except the two OTP endpoints.
- Pagination: `?page=1&limit=20` → `data = { items, total, page, limit }` (some list routes return a bare array).
- File uploads use `multipart/form-data` with field name `image`; images are served from `/uploads/<filename>`.
- Rate limits: `POST /api/auth/otp/*` is throttled per-IP; all `/api` routes sit behind a general limiter.

**Roles**: `resident` · `security` · `admin`

---

## Auth — `/api/auth`

| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| POST | `/otp/request` | public | `{ phone }` → `{ phone, devOtp? }`. In non-production the OTP is also returned/printed (`FIXED_DEV_OTP=123456`). |
| POST | `/otp/verify` | public | `{ phone, code, fcmToken?, platform? }` → `{ token, user, isNewUser }`. `user` is the public profile below. |
| GET | `/me` | any | Current user. |
| PATCH | `/me` | any | `{ full_name?, email?, avatar_url? }` (also used by the first-login profile setup). |
| POST | `/device` | any | `{ token, platform }` — registers an FCM device token for push. |
| POST | `/logout` | any | `{ token? }` — de-registers the device token. |

**Public user shape**

```json
{ "id": "u-1", "phone": "9000000003", "fullName": "Rahul Verma", "email": null,
  "role": "resident", "flatId": 3, "flatLabel": "A-1203", "avatarUrl": null,
  "joinedOn": "2026-01-04", "isActive": true }
```

---

## Visitors — `/api/visitors`

| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| POST | `/` | resident (pre-approved only), security/admin (any type) | Body: `visitorName` (req), `visitorPhone`, `visitorCount`, `purpose`, `vehicleNumber`, `passType` (`preapproved\|walkin\|delivery`), `deliveryVendor`, `remarks`, `validUntil`, `hostId`. Creates the pass and returns it including `otp_code`. |
| GET | `/?status=&page=&limit=&scope=all` | resident → own passes; admin/security + `scope=all` → community-wide (`q`, `from`, `to` supported) | |
| GET | `/inside` | admin, security | Everyone currently inside. |
| GET | `/:id` | owner or staff | Hosts see `otp_code`; staff other than admin do not. |
| GET | `/:id/logs` | owner or staff | Entry/exit/deny audit trail. |
| POST | `/:id/approve` · `/:id/reject` · `/:id/cancel` | owner (or admin) | Status transitions + notifications. |

**Pass statuses**: `pending → approved → checked_in → checked_out`, plus `rejected`, `cancelled`, `expired`.

---

## Gate / Security — `/api/security` (`security`, `admin`)

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| POST | `/verify` | `{ code, channel: "otp"\|"qr" }` | Resolves a 6-digit OTP or a `CC:{qr_token}` QR string; returns the matching pass. |
| POST | `/entry/:id` | `{ remarks? }` | Marks the visitor inside (`checked_in`) and logs the entry. |
| POST | `/exit/:id` | `{ remarks? }` | Marks the visitor out (`checked_out`). |
| POST | `/deny/:id` | `{ remarks? }` | Denies entry (`rejected`) and notifies the host. |
| GET | `/inside` | — | Same list as `/api/visitors/inside`. |
| GET | `/stats` | — | `{ byStatus: [{status,count}], todayEntries, currentlyInside }` (30-day window for `byStatus`). |

---

## Complaints — `/api/complaints`

| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| GET | `/categories` | any | `{ id, name, icon }` lookup. |
| POST | `/` | any | multipart `image` optional. Body: `title`, `description`, `categoryId`, `priority` (`low\|medium\|high`). Returns `reference_no` like `CC-20261008-0007`. |
| GET | `/?status=&page=&limit=` | any | Own complaints. |
| GET | `/all?status=&q=&categoryId=&page=` | admin, security | Community-wide queue. |
| GET | `/:id` | owner or admin | Includes `updates[]` timeline. |
| PATCH | `/:id/status` | admin | `{ status, note? }`. Allowed transitions: `submitted→in_progress`, `in_progress→resolved\|submitted`, `resolved→in_progress`. |

**Statuses**: `submitted`, `in_progress`, `resolved`.

---

## Bookings — `/api/bookings`

| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| GET | `/amenities` | any | Amenity directory (name, price, rules, slot config). |
| GET | `/slots?amenityId=1&date=YYYY-MM-DD[&onlyAvailable=true]` | any | Slot rows with `isAvailable`, `isMine`, `booking_id`. |
| POST | `/book` | any | `{ slotId, attendees?, notes? }` → `201`. Conflicts → `409`. |
| GET | `/?status=&page=` | any | Own booking history. |
| GET | `/upcoming` | any | Next confirmed bookings. |
| DELETE | `/:id` | owner | Cancels and frees the slot. |

### Admin amenities — `/api/admin/amenities` (`admin`)

| Method | Path | Body |
| --- | --- | --- |
| POST | `/:id/generate-slots` | `{ from, to }` (≤ 62 days) — idempotent per (amenity, date, start time). |
| PATCH | `/slots/:slotId/block` | `{ blocked?, reason? }` — refuses to block a slot with a confirmed booking. |
| GET | `/bookings?status=&amenityId=&page=` | All bookings with resident + slot details. |

---

## Marketplace — `/api/marketplace`

| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| GET | `/?q=&category=&minPrice=&maxPrice=&sort=&page=` | any | Approved listings only. |
| GET | `/mine?status=` | any | Own listings (all statuses). |
| GET | `/enquiries` | any | Messages you sent/received. |
| POST | `/` | any | multipart `image` optional. Body: `title`, `description`, `category`, `price`, `priceUnit?`, `contactPhone?`. Created as `pending`. |
| GET | `/:id` | any | Includes `views`, `categoryLabel`, seller name/flat (phone masked for non-owners). |
| POST | `/:id/contact` | any | `{ message? }` → notifies the seller, returns `sellerPhone`. |
| DELETE | `/:id` | owner or admin | |
| GET | `/api/marketplace/admin?status=&q=` | admin | All listings + `counts` by status. |
| PATCH | `/api/marketplace/admin/:id` | admin | `{ status: approved\|rejected\|sold\|inactive, reason? }` — notifies the seller. |

**Categories**: `homemade_food`, `jewellery`, `used_products`, `tuition`, `yoga_fitness`, `other`.

---

## Announcements — `/api/announcements`

| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| GET | `/?category=&page=&limit=` | any | Audience-filtered (`all` or your role), pinned first. |
| GET | `/:id` | any | |
| POST | `/api/announcements/admin` | admin | `{ title, body, category, is_pinned, audience }`, optional `image`. |
| PATCH | `/api/announcements/admin/:id` | admin | Same shape (full update). |
| DELETE | `/api/announcements/admin/:id` | admin | |

**Categories**: `general`, `maintenance`, `security`, `event`, `emergency`.
**Audiences**: `all`, `resident`, `security`, `admin`.

---

## Events — `/api/events`

| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| GET | `/?upcoming=true&page=` | any | Published/completed events, decorated with `isRegistered`, `registered_count`, `spotsLeft`, `registrationOpen`. |
| GET | `/mine` | any | Your registrations. |
| GET | `/:id` | any | |
| POST | `/:id/register` · `/:id/unregister` | any | Capacity-aware; notifies on success. |
| POST | `/api/events/admin` | admin | `{ title, description?, venue?, starts_at, ends_at?, capacity?, registration_deadline?, image_url? }` |
| PATCH | `/api/events/admin/:id/status` | admin | `{ status: draft\|published\|cancelled\|completed }` |

---

## Notifications — `/api/notifications` (auth)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/?type=&unread=true&limit=` | Array of `{ id, type, title, body, data, read_at, created_at }`. |
| GET | `/unread-count` | `{ count }` |
| POST | `/:id/read` | |
| POST | `/read-all` | `{ updated }` |

Types: `visitor`, `complaint`, `booking`, `announcement`, `event`, `marketplace`, `system`.
Push is best-effort: rows are always written, FCM is attempted only when `firebase-admin` is configured.

---

## Admin panel — `/api/admin` (`admin`)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/residents?q=&role=&page=&limit=` | Directory with flat labels. |
| POST | `/residents` | `{ phone, full_name?, email?, role?, flat_id? }` → `201`. |
| PATCH | `/residents/:id` | `{ full_name?, email?, role?, is_active?, flat_id?, clear_flat? }` |
| GET | `/flats` | Flat list with `resident_count`. |
| GET | `/reports` | Dashboard payload: |

```json
{ "overview": { "residents": 42, "complaintsOpen": 3, "complaintsResolved": 18,
    "visitorEntriesToday": 7, "visitorsInside": 4, "bookingsUpcoming": 9,
    "announcements": 12, "eventsUpcoming": 2, "listingsPending": 1 },
  "complaints": { "open": 3, "byStatus": [...], "byCategory": [...], "avgResolutionHours": 6.4 },
  "bookings":   { "today": 3, "upcoming": 9, "byAmenity": [...] },
  "visitors":   { "todayEntries": 7, "currentlyInside": 4, "byStatus": [...] },
  "events":     { "total": 4, "upcoming": 2, "registrations": 31 },
  "marketplace":[{ "status": "pending", "count": 1 }],
  "generatedAt": "2026-10-08T09:15:00.000Z" }
```

---

## Error codes

| Status | Meaning |
| --- | --- |
| 400 | Bad request / invalid state transition |
| 401 | Missing or invalid token, or deactivated account |
| 403 | Role or ownership check failed |
| 404 | Resource not found |
| 409 | Conflict (duplicate listing, slot already booked, phone already registered) |
| 413 | Upload too large |
| 422 | Validation failed (`error.details`) |
| 429 | Rate limited (OTP spam, global limiter) |
