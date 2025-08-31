const { checkAdminOrStaff } = require('./auth'); // Assuming this middleware exists and is correctly set up

module.exports = (pool) => {
  const router = require('express').Router();

  // GET all schedules
  router.get('/', async (req, res) => {
    try {
      // Orders by the newly added 'created_at' column, then by title
      const result = await pool.query('SELECT * FROM schedules ORDER BY created_at DESC, title');
      res.json({ schedules: result.rows });
    } catch (err) {
      console.error('Error fetching schedules:', err.stack);
      res.status(500).json({ message: 'Server error fetching schedules', error: err.message });
    }
  });

  // GET schedules with student counts (assuming seat_assignments links students to shifts/schedules)
  router.get('/with-students', checkAdminOrStaff, async (req, res) => {
    try {
      // This query assumes 'seat_assignments' links 'students' (student_id) to 'schedules' (shift_id)
      // Ensure that students.id, schedules.id, and the corresponding FKs in seat_assignments are all INTEGERS
      const result = await pool.query(`
        SELECT 
            s.id, 
            s.title, 
            s.description, 
            s.time, 
            s.event_date, 
            s.created_at, 
            s.updated_at,
            COUNT(sa.student_id) as student_count
        FROM schedules s
        LEFT JOIN seat_assignments sa ON s.id = sa.shift_id 
        GROUP BY s.id, s.title, s.description, s.time, s.event_date, s.created_at, s.updated_at
        ORDER BY s.event_date, s.time
      `);
      res.json({ schedules: result.rows });
    } catch (err) {
      console.error('Error fetching schedules with students:', err.stack);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  });

  // GET a single schedule by ID
  router.get('/:id', async (req, res) => {
    try {
      const scheduleId = parseInt(req.params.id, 10);
      if (isNaN(scheduleId)) {
        return res.status(400).json({ message: 'Invalid schedule ID format. Must be an integer.' });
      }
      const result = await pool.query('SELECT * FROM schedules WHERE id = $1', [scheduleId]);
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Schedule not found' });
      }
      res.json({ schedule: result.rows[0] });
    } catch (err) {
      console.error(`Error fetching schedule ${req.params.id}:`, err.stack);
      res.status(500).json({ message: 'Server error fetching schedule', error: err.message });
    }
  });

  // POST a new schedule
  router.post('/', checkAdminOrStaff, async (req, res) => {
    try {
      const { title, description, time, event_date } = req.body; // event_date from frontend

      if (!title || !time || !event_date) {
        return res.status(400).json({ message: 'Title, time, and event_date (YYYY-MM-DD) are required' });
      }
      // Basic validation for date format (can be more robust)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(event_date)) {
        return res.status(400).json({ message: 'Invalid event_date format, use YYYY-MM-DD' });
      }
      // Time format validation can be added here if necessary, e.g., HH:MM

      // Inserts into created_at and relies on updated_at DB default or trigger
      const result = await pool.query(
        `INSERT INTO schedules (title, description, time, event_date, created_at, updated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *`,
        [title, description || null, time, event_date]
      );

      res.status(201).json({
        message: 'Schedule added successfully',
        schedule: result.rows[0]
      });
    } catch (err) {
      console.error('Error adding schedule:', err.stack);
      res.status(500).json({ message: 'Server error adding schedule', error: err.message });
    }
  });

  // PUT (update) an existing schedule
  router.put('/:id', checkAdminOrStaff, async (req, res) => {
    try {
      const scheduleId = parseInt(req.params.id, 10);
      if (isNaN(scheduleId)) {
        return res.status(400).json({ message: 'Invalid schedule ID format. Must be an integer.' });
      }
      const { title, description, time, event_date } = req.body; // event_date from frontend

      // Validation for date format
      if (event_date && !/^\d{4}-\d{2}-\d{2}$/.test(event_date)) {
        return res.status(400).json({ message: 'Invalid event_date format, use YYYY-MM-DD' });
      }
      // Time format validation can be added here

      const result = await pool.query(
        `UPDATE schedules SET
          title = COALESCE($1, title),
          description = COALESCE($2, description),
          time = COALESCE($3, time),
          event_date = COALESCE($4, event_date),
          updated_at = NOW()
         WHERE id = $5 RETURNING *`,
        [title, description, time, event_date, scheduleId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Schedule not found for update' });
      }

      res.json({
        message: 'Schedule updated successfully',
        schedule: result.rows[0]
      });
    } catch (err) {
      console.error(`Error updating schedule ${req.params.id}:`, err.stack);
      res.status(500).json({ message: 'Server error updating schedule', error: err.message });
    }
  });

  // DELETE a schedule
  router.delete('/:id', checkAdminOrStaff, async (req, res) => {
    try {
      const scheduleId = parseInt(req.params.id, 10);
      if (isNaN(scheduleId)) {
        return res.status(400).json({ message: 'Invalid schedule ID format. Must be an integer.' });
      }
      // Before deleting a schedule, consider implications for seat_assignments or other dependencies.
      // You might need to remove related assignments first or handle it via DB constraints (ON DELETE CASCADE).
      const result = await pool.query('DELETE FROM schedules WHERE id = $1 RETURNING *', [scheduleId]);
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Schedule not found for deletion' });
      }
      res.json({
        message: 'Schedule deleted successfully',
        schedule: result.rows[0]
      });
    } catch (err) {
      console.error(`Error deleting schedule ${req.params.id}:`, err.stack);
      res.status(500).json({ message: 'Server error deleting schedule', error: err.message });
    }
  });

  return router;
};