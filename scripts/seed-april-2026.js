// scripts/seed-april-2026.js
// One-time seed for April 2026 pay period (Mar 26 – Apr 24, 2026)
// Run: node scripts/seed-april-2026.js

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const BILLABLE = 'MEW - Admin/Non Billable';

// ISO week numbers for 2026 are calculated same way as app.js getWeekNumber()
// Mar 26-27 = week 13, Mar 30-Apr 3 = week 14, Apr 6-10 = week 15,
// Apr 13-17 = week 16, Apr 20-24 = week 17

const entries = [
  // Mar 26-27 (week 13)
  { date: '2026-03-26', week_number: 13, time_in: '09:00', time_out: '17:00', notes: null },
  { date: '2026-03-27', week_number: 13, time_in: '09:00', time_out: '17:00', notes: null },

  // Mar 30 – Apr 3 (week 14)
  { date: '2026-03-30', week_number: 14, time_in: '09:00', time_out: '17:00', notes: null },
  { date: '2026-03-31', week_number: 14, time_in: '09:00', time_out: '17:00', notes: null },
  { date: '2026-04-01', week_number: 14, time_in: '08:00', time_out: '15:00', notes: null },  // 7h
  { date: '2026-04-02', week_number: 14, time_in: '09:00', time_out: '17:00', notes: null },
  { date: '2026-04-03', week_number: 14, time_in: '09:00', time_out: '17:00', notes: null },

  // Apr 6-10 (week 15)
  { date: '2026-04-06', week_number: 15, time_in: '09:00', time_out: '17:00', notes: null },
  { date: '2026-04-07', week_number: 15, time_in: '09:00', time_out: '17:00', notes: null },
  { date: '2026-04-08', week_number: 15, time_in: '08:00', time_out: '15:00', notes: null },  // 7h
  { date: '2026-04-09', week_number: 15, time_in: '09:00', time_out: '17:00', notes: '3h on MVH - Standard HMI Screens Project; 3h on Val metal Integration Project' },
  { date: '2026-04-10', week_number: 15, time_in: '09:00', time_out: '17:00', notes: '3h on MVH - Standard HMI Screens Project; 2h on Val metal Integration Project' },

  // Apr 13-17 (week 16)
  { date: '2026-04-13', week_number: 16, time_in: '09:00', time_out: '17:00', notes: null },
  { date: '2026-04-14', week_number: 16, time_in: '09:00', time_out: '17:00', notes: '2h on MVH Meeting - Standard HMI Screens Project' },
  { date: '2026-04-15', week_number: 16, time_in: '08:00', time_out: '16:00', notes: null },
  { date: '2026-04-16', week_number: 16, time_in: '09:00', time_out: '17:00', notes: '1h on GVT Support; 1h MVH Pending List from the meeting' },
  { date: '2026-04-17', week_number: 16, time_in: '09:00', time_out: '17:00', notes: '3h on MVH - Standard HMI Screens Project/Blowers Project' },

  // Apr 20-24 (week 17)
  { date: '2026-04-20', week_number: 17, time_in: '09:00', time_out: '17:00', notes: '1h Automation Sync Meeting; 30min MVH - Paques data Meeting; 40m MBD Ticket; 45m RRA CC Tunning; 2h MVH HMI Screens Improvement' },
  { date: '2026-04-21', week_number: 17, time_in: '09:00', time_out: '17:00', notes: '1h HPT Support; 30m GVT Support; 6h MVH SCADA/PLC' },
  { date: '2026-04-22', week_number: 17, time_in: '08:00', time_out: '16:00', notes: '1h GVT Support; 5h MVH HMI SCADA/PLC' },
  { date: '2026-04-23', week_number: 17, time_in: '09:00', time_out: '17:00', notes: '30m GVT Support; 1h MVH HMI SCADA/PLC; 5h GVD PLC/SCADA Programming' },
  { date: '2026-04-24', week_number: 17, time_in: '08:00', time_out: '16:00', notes: null },
];

async function seed() {
  const client = await pool.connect();
  try {
    let inserted = 0;
    for (const e of entries) {
      const tIn  = new Date(`1970-01-01T${e.time_in}`);
      const tOut = new Date(`1970-01-01T${e.time_out}`);
      const hours = (tOut - tIn) / (1000 * 60 * 60);

      await client.query(
        `INSERT INTO timesheet_entries (date, week_number, schedule, billable_to, project_task, time_in, time_out, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [e.date, e.week_number, 'Schedule 1', BILLABLE, BILLABLE, e.time_in, e.time_out, e.notes]
      );
      console.log(`  ✓ ${e.date}  ${e.time_in}–${e.time_out}  (${hours}h)`);
      inserted++;
    }
    console.log(`\nDone — ${inserted} entries inserted.`);
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => { console.error(err); process.exit(1); });
