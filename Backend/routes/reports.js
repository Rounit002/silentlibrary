module.exports = (pool) => {
  const router = require('express').Router();
  const { checkAdminOrStaff } = require('./auth');

  router.get('/profit-loss', checkAdminOrStaff, async (req, res) => {
  try {
    const { month, date, branchId } = req.query;
    let startDate, endDate;
    let reportPeriod = {};

    // Date or month validation
    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: 'Invalid date format, use YYYY-MM-DD' });
      }
      startDate = date;
      endDate = date;
      reportPeriod = { date };
    } else if (month) {
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ message: 'Invalid month format, use YYYY-MM' });
      }
      const [year, monthNum] = month.split('-');
      startDate = `${year}-${monthNum}-01`;
      endDate = new Date(year, monthNum, 0).toISOString().split('T')[0];
      reportPeriod = { month };
    } else {
      return res.status(400).json({ message: 'A month or date parameter is required' });
    }

    let params = [startDate, endDate];
    let paramIndex = 3;

    // Query for collections
    let collectionsQuery = `
      SELECT 
        COALESCE(SUM(amount_paid), 0) AS total_collected,
        COALESCE(SUM(cash), 0) AS cash_collected,
        COALESCE(SUM(online), 0) AS online_collected
      FROM student_membership_history
      WHERE changed_at::date >= $1 AND changed_at::date <= $2
    `;

    // Query for expenses (assuming similar structure)
    let expensesQuery = `
      SELECT 
        COALESCE(SUM(amount), 0) AS total_expenses,
        COALESCE(SUM(cash), 0) AS cash_expenses,
        COALESCE(SUM(online), 0) AS online_expenses
      FROM expenses
      WHERE date >= $1 AND date <= $2
    `;

    // Add branch filter if provided
    if (branchId) {
      const branchIdNum = parseInt(branchId, 10);
      if (isNaN(branchIdNum)) {
        return res.status(400).json({ message: 'Invalid branch ID' });
      }
      collectionsQuery += ` AND branch_id = $${paramIndex}`;
      expensesQuery += ` AND branch_id = $${paramIndex}`;
      params.push(branchIdNum);
    }

    // Execute queries
    const collectionsResult = await pool.query(collectionsQuery, params);
    const expensesResult = await pool.query(expensesQuery, params);

    // Parse results
    const totalCollected = parseFloat(collectionsResult.rows[0].total_collected) || 0;
    const cashCollected = parseFloat(collectionsResult.rows[0].cash_collected) || 0;
    const onlineCollected = parseFloat(collectionsResult.rows[0].online_collected) || 0;
    const totalExpenses = parseFloat(expensesResult.rows[0].total_expenses) || 0;
    const cashExpenses = parseFloat(expensesResult.rows[0].cash_expenses) || 0;
    const onlineExpenses = parseFloat(expensesResult.rows[0].online_expenses) || 0;
    const profitLoss = totalCollected - totalExpenses;

    // Send response
    res.json({
      ...reportPeriod,
      totalCollected,
      cashCollected,
      onlineCollected,
      totalExpenses,
      cashExpenses,
      onlineExpenses,
      profitLoss
    });
  } catch (err) {
    console.error('Error calculating profit-loss:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

  router.get('/monthly-collections', checkAdminOrStaff, async (req, res) => {
    try {
      const { month } = req.query;
      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ message: 'Invalid month format, use YYYY-MM' });
      }
      const [y, m] = month.split('-');
      const start = `${y}-${m}-01`;
      const end = new Date(y, m, 0).toISOString().slice(0, 10);

      const sql = `
        SELECT s.id AS student_id,
               s.name AS student_name,
               s.email,
               s.phone,
               COALESCE(SUM(CASE WHEN st.type='payment' THEN st.amount END), 0) AS total_collected,
               COALESCE(SUM(CASE WHEN st.type='due' THEN st.amount END), 0) AS total_due,
               s.total_fee,
               s.amount_paid,
               s.due_amount
        FROM student_transactions st
        JOIN students s ON s.id = st.student_id
        WHERE st.date BETWEEN $1 AND $2
        GROUP BY s.id, s.name, s.email, s.phone, s.total_fee, s.amount_paid, s.due_amount
        ORDER BY s.name;
      `;
      const { rows } = await pool.query(sql, [start, end]);

      res.json({
        month,
        records: rows.map(r => ({
          studentId: r.student_id,
          studentName: r.student_name,
          email: r.email,
          phone: r.phone,
          totalFee: parseFloat(r.total_fee) || 0,
          amountPaid: parseFloat(r.amount_paid) || 0,
          dueAmount: parseFloat(r.due_amount) || 0,
          collected: parseFloat(r.total_collected),
          due: parseFloat(r.total_due)
        }))
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  });

  return router;
};