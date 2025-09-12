const { checkAdmin } = require('./auth');

module.exports = (pool) => {
  const router = require('express').Router();

  router.get('/', checkAdmin, async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM settings');
      const settings = {};
      result.rows.forEach(row => {
        settings[row.key] = row.value;
      });
      res.json(settings);
    } catch (err) {
      console.error('Error in settings GET route:', err.stack);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  });

  router.put('/', checkAdmin, async (req, res) => {
    try {
      const { registration_number_start } = req.body;
      if (registration_number_start && (isNaN(registration_number_start) || registration_number_start < 1)) {
        return res.status(400).json({ message: 'Registration number start must be a positive integer' });
      }
      if (registration_number_start) {
        // First try to update existing record
        const updateResult = await pool.query('UPDATE settings SET value = $1 WHERE key = $2', [registration_number_start.toString(), 'registration_number_start']);
        
        // If no rows were updated, insert a new record
        if (updateResult.rowCount === 0) {
          await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2)', ['registration_number_start', registration_number_start.toString()]);
        }
      }
      res.json({ message: 'Settings updated successfully' });
    } catch (err) {
      console.error('Error in settings PUT route:', err.stack);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  });

  return router;
};