module.exports = (pool) => {
  const router = require('express').Router();
  const { checkAdmin, checkAdminOrStaff } = require('./auth');

  // GET all advance payments with filters
  router.get('/', checkAdminOrStaff, async (req, res) => {
    try {
      const { branchId, studentId, status, startDate, endDate } = req.query;
      
      let query = `
        SELECT 
          ap.id,
          ap.student_id,
          s.name as student_name,
          s.phone as student_phone,
          s.registration_number,
          ap.amount,
          ap.payment_method,
          ap.payment_date,
          ap.used_amount,
          ap.remaining_amount,
          ap.status,
          ap.notes,
          ap.branch_id,
          b.name as branch_name,
          ap.created_at,
          ap.updated_at
        FROM advance_payments ap
        LEFT JOIN students s ON ap.student_id = s.id
        LEFT JOIN branches b ON ap.branch_id = b.id
        WHERE 1=1
      `;
      
      const params = [];
      let paramIndex = 1;

      if (branchId) {
        query += ` AND ap.branch_id = $${paramIndex}`;
        params.push(parseInt(branchId, 10));
        paramIndex++;
      }

      if (studentId) {
        query += ` AND ap.student_id = $${paramIndex}`;
        params.push(parseInt(studentId, 10));
        paramIndex++;
      }

      if (status) {
        query += ` AND ap.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      // Add date range filter
      if (startDate) {
        query += ` AND ap.payment_date >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }
      
      if (endDate) {
        query += ` AND ap.payment_date <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      query += ` ORDER BY ap.payment_date DESC`;

      const result = await pool.query(query, params);
      
      const advancePayments = result.rows.map(row => ({
        id: row.id,
        studentId: row.student_id,
        studentName: row.student_name,
        studentPhone: row.student_phone,
        registrationNumber: row.registration_number,
        amount: parseFloat(row.amount),
        paymentMethod: row.payment_method,
        paymentDate: row.payment_date,
        usedAmount: parseFloat(row.used_amount || 0),
        remainingAmount: parseFloat(row.remaining_amount || 0),
        status: row.status,
        notes: row.notes || '',
        branchId: row.branch_id,
        branchName: row.branch_name,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));

      res.json({ advancePayments });
    } catch (err) {
      console.error('Error fetching advance payments:', err);
      res.status(500).json({ message: 'Server error fetching advance payments', error: err.message });
    }
  });

  // GET advance payments for a specific student
  router.get('/student/:studentId', checkAdminOrStaff, async (req, res) => {
    try {
      const { studentId } = req.params;
      
      const query = `
        SELECT 
          ap.id,
          ap.amount,
          ap.payment_method,
          ap.payment_date,
          ap.used_amount,
          ap.remaining_amount,
          ap.status,
          ap.notes,
          ap.created_at
        FROM advance_payments ap
        WHERE ap.student_id = $1 AND ap.status = 'active'
        ORDER BY ap.payment_date DESC
      `;

      const result = await pool.query(query, [parseInt(studentId, 10)]);
      
      const advancePayments = result.rows.map(row => ({
        id: row.id,
        amount: parseFloat(row.amount),
        paymentMethod: row.payment_method,
        paymentDate: row.payment_date,
        usedAmount: parseFloat(row.used_amount || 0),
        remainingAmount: parseFloat(row.remaining_amount || 0),
        status: row.status,
        notes: row.notes || '',
        createdAt: row.created_at
      }));

      // Calculate total available advance amount
      const totalAvailable = advancePayments.reduce((sum, payment) => sum + payment.remainingAmount, 0);

      res.json({ 
        advancePayments,
        totalAvailableAmount: totalAvailable
      });
    } catch (err) {
      console.error('Error fetching student advance payments:', err);
      res.status(500).json({ message: 'Server error fetching student advance payments', error: err.message });
    }
  });

  // POST create new advance payment
  router.post('/', checkAdminOrStaff, async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const {
        student_id,
        amount,
        payment_method,
        payment_date,
        notes,
        branch_id
      } = req.body;

      // Validate required fields
      if (!student_id || !amount || !payment_method) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          message: 'Required fields missing (student_id, amount, payment_method)' 
        });
      }

      // Validate student exists
      const studentCheck = await client.query('SELECT id, name FROM students WHERE id = $1', [student_id]);
      if (studentCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Student not found' });
      }

      // Validate amount
      const amountValue = parseFloat(amount);
      if (isNaN(amountValue) || amountValue <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Amount must be a positive number' });
      }

      // Validate payment method
      if (!['cash', 'online'].includes(payment_method)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Payment method must be cash or online' });
      }

      // Insert advance payment
      const result = await client.query(
        `INSERT INTO advance_payments (
          student_id, amount, payment_method, payment_date, notes, branch_id
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [
          student_id,
          amountValue,
          payment_method,
          payment_date || new Date(),
          notes || null,
          branch_id || null
        ]
      );

      await client.query('COMMIT');

      const advancePayment = result.rows[0];
      res.status(201).json({
        message: 'Advance payment created successfully',
        advancePayment: {
          id: advancePayment.id,
          studentId: advancePayment.student_id,
          amount: parseFloat(advancePayment.amount),
          paymentMethod: advancePayment.payment_method,
          paymentDate: advancePayment.payment_date,
          usedAmount: parseFloat(advancePayment.used_amount || 0),
          remainingAmount: parseFloat(advancePayment.remaining_amount || 0),
          status: advancePayment.status,
          notes: advancePayment.notes || '',
          branchId: advancePayment.branch_id,
          createdAt: advancePayment.created_at
        }
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error creating advance payment:', err);
      res.status(500).json({ message: 'Server error creating advance payment', error: err.message });
    } finally {
      client.release();
    }
  });

  // PUT update advance payment
  router.put('/:id', checkAdminOrStaff, async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { id } = req.params;
      const { amount, payment_method, payment_date, notes, status } = req.body;

      // Check if advance payment exists
      const existingPayment = await client.query('SELECT * FROM advance_payments WHERE id = $1', [id]);
      if (existingPayment.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Advance payment not found' });
      }

      const current = existingPayment.rows[0];

      // Validate amount if provided
      let amountValue = parseFloat(current.amount);
      if (amount !== undefined) {
        amountValue = parseFloat(amount);
        if (isNaN(amountValue) || amountValue <= 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ message: 'Amount must be a positive number' });
        }

        // Check if new amount is less than used amount
        if (amountValue < parseFloat(current.used_amount)) {
          await client.query('ROLLBACK');
          return res.status(400).json({ 
            message: 'New amount cannot be less than already used amount' 
          });
        }
      }

      // Update advance payment
      const result = await client.query(
        `UPDATE advance_payments 
         SET amount = $1, payment_method = $2, payment_date = $3, notes = $4, status = $5, updated_at = NOW()
         WHERE id = $6
         RETURNING *`,
        [
          amountValue,
          payment_method || current.payment_method,
          payment_date || current.payment_date,
          notes !== undefined ? notes : current.notes,
          status || current.status,
          id
        ]
      );

      await client.query('COMMIT');

      const updatedPayment = result.rows[0];
      res.json({
        message: 'Advance payment updated successfully',
        advancePayment: {
          id: updatedPayment.id,
          studentId: updatedPayment.student_id,
          amount: parseFloat(updatedPayment.amount),
          paymentMethod: updatedPayment.payment_method,
          paymentDate: updatedPayment.payment_date,
          usedAmount: parseFloat(updatedPayment.used_amount || 0),
          remainingAmount: parseFloat(updatedPayment.remaining_amount || 0),
          status: updatedPayment.status,
          notes: updatedPayment.notes || '',
          branchId: updatedPayment.branch_id,
          updatedAt: updatedPayment.updated_at
        }
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error updating advance payment:', err);
      res.status(500).json({ message: 'Server error updating advance payment', error: err.message });
    } finally {
      client.release();
    }
  });

  // DELETE advance payment (completely remove from system)
  router.delete('/:id', checkAdminOrStaff, async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { id } = req.params;

      // Check if advance payment exists
      const existingPayment = await client.query('SELECT * FROM advance_payments WHERE id = $1', [id]);
      if (existingPayment.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Advance payment not found' });
      }

      // First delete any usage records for this advance payment
      await client.query('DELETE FROM advance_payment_usage WHERE advance_payment_id = $1', [id]);
      
      // Then delete the advance payment itself
      await client.query('DELETE FROM advance_payments WHERE id = $1', [id]);

      await client.query('COMMIT');

      res.json({ message: 'Advance payment deleted successfully' });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error deleting advance payment:', err);
      res.status(500).json({ message: 'Server error deleting advance payment', error: err.message });
    } finally {
      client.release();
    }
  });

  // POST use advance payment for membership renewal
  router.post('/:id/use', checkAdminOrStaff, async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { id } = req.params;
      const { amount_to_use, membership_history_id, notes } = req.body;

      // Validate advance payment exists and is active
      const advancePayment = await client.query(
        'SELECT * FROM advance_payments WHERE id = $1 AND status = $2',
        [id, 'active']
      );

      if (advancePayment.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Active advance payment not found' });
      }

      const payment = advancePayment.rows[0];
      const amountToUse = parseFloat(amount_to_use);
      const currentUsed = parseFloat(payment.used_amount || 0);
      const remainingAmount = parseFloat(payment.amount) - currentUsed;

      // Validate amount to use
      if (isNaN(amountToUse) || amountToUse <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Amount to use must be a positive number' });
      }

      if (amountToUse > remainingAmount) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          message: `Insufficient advance balance. Available: ${remainingAmount}` 
        });
      }

      // Record the usage
      await client.query(
        `INSERT INTO advance_payment_usage (
          advance_payment_id, student_id, membership_history_id, amount_used, notes
        ) VALUES ($1, $2, $3, $4, $5)`,
        [id, payment.student_id, membership_history_id || null, amountToUse, notes || null]
      );

      // Update advance payment used amount
      const newUsedAmount = currentUsed + amountToUse;
      const newStatus = newUsedAmount >= parseFloat(payment.amount) ? 'fully_used' : 'active';

      await client.query(
        'UPDATE advance_payments SET used_amount = $1, status = $2, updated_at = NOW() WHERE id = $3',
        [newUsedAmount, newStatus, id]
      );

      await client.query('COMMIT');

      res.json({
        message: 'Advance payment used successfully',
        usedAmount: amountToUse,
        remainingAmount: parseFloat(payment.amount) - newUsedAmount,
        newStatus
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error using advance payment:', err);
      res.status(500).json({ message: 'Server error using advance payment', error: err.message });
    } finally {
      client.release();
    }
  });

  // GET advance payment usage history
  router.get('/:id/usage', checkAdminOrStaff, async (req, res) => {
    try {
      const { id } = req.params;

      const query = `
        SELECT 
          apu.id,
          apu.amount_used,
          apu.usage_date,
          apu.usage_type,
          apu.notes,
          smh.membership_start,
          smh.membership_end
        FROM advance_payment_usage apu
        LEFT JOIN student_membership_history smh ON apu.membership_history_id = smh.id
        WHERE apu.advance_payment_id = $1
        ORDER BY apu.usage_date DESC
      `;

      const result = await pool.query(query, [id]);
      
      const usageHistory = result.rows.map(row => ({
        id: row.id,
        amountUsed: parseFloat(row.amount_used),
        usageDate: row.usage_date,
        usageType: row.usage_type,
        notes: row.notes || '',
        membershipStart: row.membership_start,
        membershipEnd: row.membership_end
      }));

      res.json({ usageHistory });
    } catch (err) {
      console.error('Error fetching advance payment usage:', err);
      res.status(500).json({ message: 'Server error fetching usage history', error: err.message });
    }
  });

  return router;
};
