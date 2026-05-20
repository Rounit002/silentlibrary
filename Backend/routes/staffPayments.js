// routes/staffPayments.js
module.exports = (pool) => {
  const express = require('express');
  const router = express.Router();
  const { checkAdminOrStaff } = require('./auth');

  const serializeStaff = (row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

  const serializeStaffPayment = (row) => ({
    id: row.id,
    staffId: row.staff_id,
    staffName: row.staff_name,
    cash: parseFloat(row.cash || 0),
    online: parseFloat(row.online || 0),
    amount: parseFloat(row.amount || 0),
    date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : row.date,
    remark: row.remark,
    branchId: row.branch_id,
    branchName: row.branch_name || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

  const escapeCsvValue = (value) => {
    if (value === null || value === undefined) return '';
    const stringValue = String(value).replace(/"/g, '""');
    return /[",\n]/.test(stringValue) ? `"${stringValue}"` : stringValue;
  };

  const formatDate = (value) => {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
  };

  const normalizeBranchId = (branchId) => {
    if (branchId === undefined || branchId === null || branchId === '') return null;
    const parsed = parseInt(branchId, 10);
    if (isNaN(parsed)) {
      const error = new Error('Invalid branch ID');
      error.status = 400;
      throw error;
    }
    return parsed;
  };

  const normalizeMonth = (month) => {
    if (!month || typeof month !== 'string' || !month.trim()) return null;
    const trimmed = month.trim();
    if (!/^\d{4}-\d{2}$/.test(trimmed)) {
      const error = new Error('Invalid month format. Use YYYY-MM');
      error.status = 400;
      throw error;
    }
    return trimmed;
  };

  // ==================== STAFF MANAGEMENT ====================

  // GET all staff
  router.get('/staff', checkAdminOrStaff, async (req, res) => {
    try {
      const { rows } = await pool.query(
        'SELECT id, name, created_at, updated_at FROM staff ORDER BY name ASC'
      );
      res.json({ staff: rows.map(serializeStaff) });
    } catch (err) {
      console.error('Error fetching staff:', err);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  });

  // POST create new staff
  router.post('/staff', checkAdminOrStaff, async (req, res) => {
    try {
      const { name } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'Staff name is required' });
      }

      const { rows } = await pool.query(
        'INSERT INTO staff (name) VALUES ($1) RETURNING id, name, created_at, updated_at',
        [name.trim()]
      );

      res.status(201).json({ staff: serializeStaff(rows[0]) });
    } catch (err) {
      console.error('Error creating staff:', err);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  });

  // PUT update staff
  router.put('/staff/:id', checkAdminOrStaff, async (req, res) => {
    try {
      const { id } = req.params;
      const { name } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'Staff name is required' });
      }

      const { rows } = await pool.query(
        'UPDATE staff SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, name, created_at, updated_at',
        [name.trim(), parseInt(id, 10)]
      );

      if (rows.length === 0) {
        return res.status(404).json({ message: 'Staff not found' });
      }

      res.json({ staff: serializeStaff(rows[0]) });
    } catch (err) {
      console.error('Error updating staff:', err);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  });

  // DELETE staff
  router.delete('/staff/:id', checkAdminOrStaff, async (req, res) => {
    try {
      const { id } = req.params;
      const { rows } = await pool.query(
        'DELETE FROM staff WHERE id = $1 RETURNING id',
        [parseInt(id, 10)]
      );

      if (rows.length === 0) {
        return res.status(404).json({ message: 'Staff not found' });
      }

      res.json({ message: 'Staff deleted' });
    } catch (err) {
      console.error('Error deleting staff:', err);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  });

  // ==================== STAFF PAYMENTS ====================

  const fetchStaffPayments = async ({ branchId, month, staffId }) => {
    const normalizedBranchId = normalizeBranchId(branchId);
    const normalizedMonth = normalizeMonth(month);
    const normalizedStaffId = staffId ? parseInt(staffId, 10) : null;

    let sql = `
      SELECT
        sp.id,
        sp.staff_id,
        s.name AS staff_name,
        sp.cash,
        sp.online,
        sp.amount,
        sp.date,
        sp.remark,
        sp.branch_id,
        b.name AS branch_name,
        sp.created_at,
        sp.updated_at
      FROM staff_payments sp
      LEFT JOIN staff s ON sp.staff_id = s.id
      LEFT JOIN branches b ON sp.branch_id = b.id
    `;

    const clauses = [];
    const params = [];
    let paramIndex = 1;

    if (normalizedBranchId !== null) {
      clauses.push(`sp.branch_id = $${paramIndex}`);
      params.push(normalizedBranchId);
      paramIndex++;
    }

    if (normalizedMonth) {
      clauses.push(`DATE_TRUNC('month', sp.date) = DATE_TRUNC('month', TO_DATE($${paramIndex}, 'YYYY-MM'))`);
      params.push(normalizedMonth);
      paramIndex++;
    }

    if (normalizedStaffId !== null) {
      clauses.push(`sp.staff_id = $${paramIndex}`);
      params.push(normalizedStaffId);
      paramIndex++;
    }

    if (clauses.length > 0) {
      sql += ` WHERE ${clauses.join(' AND ')}`;
    }

    sql += ' ORDER BY sp.date DESC';

    const { rows } = await pool.query(sql, params);
    return rows.map(serializeStaffPayment);
  };

  // GET all staff payments with filters
  router.get('/', checkAdminOrStaff, async (req, res) => {
    try {
      const payments = await fetchStaffPayments({
        branchId: req.query.branchId,
        month: req.query.month,
        staffId: req.query.staffId,
      });

      // Also fetch staff list for the dropdown
      const staffResult = await pool.query('SELECT id, name FROM staff ORDER BY name ASC');

      res.json({
        payments,
        staff: staffResult.rows.map(serializeStaff),
      });
    } catch (err) {
      console.error('Error fetching staff payments:', err);
      const status = err.status || 500;
      res.status(status).json({ message: err.status ? err.message : 'Server error', error: err.message });
    }
  });

  // GET staff payments by staff ID
  router.get('/staff/:staffId', checkAdminOrStaff, async (req, res) => {
    try {
      const { staffId } = req.params;
      const payments = await fetchStaffPayments({
        staffId,
        branchId: req.query.branchId,
        month: req.query.month,
      });

      res.json({ payments });
    } catch (err) {
      console.error('Error fetching staff payments:', err);
      const status = err.status || 500;
      res.status(status).json({ message: err.status ? err.message : 'Server error', error: err.message });
    }
  });

  // POST create new staff payment
  router.post('/', checkAdminOrStaff, async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let { staff_id, cash, online, date, remark, branch_id } = req.body;

      const cashAmount = parseFloat(cash || 0);
      const onlineAmount = parseFloat(online || 0);
      const totalAmount = cashAmount + onlineAmount;

      if (!staff_id || totalAmount <= 0 || !date) {
        await client.query('ROLLBACK');
        return res
          .status(400)
          .json({ message: 'Staff, a valid amount, and date are required' });
      }

      // Verify staff exists and get name
      const staffCheck = await client.query('SELECT id, name FROM staff WHERE id = $1', [parseInt(staff_id, 10)]);
      if (staffCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Staff not found' });
      }

      const staffName = staffCheck.rows[0].name;
      branch_id = branch_id ? parseInt(branch_id, 10) : null;
      remark = remark || null;

      // Insert staff payment
      const insertPaymentSql = `
        INSERT INTO staff_payments
          (staff_id, cash, online, amount, date, remark, branch_id)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7)
        RETURNING
          id,
          staff_id,
          cash,
          online,
          amount,
          date,
          remark,
          branch_id,
          created_at,
          updated_at
      `;
      const paymentValues = [
        parseInt(staff_id, 10),
        cashAmount,
        onlineAmount,
        totalAmount,
        date,
        remark,
        branch_id,
      ];
      const paymentResult = await client.query(insertPaymentSql, paymentValues);
      const newPayment = paymentResult.rows[0];

      // Automatically create expense entry
      const insertExpenseSql = `
        INSERT INTO expenses
          (title, amount, cash, online, date, remark, branch_id)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `;
      const expenseValues = [
        staffName, // Use staff name as expense title
        totalAmount,
        cashAmount,
        onlineAmount,
        date,
        remark,
        branch_id,
      ];
      await client.query(insertExpenseSql, expenseValues);

      await client.query('COMMIT');

      res.status(201).json(serializeStaffPayment({
        ...newPayment,
        staff_name: staffName,
        branch_name: null,
      }));
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error adding staff payment:', err);
      res.status(500).json({ message: 'Server error', error: err.message });
    } finally {
      client.release();
    }
  });

  // PUT update staff payment
  router.put('/:id', checkAdminOrStaff, async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { id } = req.params;
      let { staff_id, cash, online, date, remark, branch_id } = req.body;

      const cashAmount = parseFloat(cash || 0);
      const onlineAmount = parseFloat(online || 0);
      const totalAmount = cashAmount + onlineAmount;

      if (!staff_id || totalAmount <= 0 || !date) {
        await client.query('ROLLBACK');
        return res
          .status(400)
          .json({ message: 'Staff, a valid amount, and date are required' });
      }

      // Verify staff exists and get name
      const staffCheck = await client.query('SELECT id, name FROM staff WHERE id = $1', [parseInt(staff_id, 10)]);
      if (staffCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Staff not found' });
      }

      const staffName = staffCheck.rows[0].name;
      branch_id = branch_id ? parseInt(branch_id, 10) : null;
      remark = remark || null;

      // Get old staff payment data to find associated expense
      const oldPaymentResult = await client.query(
        'SELECT staff_id, date, created_at FROM staff_payments WHERE id = $1',
        [parseInt(id, 10)]
      );

      if (oldPaymentResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Staff payment not found' });
      }

      const oldPayment = oldPaymentResult.rows[0];

      // Update staff payment
      const updateSql = `
        UPDATE staff_payments
        SET
          staff_id = $1,
          cash = $2,
          online = $3,
          amount = $4,
          date = $5,
          remark = $6,
          branch_id = $7,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $8
        RETURNING
          id,
          staff_id,
          cash,
          online,
          amount,
          date,
          remark,
          branch_id,
          created_at,
          updated_at
      `;
      const values = [
        parseInt(staff_id, 10),
        cashAmount,
        onlineAmount,
        totalAmount,
        date,
        remark,
        branch_id,
        parseInt(id, 10),
      ];
      const result = await client.query(updateSql, values);
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Staff payment not found' });
      }

      // Find and update the corresponding expense
      // We match by title (staff name), date, and created_at timestamp to find the original expense
      const oldStaffNameResult = await client.query('SELECT name FROM staff WHERE id = $1', [oldPayment.staff_id]);
      const oldStaffName = oldStaffNameResult.rows[0]?.name;

      const updateExpenseSql = `
        UPDATE expenses
        SET
          title = $1,
          amount = $2,
          cash = $3,
          online = $4,
          date = $5,
          remark = $6,
          branch_id = $7
        WHERE title = $8
          AND date = $9
          AND created_at = (
            SELECT created_at FROM staff_payments WHERE id = $10
          )
      `;
      await client.query(updateExpenseSql, [
        staffName,
        totalAmount,
        cashAmount,
        onlineAmount,
        date,
        remark,
        branch_id,
        oldStaffName,
        oldPayment.date,
        parseInt(id, 10),
      ]);

      await client.query('COMMIT');

      res.json(serializeStaffPayment({
        ...result.rows[0],
        staff_name: staffName,
        branch_name: null,
      }));
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error updating staff payment:', err);
      res.status(500).json({ message: 'Server error', error: err.message });
    } finally {
      client.release();
    }
  });

  // DELETE staff payment
  router.delete('/:id', checkAdminOrStaff, async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { id } = req.params;

      // Get staff payment data before deletion
      const paymentResult = await client.query(
        'SELECT sp.staff_id, sp.date, sp.created_at, s.name as staff_name FROM staff_payments sp LEFT JOIN staff s ON sp.staff_id = s.id WHERE sp.id = $1',
        [parseInt(id, 10)]
      );

      if (paymentResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Staff payment not found' });
      }

      const payment = paymentResult.rows[0];

      // Delete staff payment
      const { rows } = await client.query(
        'DELETE FROM staff_payments WHERE id = $1 RETURNING *',
        [parseInt(id, 10)]
      );

      // Delete corresponding expense
      await client.query(
        'DELETE FROM expenses WHERE title = $1 AND date = $2 AND created_at = $3',
        [payment.staff_name, payment.date, payment.created_at]
      );

      await client.query('COMMIT');

      res.json({ message: 'Staff payment deleted' });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error deleting staff payment:', err);
      res.status(500).json({ message: 'Server error', error: err.message });
    } finally {
      client.release();
    }
  });

  // GET export CSV
  router.get('/export/csv', checkAdminOrStaff, async (req, res) => {
    try {
      const payments = await fetchStaffPayments({
        branchId: req.query.branchId,
        month: req.query.month,
        staffId: req.query.staffId,
      });
      const headers = [
        'ID',
        'Staff Name',
        'Cash',
        'Online',
        'Total Amount',
        'Remark',
        'Date',
        'Branch'
      ];

      const rows = payments.map((payment) => ([
        payment.id,
        payment.staffName,
        payment.cash.toFixed(2),
        payment.online.toFixed(2),
        payment.amount.toFixed(2),
        payment.remark || '',
        formatDate(payment.date),
        payment.branchName || 'Global'
      ]));

      const csvContent = [headers, ...rows].map((row) => row.map(escapeCsvValue).join(',')).join('\n');
      const filenameSuffix = normalizeMonth(req.query.month) || 'all';

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="staff_payments_${filenameSuffix}.csv"`);
      res.status(200).send(csvContent);
    } catch (err) {
      console.error('Error exporting staff payments CSV:', err);
      const status = err.status || 500;
      res.status(status).json({ message: err.status ? err.message : 'Server error while exporting CSV', error: err.message });
    }
  });

  return router;
};
