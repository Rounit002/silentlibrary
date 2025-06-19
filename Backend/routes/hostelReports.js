// ./routes/hostelReports.js
module.exports = (pool) => {
  const router = require('express').Router();
  const { checkAdminOrStaff } = require('./auth');

  router.get('/profit-loss', checkAdminOrStaff, async (req, res) => {
    try {
      const { month, date, branchId } = req.query;
      let startDate, endDate;

      // Determine the date range for the report
      if (date) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return res.status(400).json({ message: 'Invalid date format, use YYYY-MM-DD' });
        }
        startDate = date;
        endDate = date;
      } else if (month) {
        if (!/^\d{4}-\d{2}$/.test(month)) {
          return res.status(400).json({ message: 'Invalid month format, use YYYY-MM' });
        }
        const [year, monthNum] = month.split('-');
        startDate = `${year}-${monthNum}-01`;
        endDate = new Date(year, monthNum, 0).toISOString().split('T')[0];
      } else {
        return res.status(400).json({ message: 'A month or date parameter is required' });
      }

      let collectionsParams = [startDate, endDate];
      let expensesParams = [startDate, endDate];
      
      // Collections Query (INACCURATE - see disclaimer)
      // This query sums the TOTAL paid amount on records updated in the period,
      // not the amount that was incrementally paid in the period.
      let collectionsQuery = `
        SELECT
          COALESCE(SUM(hsh.cash_paid), 0) AS cash_collected,
          COALESCE(SUM(hsh.online_paid), 0) AS online_collected
        FROM hostel_student_history hsh
        LEFT JOIN hostel_students hs ON hsh.student_id = hs.id
        WHERE hsh.updated_at::date >= $1 AND hsh.updated_at::date <= $2
      `;

      // Expenses Query (Accurate)
      let expensesQuery = `
        SELECT
          COALESCE(SUM(cash), 0) AS cash_expenses,
          COALESCE(SUM(online), 0) AS online_expenses
        FROM hostel_expenses
        WHERE date >= $1 AND date <= $2
      `;

      // Add branch filter if a branchId is provided
      if (branchId) {
        const branchIdNum = parseInt(branchId, 10);
        if (isNaN(branchIdNum)) {
          return res.status(400).json({ message: 'Invalid branch ID' });
        }
        collectionsQuery += ` AND hs.branch_id = $3`;
        expensesQuery += ` AND branch_id = $3`;
        collectionsParams.push(branchIdNum);
        expensesParams.push(branchIdNum);
      }

      // Execute the queries
      const collectionsResult = await pool.query(collectionsQuery, collectionsParams);
      const expensesResult = await pool.query(expensesQuery, expensesParams);

      // Parse results
      const cashCollected = parseFloat(collectionsResult.rows[0].cash_collected) || 0;
      const onlineCollected = parseFloat(collectionsResult.rows[0].online_collected) || 0;
      const totalCollected = cashCollected + onlineCollected;

      const cashExpenses = parseFloat(expensesResult.rows[0].cash_expenses) || 0;
      const onlineExpenses = parseFloat(expensesResult.rows[0].online_expenses) || 0;
      const totalExpenses = cashExpenses + onlineExpenses;
      
      const profitLoss = totalCollected - totalExpenses;

      // Send the final JSON response
      res.json({
        totalCollected,
        cashCollected,
        onlineCollected,
        totalExpenses,
        cashExpenses,
        onlineExpenses,
        profitLoss
      });
    } catch (err) {
      console.error('Error calculating hostel profit-loss:', err);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  });

  return router;
};