const { checkAdminOrStaff } = require('./auth');

module.exports = (pool) => {
  const router = require('express').Router();

  router.get('/', checkAdminOrStaff, async (req, res) => {
    try {
      const { branch_id } = req.query;
      const params = [];

      let queryText = `
        SELECT hs.id, hs.seat_number, hs.branch_id,
               hb.name as branch_name,
               s.id as student_id, s.name as student_name
        FROM hostel_seats hs
        LEFT JOIN hostel_branches hb ON hs.branch_id = hb.id
        LEFT JOIN hostel_students s ON s.room_id = hs.id
        WHERE 1=1
      `;

      if (branch_id !== undefined && branch_id !== null && String(branch_id).trim() !== '') {
        const branchIdNum = parseInt(branch_id, 10);
        if (isNaN(branchIdNum)) {
          return res.status(400).json({ message: 'Invalid branch ID format for filtering.' });
        }
        params.push(branchIdNum);
        queryText += ` AND hs.branch_id = $${params.length}`;
      }

      queryText += ' ORDER BY hs.seat_number ASC';

      const result = await pool.query(queryText, params);
      const seats = result.rows.map((row) => ({
        id: row.id,
        seatNumber: row.seat_number,
        branchId: row.branch_id,
        branchName: row.branch_name,
        isAssigned: !!row.student_id,
        studentId: row.student_id,
        studentName: row.student_name,
      }));

      res.json({ seats });
    } catch (err) {
      console.error('Error fetching hostel seats:', err);
      res.status(500).json({ message: 'Server error fetching hostel seats', error: err.message });
    }
  });

  router.post('/', checkAdminOrStaff, async (req, res) => {
    try {
      const { seat_numbers, branch_id } = req.body;
      if (!branch_id) {
        return res.status(400).json({ message: 'branch_id is required' });
      }
      const branchIdNum = parseInt(branch_id, 10);
      if (isNaN(branchIdNum)) {
        return res.status(400).json({ message: 'Invalid branch_id' });
      }

      if (!seat_numbers) {
        return res.status(400).json({ message: 'seat_numbers is required' });
      }

      const seatArray = String(seat_numbers)
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s);

      if (seatArray.length === 0) {
        return res.status(400).json({ message: 'No seat numbers provided' });
      }

      const branchCheck = await pool.query('SELECT 1 FROM hostel_branches WHERE id = $1', [branchIdNum]);
      if (branchCheck.rows.length === 0) {
        return res.status(400).json({ message: `Branch with ID ${branchIdNum} does not exist.` });
      }

      const existingSeats = await pool.query(
        'SELECT seat_number FROM hostel_seats WHERE branch_id = $1 AND seat_number = ANY($2)',
        [branchIdNum, seatArray]
      );

      if (existingSeats.rows.length > 0) {
        const existingNumbers = existingSeats.rows.map((row) => row.seat_number);
        return res.status(400).json({ message: `Seats already exist: ${existingNumbers.join(', ')}` });
      }

      const insertQuery =
        'INSERT INTO hostel_seats (seat_number, branch_id) VALUES ' +
        seatArray.map((_, i) => `($${i + 1}, $${seatArray.length + 1})`).join(', ');

      await pool.query(insertQuery, [...seatArray, branchIdNum]);
      res.status(201).json({ message: 'Hostel seats added successfully' });
    } catch (err) {
      console.error('Error adding hostel seats:', err);
      res.status(500).json({ message: 'Server error adding hostel seats', error: err.message });
    }
  });

  router.delete('/:id', checkAdminOrStaff, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid seat ID format' });
      }

      await pool.query('BEGIN');
      await pool.query('UPDATE hostel_students SET room_id = NULL WHERE room_id = $1', [id]);
      const result = await pool.query('DELETE FROM hostel_seats WHERE id = $1 RETURNING *', [id]);
      if (result.rows.length === 0) {
        await pool.query('ROLLBACK');
        return res.status(404).json({ message: 'Seat not found' });
      }
      await pool.query('COMMIT');
      res.json({ message: 'Hostel seat deleted successfully' });
    } catch (err) {
      try {
        await pool.query('ROLLBACK');
      } catch (e) {
        // ignore rollback error
      }
      console.error('Error deleting hostel seat:', err);
      res.status(500).json({ message: 'Server error deleting hostel seat', error: err.message });
    }
  });

  return router;
};
