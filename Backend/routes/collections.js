module.exports = (pool) => {
  const router = require('express').Router();
  const { checkAdmin, checkAdminOrStaff } = require('./auth');

  router.get('/', checkAdminOrStaff, async (req, res) => {
    try {
      let query = `
        SELECT 
          smh.id as history_id, 
          smh.student_id, 
          smh.name, 
          sch.title as shift_title, 
          smh.total_fee, 
          smh.amount_paid, 
          smh.due_amount,
          smh.cash,
          smh.online,
          smh.security_money,
          smh.remark,
          smh.changed_at as created_at,
          smh.payment_date as payment_date,
          smh.branch_id,
          b.name as branch_name
        FROM student_membership_history smh
        LEFT JOIN schedules sch ON smh.shift_id = sch.id
        LEFT JOIN branches b ON smh.branch_id = b.id
      `;
      const params = [];
      let paramIndex = 1;

      if (req.query.month) {
        const monthParam = req.query.month;
        if (!/^\d{4}-\d{2}$/.test(monthParam)) {
          return res.status(400).json({ message: 'Invalid month format. Use YYYY-MM' });
        }
        const [year, month] = monthParam.split('-');
        query += ` WHERE EXTRACT(YEAR FROM smh.changed_at) = $${paramIndex} AND EXTRACT(MONTH FROM smh.changed_at) = $${paramIndex + 1}`;
        params.push(year, month);
        paramIndex += 2;
      }

      if (req.query.branchId) {
        const branchId = parseInt(req.query.branchId, 10);
        if (isNaN(branchId)) {
          return res.status(400).json({ message: 'Invalid branch ID' });
        }
        query += (paramIndex > 1 ? ' AND' : ' WHERE') + ` smh.branch_id = $${paramIndex}`;
        params.push(branchId);
        paramIndex++;
      }

      query += ` ORDER BY smh.name`;
      const result = await pool.query(query, params);

      // Build adjustments summary for the requested month: sums of due payments paid later (do not mutate rows)
      let previousDuePaidAdjustments = { totalAmount: 0, totalCash: 0, totalOnline: 0 };
      if (req.query.month) {
        // Ensure helper table exists before selecting
        await pool.query(`
          CREATE TABLE IF NOT EXISTS previous_month_due_payments (
            id SERIAL PRIMARY KEY,
            history_id INTEGER NOT NULL REFERENCES student_membership_history(id) ON DELETE CASCADE,
            student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
            branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
            amount NUMERIC(12,2) NOT NULL,
            method VARCHAR(10) NOT NULL CHECK (method IN ('cash','online')),
            paid_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            month_tag VARCHAR(7) NOT NULL,
            original_month VARCHAR(7) NOT NULL
          );
        `);

        const adjParams = [req.query.month];
        let adjQuery = `
          SELECT 
            COALESCE(SUM(amount),0) as total,
            COALESCE(SUM(CASE WHEN method='cash' THEN amount ELSE 0 END),0) as cash_sum,
            COALESCE(SUM(CASE WHEN method='online' THEN amount ELSE 0 END),0) as online_sum
          FROM previous_month_due_payments
          WHERE original_month = $1
        `;
        if (req.query.branchId) {
          const b = parseInt(req.query.branchId, 10);
          if (!isNaN(b)) {
            adjQuery += ' AND branch_id = $2';
            adjParams.push(b);
          }
        }
        const adjRes = await pool.query(adjQuery, adjParams);
        if (adjRes.rows.length > 0) {
          const r = adjRes.rows[0];
          previousDuePaidAdjustments = {
            totalAmount: parseFloat(r.total) || 0,
            totalCash: parseFloat(r.cash_sum) || 0,
            totalOnline: parseFloat(r.online_sum) || 0,
          };
        }
      }

      const collections = result.rows.map(row => ({
        historyId: row.history_id,
        studentId: row.student_id,
        name: row.name,
        shiftTitle: row.shift_title,
        totalFee: row.total_fee !== null && row.total_fee !== undefined ? parseFloat(row.total_fee) : 0,
        amountPaid: row.amount_paid !== null && row.amount_paid !== undefined ? parseFloat(row.amount_paid) : 0,
        dueAmount: row.due_amount !== null && row.due_amount !== undefined ? parseFloat(row.due_amount) : 0,
        cash: row.cash !== null && row.cash !== undefined ? parseFloat(row.cash) : 0,
        online: row.online !== null && row.online !== undefined ? parseFloat(row.online) : 0,
        securityMoney: row.security_money !== null && row.security_money !== undefined ? parseFloat(row.security_money) : 0,
        remark: row.remark || '',
        createdAt: row.created_at,
        paymentDate: row.payment_date,
        branchId: row.branch_id,
        branchName: row.branch_name
      }));
      // Additionally, include previous-month due payments attributed to the requested month
      let previousDuePaid = {
        totalAmount: 0,
        totalCash: 0,
        totalOnline: 0,
        items: []
      };

      // Only attempt to read when a month filter is provided
      if (req.query.month) {
        const [yrStr, moStr] = String(req.query.month).split('-');
        const yearNum = parseInt(yrStr);
        const monthNum = parseInt(moStr);
        if (!isNaN(yearNum) && !isNaN(monthNum)) {
          // Ensure table exists (safe to run repeatedly)
          await pool.query(`
            CREATE TABLE IF NOT EXISTS previous_month_due_payments (
              id SERIAL PRIMARY KEY,
              history_id INTEGER NOT NULL REFERENCES student_membership_history(id) ON DELETE CASCADE,
              student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
              branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
              amount NUMERIC(12,2) NOT NULL,
              method VARCHAR(10) NOT NULL CHECK (method IN ('cash','online')),
              paid_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              month_tag VARCHAR(7) NOT NULL, -- YYYY-MM representing the month to attribute
              original_month VARCHAR(7) NOT NULL -- YYYY-MM of the history record where due existed
            );
          `);

          const pdpParams = [req.query.month];
          let pdpQuery = `
            SELECT p.id, p.history_id, p.student_id, p.branch_id, p.amount, p.method, p.paid_at, p.month_tag, p.original_month,
                   s.name as student_name, b.name as branch_name
            FROM previous_month_due_payments p
            LEFT JOIN students s ON p.student_id = s.id
            LEFT JOIN branches b ON p.branch_id = b.id
            WHERE p.month_tag = $1
          `;
          if (req.query.branchId) {
            const branchId = parseInt(req.query.branchId, 10);
            if (!isNaN(branchId)) {
              pdpQuery += ' AND p.branch_id = $2';
              pdpParams.push(branchId);
            }
          }
          pdpQuery += ' ORDER BY p.paid_at DESC';
          const pdpRes = await pool.query(pdpQuery, pdpParams);

          const items = pdpRes.rows.map(r => ({
            id: r.id,
            historyId: r.history_id,
            studentId: r.student_id,
            studentName: r.student_name,
            branchId: r.branch_id,
            branchName: r.branch_name,
            amount: parseFloat(r.amount) || 0,
            method: r.method,
            paidAt: r.paid_at,
            monthTag: r.month_tag,
            originalMonth: r.original_month,
          }));
          const totalAmount = items.reduce((s, it) => s + it.amount, 0);
          const totalCash = items.filter(it => it.method === 'cash').reduce((s, it) => s + it.amount, 0);
          const totalOnline = items.filter(it => it.method === 'online').reduce((s, it) => s + it.amount, 0);
          previousDuePaid = { totalAmount, totalCash, totalOnline, items };
        }
      }

      res.json({ collections, previousDuePaid, previousDuePaidAdjustments });
    } catch (err) {
      console.error('Error fetching collections:', err);
      res.status(500).json({ message: 'Server error fetching collections', error: err.message });
    }
  });

  router.put('/:historyId', checkAdminOrStaff, async (req, res) => {
    const client = await pool.connect(); // Use a transaction to ensure consistency
    try {
      await client.query('BEGIN'); // Start transaction

      const { historyId } = req.params;
      const { payment_amount, payment_method } = req.body;

      // Validate payment_amount
      if (typeof payment_amount !== 'number' || payment_amount <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Invalid payment_amount' });
      }

      // Validate payment_method
      if (!['cash', 'online'].includes(payment_method)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Invalid payment_method' });
      }

      // Fetch the existing history record
      const historyRes = await client.query('SELECT * FROM student_membership_history WHERE id = $1', [historyId]);
      if (historyRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'History record not found' });
      }
      const history = historyRes.rows[0];

      // Parse current values as floats, defaulting to 0 if null/undefined
      const current_cash = parseFloat(history.cash) || 0;
      const current_online = parseFloat(history.online) || 0;
      const current_total_fee = parseFloat(history.total_fee) || 0;
      const current_due_amount = parseFloat(history.due_amount) || 0;

      // Calculate new values based on payment method
      let new_cash = current_cash;
      let new_online = current_online;
      if (payment_method === 'cash') {
        new_cash += payment_amount;
      } else if (payment_method === 'online') {
        new_online += payment_amount;
      }

      // Calculate new amount_paid and due_amount
      const new_amount_paid = new_cash + new_online;
      const new_due_amount = current_total_fee - new_amount_paid;

      // Prevent overpayment
      if (new_due_amount < 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Payment exceeds due amount' });
      }

      // Update the student_membership_history table
      await client.query(
        `UPDATE student_membership_history 
         SET cash = $1, online = $2, amount_paid = $3, due_amount = $4 
         WHERE id = $5`,
        [new_cash, new_online, new_amount_paid, new_due_amount, historyId]
      );

      // Fetch the student_id from the history record
      const studentId = history.student_id;

      // Verify the student exists in the students table
      const studentRes = await client.query('SELECT * FROM students WHERE id = $1', [studentId]);
      if (studentRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Student not found for this history record' });
      }

      // Update the students table with the new payment details
      await client.query(
        `UPDATE students 
         SET cash = $1, online = $2, amount_paid = $3, due_amount = $4 
         WHERE id = $5`,
        [new_cash, new_online, new_amount_paid, new_due_amount, studentId]
      );

      // If the payment is for a history record not in the current month, record it as a previous-month due paid
      const historyChangedAt = history.changed_at ? new Date(history.changed_at) : null;
      const now = new Date();
      const toYyyyMm = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const currentMonthTag = toYyyyMm(now);
      const historyMonthTag = historyChangedAt ? toYyyyMm(historyChangedAt) : null;

      if (historyMonthTag && historyMonthTag !== currentMonthTag) {
        // Ensure helper table exists
        await client.query(`
          CREATE TABLE IF NOT EXISTS previous_month_due_payments (
            id SERIAL PRIMARY KEY,
            history_id INTEGER NOT NULL REFERENCES student_membership_history(id) ON DELETE CASCADE,
            student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
            branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
            amount NUMERIC(12,2) NOT NULL,
            method VARCHAR(10) NOT NULL CHECK (method IN ('cash','online')),
            paid_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            month_tag VARCHAR(7) NOT NULL,
            original_month VARCHAR(7) NOT NULL
          );
        `);

        await client.query(
          `INSERT INTO previous_month_due_payments (history_id, student_id, branch_id, amount, method, paid_at, month_tag, original_month)
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6, $7)`,
          [
            historyId,
            studentId,
            history.branch_id,
            payment_amount,
            payment_method,
            currentMonthTag,
            historyMonthTag,
          ]
        );
      }

      // Fetch the updated history record with shift title and branch name
      const updatedRes = await client.query(`
        SELECT 
          smh.id as history_id, 
          smh.student_id, 
          smh.name, 
          sch.title as shift_title, 
          smh.total_fee, 
          smh.amount_paid, 
          smh.due_amount,
          smh.cash,
          smh.online,
          smh.security_money,
          smh.remark,
          smh.changed_at as created_at,
          smh.changed_at as payment_date,
          smh.branch_id,
          b.name as branch_name
        FROM student_membership_history smh
        LEFT JOIN schedules sch ON smh.shift_id = sch.id
        LEFT JOIN branches b ON smh.branch_id = b.id
        WHERE smh.id = $1
      `, [historyId]);
      const updatedHistory = updatedRes.rows[0];

      await client.query('COMMIT'); // Commit transaction

      // Return the updated collection data
      res.json({
        message: 'Payment updated successfully',
        collection: {
          historyId: updatedHistory.history_id,
          studentId: updatedHistory.student_id,
          name: updatedHistory.name,
          shiftTitle: updatedHistory.shift_title,
          totalFee: parseFloat(updatedHistory.total_fee) || 0,
          amountPaid: parseFloat(updatedHistory.amount_paid) || 0,
          dueAmount: parseFloat(updatedHistory.due_amount) || 0,
          cash: parseFloat(updatedHistory.cash) || 0,
          online: parseFloat(updatedHistory.online) || 0,
          securityMoney: parseFloat(updatedHistory.security_money) || 0,
          remark: updatedHistory.remark || '',
          createdAt: updatedHistory.created_at,
          paymentDate: updatedHistory.payment_date,
          branchId: updatedHistory.branch_id,
          branchName: updatedHistory.branch_name
        }
      });
    } catch (err) {
      await client.query('ROLLBACK'); // Roll back transaction on error
      console.error('Error updating payment:', err);
      res.status(500).json({ message: 'Server error updating payment', error: err.message });
    } finally {
      client.release();
    }
  });

  // DELETE a collection entry
  router.delete('/:historyId', checkAdminOrStaff, async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const { historyId } = req.params;

      // First, get the history record to check if it exists and get the student_id
      const historyRes = await client.query(
        'SELECT * FROM student_membership_history WHERE id = $1', 
        [historyId]
      );
      
      if (historyRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Collection record not found' });
      }

      const history = historyRes.rows[0];
      const studentId = history.student_id;

      // Delete the record from student_membership_history
      await client.query(
        'DELETE FROM student_membership_history WHERE id = $1',
        [historyId]
      );

      // Check if there are any remaining history records for this student
      const remainingHistoryRes = await client.query(
        'SELECT * FROM student_membership_history WHERE student_id = $1 ORDER BY id DESC LIMIT 1',
        [studentId]
      );

      if (remainingHistoryRes.rows.length > 0) {
        // If there are remaining history records, update the student record with the latest history
        const latestHistory = remainingHistoryRes.rows[0];
        await client.query(
          `UPDATE students 
           SET cash = $1, online = $2, amount_paid = $3, due_amount = $4,
               total_fee = $5, membership_start = $6, membership_end = $7
           WHERE id = $8`,
          [
            latestHistory.cash || 0,
            latestHistory.online || 0,
            latestHistory.amount_paid || 0,
            latestHistory.due_amount || 0,
            latestHistory.total_fee || 0,
            latestHistory.membership_start,
            latestHistory.membership_end,
            studentId
          ]
        );
      } else {
        // If no history records remain, set default values in the student record
        await client.query(
          `UPDATE students 
           SET cash = 0, online = 0, amount_paid = 0, due_amount = 0
           WHERE id = $1`,
          [studentId]
        );
      }

      await client.query('COMMIT');
      res.json({ message: 'Collection record deleted successfully' });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error deleting collection record:', error);
      res.status(500).json({ 
        message: 'Error deleting collection record', 
        error: error.message 
      });
    } finally {
      client.release();
    }
  });

  return router;
};