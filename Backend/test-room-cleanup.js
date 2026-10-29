// Test script to verify the room cleanup logic for expired memberships
// This can be run manually to test the fix before deploying

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'),
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testRoomCleanup() {
  try {
    console.log('=== Testing Hostel Room Cleanup Logic ===\n');

    // 1. Check for students with expired memberships who still have room assignments
    console.log('1. Checking for expired memberships with room assignments...');
    const expiredWithRooms = await pool.query(`
      SELECT hs.id, hs.name, hs.room_number, hs.room_id,
             MAX(hsh.stay_end_date) as latest_end_date
      FROM hostel_students hs
      LEFT JOIN hostel_student_history hsh ON hs.id = hsh.student_id
      WHERE hs.room_id IS NOT NULL
      AND hs.is_deleted IS NOT TRUE
      GROUP BY hs.id, hs.name, hs.room_number, hs.room_id
      HAVING MAX(hsh.stay_end_date) < CURRENT_DATE
    `);

    if (expiredWithRooms.rowCount > 0) {
      console.log(`Found ${expiredWithRooms.rowCount} expired student(s) with room assignments:`);
      expiredWithRooms.rows.forEach(row => {
        console.log(`  - ${row.name} (ID: ${row.id}), Room: ${row.room_number}, Expired: ${row.latest_end_date}`);
      });
    } else {
      console.log('  ✓ No expired memberships found with room assignments.');
    }

    // 2. Test the seat availability query (should NOT show expired students as occupying seats)
    console.log('\n2. Testing seat availability query...');
    const seatsQuery = await pool.query(`
      SELECT hs.id, hs.seat_number, hs.branch_id,
             s.id as student_id, s.name as student_name,
             MAX(hsh.stay_end_date) as latest_end_date
      FROM hostel_seats hs
      LEFT JOIN hostel_students s ON s.room_id = hs.id 
        AND s.is_deleted IS NOT TRUE
        AND EXISTS (
          SELECT 1 FROM hostel_student_history hsh 
          WHERE hsh.student_id = s.id 
          AND hsh.stay_end_date >= CURRENT_DATE
        )
      LEFT JOIN hostel_student_history hsh ON s.id = hsh.student_id
      GROUP BY hs.id, hs.seat_number, hs.branch_id, s.id, s.name
      ORDER BY hs.seat_number ASC
      LIMIT 20
    `);

    console.log(`  Total seats checked: ${seatsQuery.rowCount}`);
    const occupied = seatsQuery.rows.filter(r => r.student_id).length;
    const available = seatsQuery.rowCount - occupied;
    console.log(`  Available seats: ${available}`);
    console.log(`  Occupied seats (with active memberships): ${occupied}`);

    // 3. Simulate the cleanup (DRY RUN - no actual update)
    console.log('\n3. Simulating cleanup (DRY RUN)...');
    const cleanupPreview = await pool.query(`
      SELECT hs.id, hs.name, hs.room_number, hs.room_id
      FROM hostel_students hs
      WHERE hs.room_id IS NOT NULL
      AND hs.is_deleted IS NOT TRUE
      AND NOT EXISTS (
        SELECT 1 FROM hostel_student_history hsh
        WHERE hsh.student_id = hs.id
        AND hsh.stay_end_date >= CURRENT_DATE
      )
    `);

    if (cleanupPreview.rowCount > 0) {
      console.log(`  Would free ${cleanupPreview.rowCount} room(s):`);
      cleanupPreview.rows.forEach(row => {
        console.log(`    - Student: ${row.name} (ID: ${row.id}), Room: ${row.room_number}`);
      });
    } else {
      console.log('  ✓ No rooms need to be freed.');
    }

    console.log('\n=== Test Complete ===');
    console.log('\nTo actually run the cleanup, the cron job will execute daily at midnight.');
    console.log('Or you can manually run the UPDATE query from the cron job.');

  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    await pool.end();
  }
}

testRoomCleanup();
