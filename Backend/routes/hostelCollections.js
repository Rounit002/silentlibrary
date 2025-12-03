// ./routes/hostelCollections.js (for HOSTEL system)
module.exports = (pool) => {
  const router = require('express').Router();
  const { checkAdminOrStaff } = require('./auth'); 

  router.get('/', checkAdminOrStaff, async (req, res) => {
    try {
      // NOTE: This query has been changed. It now assumes the 'hostel_student_history' table (aliased as hsh)
      // contains 'security_money_cash' and 'security_money_online' columns for each record.
      let queryText = `
        SELECT 
          hsh.id as history_id,
          hsh.student_id,
          hs.name as student_name, 
          hs.branch_id, 
          hb.name as branch_name,
          hs.phone_number as student_phone_number,
          hs.registration_number as student_registration_number,
          hs.room_number as student_current_room_number,
          hsh.stay_start_date,
          hsh.stay_end_date,
          hsh.total_fee,
          hsh.cash_paid,
          hsh.online_paid,
          hsh.due_amount,
          hsh.security_money_cash,    -- <<< ADDED from history table
          hsh.security_money_online,  -- <<< ADDED from history table
          hsh.room_number as history_room_number, 
          hsh.remark as history_remark,
          hsh.created_at as history_created_at,
          hsh.updated_at as history_updated_at 
        FROM hostel_student_history hsh
        LEFT JOIN hostel_students hs ON hsh.student_id = hs.id
        LEFT JOIN hostel_branches hb ON hs.branch_id = hb.id
      `;
      const queryParams = [];
      const conditions = [];

      if (req.query.month && String(req.query.month).trim() !== '') {
        const monthParam = String(req.query.month);
        if (!/^\d{4}-\d{2}$/.test(monthParam)) {
          return res.status(400).json({ message: 'Invalid month format. Use YYYY-MM' });
        }
        const year = parseInt(monthParam.substring(0, 4));
        const month = parseInt(monthParam.substring(5, 7));
        
        if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
            return res.status(400).json({ message: 'Invalid year or month value in month parameter.' });
        }
        
        const firstDayOfMonth = new Date(year, month - 1, 1);
        const firstDayOfNextMonth = new Date(year, month, 1); 

        conditions.push(
          `(hsh.created_at >= $${queryParams.length + 1} AND hsh.created_at < $${queryParams.length + 2})`
        );
        queryParams.push(firstDayOfMonth.toISOString().split('T')[0], firstDayOfNextMonth.toISOString().split('T')[0]);
      }

      if (req.query.branch_id && String(req.query.branch_id).trim() !== '') {
        const branchIdParam = parseInt(String(req.query.branch_id));
        if(isNaN(branchIdParam)){
            return res.status(400).json({ message: 'Invalid branch ID for filtering.' });
        }
        conditions.push(`hs.branch_id = $${queryParams.length + 1}`);
        queryParams.push(branchIdParam);
      }
      
      if (conditions.length > 0) {
        queryText += ` WHERE ${conditions.join(' AND ')}`;
      }

      queryText += ` ORDER BY hsh.created_at DESC`;
      
      console.log('[hostelCollections.js GET] Executing query:', queryText, queryParams);
      const result = await pool.query(queryText, queryParams);
      
      // The API response will now include 'security_money_cash' and 'security_money_online' for each history record.
      // The frontend interceptor will convert these to camelCase.
      res.json({ collections: result.rows });
    } catch (err) {
      console.error('[hostelCollections.js GET] Error fetching hostel collections:', err.stack);
      res.status(500).json({ message: 'Server error fetching collections', error: err.message });
    }
  });

  router.put('/:historyId', checkAdminOrStaff, async (req, res) => {
    try {
      const { historyId } = req.params;
      const parsedHistoryId = parseInt(historyId);
      if (isNaN(parsedHistoryId)) {
        return res.status(400).json({ message: 'Invalid history ID format.' });
      }

      const { payment_amount, payment_type } = req.body;

      if (typeof payment_amount !== 'number' || payment_amount <= 0) {
        return res.status(400).json({ message: 'Payment amount must be a positive number.' });
      }
      if (!['cash', 'online'].includes(payment_type)) {
        return res.status(400).json({ message: 'Invalid payment type. Must be "cash" or "online".' });
      }

      await pool.query('BEGIN');
      const historyRes = await pool.query('SELECT * FROM hostel_student_history WHERE id = $1 FOR UPDATE', [parsedHistoryId]);
      if (historyRes.rows.length === 0) {
        await pool.query('ROLLBACK');
        return res.status(404).json({ message: 'History record not found.' });
      }
      
      const history = historyRes.rows[0];
      const currentTotalFee = parseFloat(history.total_fee);
      let currentCashPaid = parseFloat(history.cash_paid);
      let currentOnlinePaid = parseFloat(history.online_paid);
      const currentDueAmount = parseFloat(history.due_amount);

      if (payment_amount > currentDueAmount + 0.001) { 
        await pool.query('ROLLBACK');
        return res.status(400).json({ message: `Payment amount (₹${payment_amount.toFixed(2)}) exceeds current due amount (₹${currentDueAmount.toFixed(2)}).` });
      }

      if (payment_type === 'cash') {
        currentCashPaid += payment_amount;
      } else { 
        currentOnlinePaid += payment_amount;
      }
      
      const newTotalPaid = currentCashPaid + currentOnlinePaid;
      const newDueAmount = currentTotalFee - newTotalPaid;

      const updateResult = await pool.query(
        'UPDATE hostel_student_history SET cash_paid = $1, online_paid = $2, due_amount = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
        [currentCashPaid.toFixed(2), currentOnlinePaid.toFixed(2), newDueAmount.toFixed(2), parsedHistoryId]
      );
      await pool.query('COMMIT');
      
      res.json({ message: 'Payment updated successfully', updatedHistory: updateResult.rows[0] });
    } catch (err) {
      await pool.query('ROLLBACK');
      console.error('[hostelCollections.js PUT /:historyId] Error updating payment:', err.stack);
      res.status(500).json({ message: 'Server error updating payment', error: err.message });
    }
  });

  // DELETE a hostel collection entry
  router.delete('/:historyId', checkAdminOrStaff, async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const { historyId } = req.params;
      const parsedHistoryId = parseInt(historyId);
      
      if (isNaN(parsedHistoryId)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Invalid history ID format.' });
      }

      // First, get the history record to check if it exists and get the student_id
      const historyRes = await client.query(
        'SELECT * FROM hostel_student_history WHERE id = $1', 
        [parsedHistoryId]
      );
      
      if (historyRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Hostel collection record not found' });
      }

      const history = historyRes.rows[0];
      const studentId = history.student_id;

      // Delete the record from hostel_student_history
      await client.query(
        'DELETE FROM hostel_student_history WHERE id = $1',
        [parsedHistoryId]
      );

      // Check if there are any remaining history records for this student
      const remainingHistoryRes = await client.query(
        'SELECT * FROM hostel_student_history WHERE student_id = $1 ORDER BY id DESC LIMIT 1',
        [studentId]
      );

      if (remainingHistoryRes.rows.length > 0) {
        // If there are remaining history records, only update the timestamp to reflect the deletion
        // Keep the current room_number as is to avoid affecting student's current stay
        await client.query(
          `UPDATE hostel_students 
           SET updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [studentId]
        );
      } else {
        // Only if no history records remain, clear the room number
        await client.query(
          `UPDATE hostel_students 
           SET room_number = NULL, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [studentId]
        );
      }

      await client.query('COMMIT');
      res.json({ message: 'Hostel collection record deleted successfully' });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[hostelCollections.js DELETE] Error deleting collection record:', error);
      res.status(500).json({ 
        message: 'Error deleting hostel collection record', 
        error: error.message 
      });
    } finally {
      client.release();
    }
  });

  return router;
};