// routes/hostelStaffPayments.js
module.exports = (pool) => {
  const express = require('express');
  const router = express.Router();
  const { checkAdminOrStaff } = require('./auth');

  const serializeHostelStaff = (row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

  const serializeHostelStaffPayment = (row) => ({
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

  // ==================== HOSTEL STAFF MANAGEMENT ====================

  // GET all hostel staff
  router.get('/staff', checkAdminOrStaff, async (req, res) => {
    try {
      const { rows } = await pool.query(
        'SELECT id, name, created_at, updated_at FROM hostel_staff ORDER BY name ASC'
      );
      res.json({ staff: rows.map(serializeHostelStaff) });
    } catch (err) {
      console.error('Error fetching hostel staff:', err);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  });

  // POST create new hostel staff
  router.post('/staff', checkAdminOrStaff, async (req, res) => {
    try {
      const { name } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'Staff name is required' });
      }

      const { rows } = await pool.query(
        'INSERT INTO hostel_staff (name) VALUES ($1) RETURNING id, name, created_at, updated_at',
        [name.trim()]
      );

      res.status(201).json({ staff: serializeHostelStaff(rows[0]) });
    } catch (err) {
      console.error('Error creating hostel staff:', err);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  });

  // PUT update hostel staff
  router.put('/staff/:id', checkAdminOrStaff, async (req, res) => {
    try {
      const { id } = req.params;
      const { name } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'Staff name is required' });
      }

      const { rows } = await pool.query(
        'UPDATE hostel_staff SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, name, created_at, updated_at',
        [name.trim(), parseInt(id, 10)]
      );

      if (rows.length === 0) {
        return res.status(404).json({ message: 'Staff not found' });
      }

      res.json({ staff: serializeHostelStaff(rows[0]) });
    } catch (err) {
      console.error('Error updating hostel staff:', err);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  });

  // DELETE hostel staff
  router.delete('/staff/:id', checkAdminOrStaff, async (req, res) => {
    try {
      const { id } = req.params;
      const { rows } = await pool.query(
        'DELETE FROM hostel_staff WHERE id = $1 RETURNING id',
        [parseInt(id, 10)]
      );

      if (rows.length === 0) {
        return res.status(404).json({ message: 'Staff not found' });
      }

      res.json({ message: 'Staff deleted' });
    } catch (err) {
      console.error('Error deleting hostel staff:', err);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  });

  // ==================== HOSTEL STAFF PAYMENTS ====================

  const fetchHostelStaffPayments = async ({ branchId, month, staffId }) => {
    const normalizedBranchId = normalizeBranchId(branchId);
    const normalizedMonth = normalizeMonth(month);
    const normalizedStaffId = staffId ? parseInt(staffId, 10) : null;

    let sql = `
      SELECT
        hsp.id,
        hsp.staff_id,
        hs.name AS staff_name,
        hsp.cash,
        hsp.online,
        hsp.amount,
        hsp.date,
        hsp.remark,
        hsp.branch_id,
        hb.name AS branch_name,
        hsp.created_at,
        hsp.updated_at
      FROM hostel_staff_payments hsp
      LEFT JOIN hostel_staff hs ON hsp.staff_id = hs.id
      LEFT JOIN hostel_branches hb ON hsp.branch_id = hb.id
    `;

    const clauses = [];
    const params = [];
    let paramIndex = 1;

    if (normalizedBranchId !== null) {
      clauses.push(`hsp.branch_id = $${paramIndex}`);
      params.push(normalizedBranchId);
      paramIndex++;
    }

    if (normalizedMonth) {
      clauses.push(`DATE_TRUNC('month', hsp.date) = DATE_TRUNC('month', TO_DATE($${paramIndex}, 'YYYY-MM'))`);
      params.push(normalizedMonth);
      paramIndex++;
    }

    if (normalizedStaffId !== null) {
      clauses.push(`hsp.staff_id = $${paramIndex}`);
      params.push(normalizedStaffId);
      paramIndex++;
    }

    if (clauses.length > 0) {
      sql += ` WHERE ${clauses.join(' AND ')}`;
    }

    sql += ' ORDER BY hsp.date DESC';

    const { rows } = await pool.query(sql, params);
    return rows.map(serializeHostelStaffPayment);
  };

  // GET all hostel staff payments with filters
  router.get('/', checkAdminOrStaff, async (req, res) => {
    try {
      const payments = await fetchHostelStaffPayments({
        branchId: req.query.branchId,
        month: req.query.month,
        staffId: req.query.staffId,
      });

      // Also fetch staff list for the dropdown
      const staffResult = await pool.query('SELECT id, name FROM hostel_staff ORDER BY name ASC');

      res.json({
        payments,
        staff: staffResult.rows.map(serializeHostelStaff),
      });
    } catch (err) {
      console.error('Error fetching hostel staff payments:', err);
      const status = err.status || 500;
      res.status(status).json({ message: err.status ? err.message : 'Server error', error: err.message });
    }
  });

  // GET hostel staff payments by staff ID
  router.get('/staff/:staffId', checkAdminOrStaff, async (req, res) => {
    try {
      const { staffId } = req.params;
      const payments = await fetchHostelStaffPayments({
        staffId,
        branchId: req.query.branchId,
        month: req.query.month,
      });

      res.json({ payments });
    } catch (err) {
      console.error('Error fetching hostel staff payments:', err);
      const status = err.status || 500;
      res.status(status).json({ message: err.status ? err.message : 'Server error', error: err.message });
    }
  });

  // POST create new hostel staff payment
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
      const staffCheck = await client.query('SELECT id, name FROM hostel_staff WHERE id = $1', [parseInt(staff_id, 10)]);
      if (staffCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Staff not found' });
      }

      const staffName = staffCheck.rows[0].name;
      branch_id = branch_id ? parseInt(branch_id, 10) : null;
      remark = remark || null;

      // Insert hostel staff payment
      const insertPaymentSql = `
        INSERT INTO hostel_staff_payments
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

      // Automatically create hostel expense entry
      const insertExpenseSql = `
        INSERT INTO hostel_expenses
          (title, cash, online, amount, date, remark, branch_id)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `;
      const expenseValues = [
        staffName, // Use staff name as expense title
        cashAmount,
        onlineAmount,
        totalAmount,
        date,
        remark,
        branch_id,
      ];
      await client.query(insertExpenseSql, expenseValues);

      await client.query('COMMIT');

      res.status(201).json(serializeHostelStaffPayment({
        ...newPayment,
        staff_name: staffName,
        branch_name: null,
      }));
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error adding hostel staff payment:', err);
      res.status(500).json({ message: 'Server error', error: err.message });
    } finally {
      client.release();
    }
  });

  // PUT update hostel staff payment
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
      const staffCheck = await client.query('SELECT id, name FROM hostel_staff WHERE id = $1', [parseInt(staff_id, 10)]);
      if (staffCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Staff not found' });
      }

      const staffName = staffCheck.rows[0].name;
      branch_id = branch_id ? parseInt(branch_id, 10) : null;
      remark = remark || null;

      // Get old staff payment data to find associated expense
      const oldPaymentResult = await client.query(
        'SELECT staff_id, date, cash, online, amount, branch_id FROM hostel_staff_payments WHERE id = $1',
        [parseInt(id, 10)]
      );

      if (oldPaymentResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Staff payment not found' });
      }

      const oldPayment = oldPaymentResult.rows[0];

      // Update staff payment
      const updateSql = `
        UPDATE hostel_staff_payments
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

      // Find and update the corresponding hostel expense by matching old values
      const oldStaffNameResult = await client.query('SELECT name FROM hostel_staff WHERE id = $1', [oldPayment.staff_id]);
      const oldStaffName = oldStaffNameResult.rows[0]?.name;

      const updateExpenseSql = `
        UPDATE hostel_expenses
        SET
          title = $1,
          cash = $2,
          online = $3,
          amount = $4,
          date = $5,
          remark = $6,
          branch_id = $7
        WHERE title = $8
          AND date = $9
          AND cash = $10
          AND online = $11
          AND amount = $12
          AND (branch_id = $13 OR (branch_id IS NULL AND $13 IS NULL))
      `;
      await client.query(updateExpenseSql, [
        staffName,
        cashAmount,
        onlineAmount,
        totalAmount,
        date,
        remark,
        branch_id,
        oldStaffName,
        oldPayment.date,
        oldPayment.cash,
        oldPayment.online,
        oldPayment.amount,
        oldPayment.branch_id,
      ]);

      await client.query('COMMIT');

      res.json(serializeHostelStaffPayment({
        ...result.rows[0],
        staff_name: staffName,
        branch_name: null,
      }));
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error updating hostel staff payment:', err);
      res.status(500).json({ message: 'Server error', error: err.message });
    } finally {
      client.release();
    }
  });

  // DELETE hostel staff payment
  router.delete('/:id', checkAdminOrStaff, async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { id } = req.params;

      // Get staff payment data before deletion
      const paymentResult = await client.query(
        'SELECT hsp.staff_id, hsp.date, hsp.cash, hsp.online, hsp.amount, hsp.remark, hsp.branch_id, hs.name as staff_name FROM hostel_staff_payments hsp LEFT JOIN hostel_staff hs ON hsp.staff_id = hs.id WHERE hsp.id = $1',
        [parseInt(id, 10)]
      );

      if (paymentResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Staff payment not found' });
      }

      const payment = paymentResult.rows[0];

      // Delete staff payment
      const { rows } = await client.query(
        'DELETE FROM hostel_staff_payments WHERE id = $1 RETURNING *',
        [parseInt(id, 10)]
      );

      // Delete corresponding hostel expense by matching title, date, amount, and branch
      await client.query(
        'DELETE FROM hostel_expenses WHERE title = $1 AND date = $2 AND cash = $3 AND online = $4 AND amount = $5 AND (branch_id = $6 OR (branch_id IS NULL AND $6 IS NULL))',
        [payment.staff_name, payment.date, payment.cash, payment.online, payment.amount, payment.branch_id]
      );

      await client.query('COMMIT');

      res.json({ message: 'Staff payment deleted' });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error deleting hostel staff payment:', err);
      res.status(500).json({ message: 'Server error', error: err.message });
    } finally {
      client.release();
    }
  });

  // GET export CSV
  router.get('/export/csv', checkAdminOrStaff, async (req, res) => {
    try {
      const payments = await fetchHostelStaffPayments({
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
      res.setHeader('Content-Disposition', `attachment; filename="hostel_staff_payments_${filenameSuffix}.csv"`);
      res.status(200).send(csvContent);
    } catch (err) {
      console.error('Error exporting hostel staff payments CSV:', err);
      const status = err.status || 500;
      res.status(status).json({ message: err.status ? err.message : 'Server error while exporting CSV', error: err.message });
    }
  });

  return router;
};
