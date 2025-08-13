// routes/hostelExpenses.js
module.exports = (pool) => {
  const express = require('express');
  const router = express.Router();
  const { checkAdminOrStaff } = require('./auth'); // Assuming auth middleware is in this path

  // Helper to format a row’s date to YYYY-MM-DD
  const serializeExpense = (row) => ({
    id:         row.id,
    title:      row.title,
    amount:     parseFloat(row.amount || 0),
    cash:       parseFloat(row.cash   || 0),
    online:     parseFloat(row.online || 0),
    date:       // if it's a Date object, convert, otherwise assume string
      row.date instanceof Date
        ? row.date.toISOString().split('T')[0]
        : row.date,
    remark:     row.remark,
    branchId:   row.branch_id,
    branchName: row.branch_name || null,
  });

  // GET all hostel expenses
  router.get('/', checkAdminOrStaff, async (req, res) => {
    try {
      const { branchId } = req.query;
      let sql = `
        SELECT
          e.id,
          e.title,
          e.amount,
          e.cash,
          e.online,
          e.remark,
          to_char(e.date, 'YYYY-MM-DD') AS date,
          e.branch_id,
          b.name AS branch_name
        FROM hostel_expenses e
        LEFT JOIN hostel_branches b ON e.branch_id = b.id
      `;
      const params = [];
      if (branchId) {
        sql += ` WHERE e.branch_id = $1`;
        params.push(parseInt(branchId, 10));
      }
      sql += ` ORDER BY e.date DESC`;

      const { rows } = await pool.query(sql, params);
      
      // --- FIX START ---
      // Removed fetching products and sending them in the response.
      res.json({
        expenses: rows.map(serializeExpense)
      });
      // --- FIX END ---
    } catch (err) {
      console.error('Error fetching hostel expenses:', err);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  });

  // POST a new hostel expense
  router.post('/', checkAdminOrStaff, async (req, res) => {
    try {
      let { title, date, remark, branch_id, cash, online } = req.body;

      const cashAmount   = parseFloat(cash   || 0);
      const onlineAmount = parseFloat(online || 0);
      const totalAmount  = cashAmount + onlineAmount;

      if (!title || totalAmount <= 0 || !date) {
        return res
          .status(400)
          .json({ message: 'Title, a valid amount, and date are required' });
      }

      branch_id = branch_id ? parseInt(branch_id, 10) : null;
      remark    = remark    || null;

      const insertSql = `
        INSERT INTO hostel_expenses
          (title, amount, date, remark, branch_id, cash, online)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7)
        RETURNING
          id,
          title,
          amount,
          cash,
          online,
          remark,
          to_char(date, 'YYYY-MM-DD') AS date,
          branch_id
      `;
      const values = [
        title,
        totalAmount,
        date,       // expecting 'YYYY-MM-DD'
        remark,
        branch_id,
        cashAmount,
        onlineAmount
      ];
      const { rows } = await pool.query(insertSql, values);
      const newRow = rows[0];

      res.status(201).json(serializeExpense({
        ...newRow,
        branch_name: null
      }));
    } catch (err) {
      console.error('Error adding hostel expense:', err);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  });

  // PUT (update) a hostel expense
  router.put('/:id', checkAdminOrStaff, async (req, res) => {
    try {
      const { id } = req.params;
      let { title, date, remark, branch_id, cash, online } = req.body;

      const cashAmount   = parseFloat(cash   || 0);
      const onlineAmount = parseFloat(online || 0);
      const totalAmount  = cashAmount + onlineAmount;

      branch_id = branch_id ? parseInt(branch_id, 10) : null;
      remark    = remark    || null;

      const updateSql = `
        UPDATE hostel_expenses
        SET
          title     = $1,
          amount    = $2,
          date      = $3,
          remark    = $4,
          branch_id = $5,
          cash      = $6,
          online    = $7
        WHERE id = $8
        RETURNING
          id,
          title,
          amount,
          cash,
          online,
          remark,
          to_char(date, 'YYYY-MM-DD') AS date,
          branch_id
      `;
      const values = [
        title,
        totalAmount,
        date,
        remark,
        branch_id,
        cashAmount,
        onlineAmount,
        parseInt(id, 10)
      ];
      const { rows } = await pool.query(updateSql, values);
      if (rows.length === 0) {
        return res.status(404).json({ message: 'Hostel expense not found' });
      }

      res.json(serializeExpense({
        ...rows[0],
        branch_name: null
      }));
    } catch (err) {
      console.error('Error updating hostel expense:', err);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  });

  // DELETE a hostel expense
  router.delete('/:id', checkAdminOrStaff, async (req, res) => {
    try {
      const { id } = req.params;
      const { rows } = await pool.query(
        'DELETE FROM hostel_expenses WHERE id = $1 RETURNING *',
        [parseInt(id, 10)]
      );
      if (rows.length === 0) {
        return res.status(404).json({ message: 'Hostel expense not found' });
      }
      res.json({ message: 'Hostel expense deleted' });
    } catch (err) {
      console.error('Error deleting hostel expense:', err);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  });

  return router;
};