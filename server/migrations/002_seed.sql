-- Demo data. Safe to run more than once.

INSERT INTO flats (block, flat_number, floor, bhk) VALUES
  ('A','101',1,3),('A','102',1,2),('A','201',2,3),('A','305',3,2),
  ('B','101',1,3),('B','202',2,4),('B','404',4,2),('C','101',1,3)
ON CONFLICT (block, flat_number) DO NOTHING;

INSERT INTO users (phone, full_name, email, role, flat_id, joined_on)
VALUES
  ('9000000001','Aarav Sharma','aarav@example.com','admin',
     (SELECT id FROM flats WHERE block='A' AND flat_number='101'),'2024-01-15'),
  ('9000000002','Priya Menon','priya@example.com','security',NULL,'2024-02-01'),
  ('9000000003','Rahul Verma','rahul@example.com','resident',
     (SELECT id FROM flats WHERE block='B' AND flat_number='202'),'2024-03-10'),
  ('9000000004','Sneha Iyer','sneha@example.com','resident',
     (SELECT id FROM flats WHERE block='A' AND flat_number='305'),'2024-06-20'),
  ('9000000005','Vikram Singh','vikram@example.com','resident',
     (SELECT id FROM flats WHERE block='C' AND flat_number='101'),'2025-01-05')
ON CONFLICT (phone) DO NOTHING;

INSERT INTO complaint_categories (name, icon, description) VALUES
  ('Plumbing','water','Water leakage, taps, blocked drains'),
  ('Electrical','zap','Power, lights, sockets, fans'),
  ('Housekeeping','sparkles','Cleaning, waste, common areas'),
  ('Lift','arrow-up-down','Lift breakdowns and maintenance'),
  ('Security & Parking','shield','Gate, CCTV, parking issues'),
  ('Pest Control','bug','Cockroaches, mosquitoes, rodents'),
  ('Other','circle-dashed','Anything not listed above')
ON CONFLICT (name) DO NOTHING;

INSERT INTO amenities (name, description, icon, location, capacity, open_time, close_time, slot_minutes, advance_days) VALUES
  ('Gym','Cardio + strength equipment','dumbbell','Clubhouse Level 1',25,'05:30','22:00',60,7),
  ('Community Hall','Events, parties, meetings','calendar','Clubhouse Level 2',120,'08:00','23:00',180,14),
  ('Badminton Court','Indoor courts','activity','Sports Block',8,'06:00','22:00',60,7),
  ('Swimming Pool','25m pool','waves','Tower C Deck',30,'06:00','20:00',60,3),
  ('Kids Play Area','Soft play zone','smile','Central Garden',20,'08:00','19:00',90,7),
  ('Party Lawn','Open air lawn','trees','East Gate Lawn',80,'09:00','22:00',120,14)
ON CONFLICT (name) DO NOTHING;

INSERT INTO announcements (author_id, title, body, category, is_pinned)
SELECT u.id, v.title, v.body, v.category, v.pinned
FROM (
  SELECT 'Water supply will be paused on Sunday 6 AM - 10 AM for tank cleaning' AS title,
         'Kindly store water on Saturday night. Bottled water will be available at the clubhouse.' AS body,
         'maintenance' AS category, 1 AS pinned
  UNION ALL
  SELECT 'New QR based visitor entry is now live',
         'Pre-approve your guests from the app. Security will scan the QR at the gate.',
         'security', 0
  UNION ALL
  SELECT 'Annual Diwali celebration on 8th Nov',
         'Potluck dinner, cultural program and lantern lighting at the Central Garden. Register from the Events tab.',
         'event', 0
) v
JOIN users u ON u.role = 'admin'
WHERE NOT EXISTS (SELECT 1 FROM announcements a WHERE a.title = v.title);

INSERT INTO events (author_id, title, description, venue, starts_at, ends_at, capacity, registration_deadline, status)
SELECT u.id, v.title, v.description, v.venue, v.starts_at, v.ends_at, v.capacity, v.deadline, 'published'
FROM (
  SELECT 'Diwali Night 2026' AS title,
         'Lantern lighting, diyas, music and a community potluck.' AS description,
         'Central Garden' AS venue,
         date_add(now(), '+21 days') AS starts_at,
         date_add(now(), '+21 days 4 hours') AS ends_at,
         150 AS capacity,
         date_add(now(), '+18 days') AS deadline
  UNION ALL
  SELECT 'Morning Yoga Workshop',
         'Free hatha yoga session led by a certified instructor from Block C.',
         'Party Lawn',
         date_add(now(), '+7 days'),
         date_add(now(), '+7 days 2 hours'),
         40,
         date_add(now(), '+6 days')
  UNION ALL
  SELECT 'Residents Town Hall',
         'Monthly meeting with the managing committee and the security supervisor.',
         'Community Hall',
         date_add(now(), '+12 days'),
         date_add(now(), '+12 days 2 hours'),
         120,
         date_add(now(), '+11 days')
) v
JOIN users u ON u.role = 'admin'
WHERE NOT EXISTS (SELECT 1 FROM events e WHERE e.title = v.title);

INSERT INTO marketplace_listings (seller_id, category, title, description, price, price_unit, status, contact_phone)
SELECT u.id, v.category, v.title, v.description, v.price, v.unit, 'approved', u.phone
FROM (
  SELECT '9000000003' AS phone, 'homemade_food' AS category, 'Homemade Millet Cookies' AS title,
         'Fresh batch of jowar + ragi cookies, no refined sugar. Jain friendly.' AS description,
         250.00 AS price, 'per box' AS unit
  UNION ALL
  SELECT '9000000004', 'tuition', 'Maths Tuition - Class 8 to 10',
         'CBSE/ICSE maths coaching at Block A. 5 years experience.', 1500.00, 'per month'
  UNION ALL
  SELECT '9000000005', 'yoga_fitness', 'Home Yoga Sessions',
         'Personal yoga for seniors and beginners, 4 sessions a week.', 1200.00, 'per month'
  UNION ALL
  SELECT '9000000003', 'used_products', 'Kids Cycle - 16 inch',
         '2 year old cycle, in great condition, size for 6-9 yrs.', 2000.00, 'one-time'
) v
JOIN users u ON u.phone = v.phone
WHERE NOT EXISTS (SELECT 1 FROM marketplace_listings m WHERE m.title = v.title);
