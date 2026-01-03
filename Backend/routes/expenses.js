// routes/expenses.js
module.exports = (pool) => {
  const express = require('express');
  const router = express.Router();
  const { checkAdminOrStaff } = require('./auth');

  const serializeExpense = (row) => ({
    id: row.id,
    title: row.title,
    amount: parseFloat(row.amount || 0),
    cash: parseFloat(row.cash || 0),
    online: parseFloat(row.online || 0),
    date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : row.date,
    remark: row.remark,
    branchId: row.branch_id,
    branchName: row.branch_name || null,
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

  const fetchExpenses = async ({ branchId, month }) => {
    const normalizedBranchId = normalizeBranchId(branchId);
    const normalizedMonth = normalizeMonth(month);

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
      FROM expenses e
      LEFT JOIN branches b ON e.branch_id = b.id
    `;

    const clauses = [];
    const params = [];
    let paramIndex = 1;

    if (normalizedBranchId !== null) {
      clauses.push(`e.branch_id = $${paramIndex}`);
      params.push(normalizedBranchId);
      paramIndex++;
    }

    if (normalizedMonth) {
      clauses.push(`DATE_TRUNC('month', e.date) = DATE_TRUNC('month', TO_DATE($${paramIndex}, 'YYYY-MM'))`);
      params.push(normalizedMonth);
      paramIndex++;
    }

    if (clauses.length > 0) {
      sql += ` WHERE ${clauses.join(' AND ')}`;
    }

    sql += ' ORDER BY e.date DESC';

    const { rows } = await pool.query(sql, params);
    return rows.map(serializeExpense);
  };

  router.get('/', checkAdminOrStaff, async (req, res) => {
    try {
      const expenses = await fetchExpenses({ branchId: req.query.branchId, month: req.query.month });
      const productsResult = await pool.query('SELECT id, name FROM products');

      res.json({
        expenses,
        products: productsResult.rows
      });
    } catch (err) {
      console.error('Error fetching expenses:', err);
      const status = err.status || 500;
      res.status(status).json({ message: err.status ? err.message : 'Server error', error: err.message });
    }
  });

  router.get('/export/csv', checkAdminOrStaff, async (req, res) => {
    try {
      const expenses = await fetchExpenses({ branchId: req.query.branchId, month: req.query.month });
      const headers = [
        'ID',
        'Title',
        'Cash',
        'Online',
        'Total Amount',
        'Remark',
        'Date',
        'Branch'
      ];

      const rows = expenses.map((expense) => ([
        expense.id,
        expense.title,
        expense.cash.toFixed(2),
        expense.online.toFixed(2),
        expense.amount.toFixed(2),
        expense.remark || '',
        formatDate(expense.date),
        expense.branchName || 'Global'
      ]));

      const csvContent = [headers, ...rows].map((row) => row.map(escapeCsvValue).join(',')).join('\n');
      const filenameSuffix = normalizeMonth(req.query.month) || 'all';

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="expenses_${filenameSuffix}.csv"`);
      res.status(200).send(csvContent);
    } catch (err) {
      console.error('Error exporting expenses CSV:', err);
      const status = err.status || 500;
      res.status(status).json({ message: err.status ? err.message : 'Server error while exporting CSV', error: err.message });
    }
  });

  // POST a new expense
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
        INSERT INTO expenses
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
      console.error('Error adding expense:', err);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  });

  // PUT (update) an expense
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
        UPDATE expenses
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
        return res.status(404).json({ message: 'Expense not found' });
      }

      res.json(serializeExpense({
        ...rows[0],
        branch_name: null
      }));
    } catch (err) {
      console.error('Error updating expense:', err);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  });

  // DELETE an expense
  router.delete('/:id', checkAdminOrStaff, async (req, res) => {
    try {
      const { id } = req.params;
      const { rows } = await pool.query(
        'DELETE FROM expenses WHERE id = $1 RETURNING *',
        [parseInt(id, 10)]
      );
      if (rows.length === 0) {
        return res.status(404).json({ message: 'Expense not found' });
      }
      res.json({ message: 'Expense deleted' });
    } catch (err) {
      console.error('Error deleting expense:', err);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  });

  return router;
};
