-- Community Connect schema (SQLite)

CREATE TABLE IF NOT EXISTS flats (
  id              TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
  block           TEXT NOT NULL,
  flat_number     TEXT NOT NULL,
  floor           INTEGER,
  bhk             INTEGER,
  is_occupied     INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (now()),
  UNIQUE (block, flat_number)
);

CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
  phone           TEXT NOT NULL UNIQUE,
  full_name       TEXT,
  email           TEXT,
  role            TEXT NOT NULL DEFAULT 'resident'
                    CHECK (role IN ('resident','security','admin')),
  flat_id         TEXT REFERENCES flats(id) ON DELETE SET NULL,
  avatar_url      TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1,
  joined_on       TEXT,
  created_at      TEXT NOT NULL DEFAULT (now()),
  updated_at      TEXT NOT NULL DEFAULT (now())
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_flat ON users(flat_id);

CREATE TABLE IF NOT EXISTS otp_codes (
  id              TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
  phone           TEXT NOT NULL,
  code            TEXT NOT NULL,
  purpose         TEXT NOT NULL DEFAULT 'login'
                    CHECK (purpose IN ('login','visitor_approval')),
  attempts        INTEGER NOT NULL DEFAULT 0,
  expires_at      TEXT NOT NULL,
  consumed_at     TEXT,
  created_at      TEXT NOT NULL DEFAULT (now())
);

CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes(phone, purpose, created_at DESC);

CREATE TABLE IF NOT EXISTS device_tokens (
  id              TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token           TEXT NOT NULL,
  platform        TEXT DEFAULT 'android',
  last_seen_at    TEXT NOT NULL DEFAULT (now()),
  UNIQUE (user_id, token)
);

CREATE TABLE IF NOT EXISTS visitor_passes (
  id                TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
  host_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  visitor_name      TEXT NOT NULL,
  visitor_phone     TEXT,
  visitor_count     INTEGER NOT NULL DEFAULT 1,
  purpose           TEXT NOT NULL DEFAULT 'Guest',
  vehicle_number    TEXT,
  pass_type         TEXT NOT NULL DEFAULT 'preapproved'
                      CHECK (pass_type IN ('preapproved','walkin','delivery')),
  delivery_vendor   TEXT,
  qr_token          TEXT NOT NULL UNIQUE DEFAULT (gen_random_uuid()),
  otp_code          TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','approved','rejected',
                                        'checked_in','checked_out','expired')),
  valid_from        TEXT NOT NULL DEFAULT (now()),
  valid_until       TEXT NOT NULL DEFAULT (date_add(now(), '+12 hours')),
  approved_by       TEXT REFERENCES users(id) ON DELETE SET NULL,
  verified_by       TEXT REFERENCES users(id) ON DELETE SET NULL,
  entry_at          TEXT,
  exit_at           TEXT,
  remarks           TEXT,
  created_at        TEXT NOT NULL DEFAULT (now()),
  updated_at        TEXT NOT NULL DEFAULT (now())
);

CREATE INDEX IF NOT EXISTS idx_visitor_host   ON visitor_passes(host_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitor_status ON visitor_passes(status, created_at DESC);

CREATE TABLE IF NOT EXISTS visitor_logs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_id      TEXT NOT NULL REFERENCES visitor_passes(id) ON DELETE CASCADE,
  action          TEXT NOT NULL
                    CHECK (action IN ('requested','approved','rejected','entry',
                                      'exit','denied','otp_verified','qr_verified')),
  performed_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
  performer_role  TEXT,
  remarks         TEXT,
  created_at      TEXT NOT NULL DEFAULT (now())
);

CREATE INDEX IF NOT EXISTS idx_visitor_logs_visitor ON visitor_logs(visitor_id, created_at DESC);

CREATE TABLE IF NOT EXISTS complaint_categories (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL UNIQUE,
  icon            TEXT,
  description     TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sequences (
  name            TEXT PRIMARY KEY,
  value           INTEGER NOT NULL
);

INSERT INTO sequences (name, value) VALUES ('complaint_ref', 1000)
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS complaints (
  id              TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
  reference_no    TEXT NOT NULL UNIQUE,
  raised_by       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id     INTEGER NOT NULL REFERENCES complaint_categories(id),
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  image_url       TEXT,
  priority        TEXT NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('low','medium','high')),
  status          TEXT NOT NULL DEFAULT 'submitted'
                    CHECK (status IN ('submitted','in_progress','resolved')),
  assigned_to     TEXT REFERENCES users(id) ON DELETE SET NULL,
  resolution_note TEXT,
  created_at      TEXT NOT NULL DEFAULT (now()),
  updated_at      TEXT NOT NULL DEFAULT (now()),
  resolved_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_complaints_user   ON complaints(raised_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status, created_at DESC);

CREATE TABLE IF NOT EXISTS complaint_updates (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  complaint_id    TEXT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  from_status     TEXT,
  to_status       TEXT NOT NULL,
  note            TEXT,
  actor_id        TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (now())
);

CREATE TABLE IF NOT EXISTS amenities (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL UNIQUE,
  description     TEXT,
  icon            TEXT,
  location        TEXT,
  capacity        INTEGER,
  open_time       TEXT NOT NULL DEFAULT '06:00',
  close_time      TEXT NOT NULL DEFAULT '22:00',
  slot_minutes    INTEGER NOT NULL DEFAULT 60,
  advance_days    INTEGER NOT NULL DEFAULT 7,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (now())
);

CREATE TABLE IF NOT EXISTS amenity_slots (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  amenity_id      INTEGER NOT NULL REFERENCES amenities(id) ON DELETE CASCADE,
  slot_date       TEXT NOT NULL,
  start_time      TEXT NOT NULL,
  end_time        TEXT NOT NULL,
  is_blocked      INTEGER NOT NULL DEFAULT 0,
  blocked_reason  TEXT,
  created_at      TEXT NOT NULL DEFAULT (now()),
  UNIQUE (amenity_id, slot_date, start_time),
  CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_slots_lookup ON amenity_slots(amenity_id, slot_date);

CREATE TABLE IF NOT EXISTS bookings (
  id              TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
  slot_id         INTEGER NOT NULL REFERENCES amenity_slots(id) ON DELETE CASCADE,
  amenity_id      INTEGER NOT NULL REFERENCES amenities(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attendees       INTEGER NOT NULL DEFAULT 1,
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'confirmed'
                    CHECK (status IN ('confirmed','cancelled')),
  booked_at       TEXT NOT NULL DEFAULT (now()),
  cancelled_at    TEXT,
  cancelled_by    TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_booking_slot
  ON bookings(slot_id) WHERE status = 'confirmed';

CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id, booked_at DESC);

CREATE TABLE IF NOT EXISTS marketplace_listings (
  id              TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
  seller_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category        TEXT NOT NULL
                    CHECK (category IN ('homemade_food','jewellery','used_products',
                                        'tuition','yoga_fitness','other')),
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  price           REAL NOT NULL DEFAULT 0,
  price_unit      TEXT DEFAULT 'one-time',
  image_url       TEXT,
  contact_phone   TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected','sold','inactive')),
  rejection_reason TEXT,
  approved_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
  views           INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (now()),
  updated_at      TEXT NOT NULL DEFAULT (now())
);

CREATE INDEX IF NOT EXISTS idx_listings_status ON marketplace_listings(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_search ON marketplace_listings(status, category);

CREATE TABLE IF NOT EXISTS listing_enquiries (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id      TEXT NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  buyer_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message         TEXT,
  is_read         INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (now())
);

CREATE TABLE IF NOT EXISTS announcements (
  id              TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
  author_id       TEXT REFERENCES users(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'general'
                    CHECK (category IN ('general','maintenance','security','event','emergency')),
  image_url       TEXT,
  is_pinned       INTEGER NOT NULL DEFAULT 0,
  audience        TEXT NOT NULL DEFAULT 'all'
                    CHECK (audience IN ('all','resident','security','admin')),
  published_at    TEXT NOT NULL DEFAULT (now()),
  created_at      TEXT NOT NULL DEFAULT (now())
);

CREATE INDEX IF NOT EXISTS idx_announcements_feed ON announcements(published_at DESC);

CREATE TABLE IF NOT EXISTS events (
  id              TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
  author_id       TEXT REFERENCES users(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  venue           TEXT,
  starts_at       TEXT NOT NULL,
  ends_at         TEXT,
  image_url       TEXT,
  capacity        INTEGER,
  registration_deadline TEXT,
  status          TEXT NOT NULL DEFAULT 'published'
                    CHECK (status IN ('draft','published','cancelled','completed')),
  created_at      TEXT NOT NULL DEFAULT (now())
);

CREATE TABLE IF NOT EXISTS event_registrations (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'registered'
                    CHECK (status IN ('registered','cancelled')),
  created_at      TEXT NOT NULL DEFAULT (now()),
  UNIQUE (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         TEXT REFERENCES users(id) ON DELETE CASCADE,
  type            TEXT NOT NULL
                    CHECK (type IN ('visitor','complaint','booking','announcement',
                                    'event','marketplace','system')),
  title           TEXT NOT NULL,
  body            TEXT,
  data            TEXT NOT NULL DEFAULT '{}',
  read_at         TEXT,
  created_at      TEXT NOT NULL DEFAULT (now())
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_users_updated
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
  UPDATE users SET updated_at = now() WHERE id = NEW.id AND updated_at = OLD.updated_at;
END;

CREATE TRIGGER IF NOT EXISTS trg_visitor_updated
AFTER UPDATE ON visitor_passes
FOR EACH ROW
BEGIN
  UPDATE visitor_passes SET updated_at = now() WHERE id = NEW.id AND updated_at = OLD.updated_at;
END;

CREATE TRIGGER IF NOT EXISTS trg_complaint_updated
AFTER UPDATE ON complaints
FOR EACH ROW
BEGIN
  UPDATE complaints SET updated_at = now() WHERE id = NEW.id AND updated_at = OLD.updated_at;
END;

CREATE TRIGGER IF NOT EXISTS trg_listing_updated
AFTER UPDATE ON marketplace_listings
FOR EACH ROW
BEGIN
  UPDATE marketplace_listings SET updated_at = now() WHERE id = NEW.id AND updated_at = OLD.updated_at;
END;
