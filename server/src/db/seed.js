const fs = require('fs');
const path = require('path');
const { createDb } = require('./pool');
const config = require('../config');
const { generateSlots } = require('../modules/bookings/policy');

function localDate(offsetDays) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

async function seedSlots(db) {
  const amenities = await db.many('SELECT * FROM amenities WHERE is_active = 1');
  let created = 0;
  for (const amenity of amenities) {
    const days = Number(amenity.advance_days) || 7;
    for (let i = 0; i <= days; i += 1) {
      const dateISO = localDate(i);
      const slots = generateSlots(
        {
          openTime: amenity.open_time,
          closeTime: amenity.close_time,
          slotMinutes: amenity.slot_minutes,
        },
        dateISO
      );
      for (const slot of slots) {
        const res = await db.query(
          `INSERT INTO amenity_slots (amenity_id, slot_date, start_time, end_time)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (amenity_id, slot_date, start_time) DO NOTHING`,
          [amenity.id, dateISO, slot.startTime, slot.endTime]
        );
        created += res.rowCount;
      }
    }
  }
  console.log(`✓ slots  ${created} new amenity slots`);
}

async function seed() {
  const db = createDb(config.sqlitePath);
  const files = fs
    .readdirSync(path.join(__dirname, '..', '..', 'migrations'))
    .filter((f) => f.endsWith('.sql') && f.includes('seed'))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(__dirname, '..', '..', 'migrations', file), 'utf8');
    await db.exec(sql);
    console.log(`✓ seeded ${file}`);
  }
  await seedSlots(db);
  await db.close();
  console.log('Seed complete.');
}

if (require.main === module) {
  seed().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { seed, seedSlots };
