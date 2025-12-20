// ./routes/hostelStudents.js
const { checkAdminOrStaff } = require('./auth');

module.exports = (pool) => {
  const router = require('express').Router();

  // Helper: convert a student DB row (snake_case) to camelCase-friendly object
  function mapStudentRowToResponse(row) {
    if (!row) return null;
    return {
      // include original row fields too (optional) and add camelCased aliases
      ...row,
      id: row.id,
      branchId: row.branch_id,
      branch_name: row.branch_name,
      name: row.name,
      address: row.address,
      fatherName: row.father_name,
      motherName: row.mother_name,
      aadharNumber: row.aadhar_number,
      phoneNumber: row.phone_number,
      profileImageUrl: row.profile_image_url,
      aadharImageUrl: row.aadhar_image_url,
      religion: row.religion,
      foodPreference: row.food_preference,
      gender: row.gender,
      securityMoney: parseFloat(String(row.security_money || 0)),
      securityMoneyCash: parseFloat(String(row.security_money_cash || 0)),
      securityMoneyOnline: parseFloat(String(row.security_money_online || 0)),
      registrationNumber: row.registration_number,
      roomNumber: row.room_number,
      remark: row.remark,
      studentCreatedAt: row.student_created_at || row.created_at,
      studentUpdatedAt: row.student_updated_at || row.updated_at,
    };
  }

  // Helper: convert a history DB row to camelCase + numeric fields
  function mapHistoryRowToResponse(row) {
    if (!row) return null;
    return {
      ...row,
      id: row.id,
      studentId: row.student_id,
      stayStartDate: row.stay_start_date,
      stayEndDate: row.stay_end_date,
      totalFee: parseFloat(String(row.total_fee || 0)),
      cashPaid: parseFloat(String(row.cash_paid || 0)),
      onlinePaid: parseFloat(String(row.online_paid || 0)),
      dueAmount: parseFloat(String(row.due_amount || 0)),
      securityMoneyCash: parseFloat(String(row.security_money_cash || 0)),
      securityMoneyOnline: parseFloat(String(row.security_money_online || 0)),
      roomNumber: row.room_number,
      remark: row.remark,
      createdAt: row.created_at,
    };
  }

  // GET all hostel students
  router.get('/', checkAdminOrStaff, async (req, res) => {
    try {
      const { branch_id } = req.query;
      let queryText = `
        SELECT 
          s.id, s.branch_id, s.name, s.address, s.father_name, s.mother_name, 
          s.aadhar_number, s.phone_number, s.profile_image_url, s.aadhar_image_url,
          s.religion, s.food_preference, s.gender, s.security_money, s.security_money_cash, s.security_money_online,
          s.registration_number, s.room_number AS student_room_number, s.remark AS student_remark, 
          s.created_at AS student_created_at, s.updated_at AS student_updated_at,
          b.name as branch_name,
          hsh.id as history_id, hsh.stay_start_date, hsh.stay_end_date, hsh.total_fee,
          hsh.cash_paid, hsh.online_paid, hsh.due_amount,
          hsh.room_number AS history_room_number, hsh.remark AS history_remark,
          hsh.created_at AS history_created_at
        FROM hostel_students s
        LEFT JOIN hostel_branches b ON s.branch_id = b.id
        LEFT JOIN (
          SELECT *,
                 ROW_NUMBER() OVER(PARTITION BY student_id ORDER BY stay_end_date DESC, created_at DESC) as rn
          FROM hostel_student_history
        ) hsh ON s.id = hsh.student_id AND hsh.rn = 1
      `;
      const queryParams = [];
      if (branch_id) {
        const parsedQueryBranchId = parseInt(branch_id);
        if (isNaN(parsedQueryBranchId)) {
          return res.status(400).json({ message: 'Invalid branch ID format for filtering.' });
        }
        queryText += ' WHERE s.branch_id = $1';
        queryParams.push(parsedQueryBranchId);
      }
      queryText += ' ORDER BY s.name ASC';

      const result = await pool.query(queryText, queryParams);

      // Map rows: produce student-level object and include the single latest history values (if any) as fields
      const students = result.rows.map(row => {
        const student = {
          id: row.id,
          branch_id: row.branch_id,
          branchName: row.branch_name,
          name: row.name,
          address: row.address,
          father_name: row.father_name,
          mother_name: row.mother_name,
          aadhar_number: row.aadhar_number,
          phone_number: row.phone_number,
          profile_image_url: row.profile_image_url,
          aadhar_image_url: row.aadhar_image_url,
          religion: row.religion,
          food_preference: row.food_preference,
          gender: row.gender,
          security_money: parseFloat(String(row.security_money || 0)),
          security_money_cash: parseFloat(String(row.security_money_cash || 0)),
          security_money_online: parseFloat(String(row.security_money_online || 0)),
          // camelCase aliases
          ...mapStudentRowToResponse(row),
          // Attach latest history snapshot if exists
          latestHistorySnapshot: row.history_id ? {
            id: row.history_id,
            stayStartDate: row.stay_start_date,
            stayEndDate: row.stay_end_date,
            totalFee: parseFloat(String(row.total_fee || 0)),
            cashPaid: parseFloat(String(row.cash_paid || 0)),
            onlinePaid: parseFloat(String(row.online_paid || 0)),
            dueAmount: parseFloat(String(row.due_amount || 0)),
            roomNumber: row.history_room_number,
            remark: row.history_remark,
            createdAt: row.history_created_at,
          } : null
        };
        return student;
      });

      res.json({ students });
    } catch (err) {
      console.error('Error in GET /hostel/students:', err.stack);
      res.status(500).json({ message: 'Server error fetching hostel students', error: err.message });
    }
  });

  // GET a single hostel student by ID with their complete history
  router.get('/:id', checkAdminOrStaff, async (req, res) => {
    try {
      const { id } = req.params;
      const parsedId = parseInt(id);
      if (isNaN(parsedId)) {
        return res.status(400).json({ message: 'Invalid student ID format' });
      }

      const studentResult = await pool.query(
        `SELECT s.*, b.name as branch_name 
         FROM hostel_students s
         LEFT JOIN hostel_branches b ON s.branch_id = b.id
         WHERE s.id = $1`,
        [parsedId]
      );

      if (studentResult.rows.length === 0) {
        return res.status(404).json({ message: 'Student not found' });
      }
      const studentRow = studentResult.rows[0];
      const student = mapStudentRowToResponse(studentRow);

      const historyResult = await pool.query(
        `SELECT * FROM hostel_student_history 
         WHERE student_id = $1 
         ORDER BY stay_start_date DESC, created_at DESC`,
        [parsedId]
      );

      const history = historyResult.rows.map(mapHistoryRowToResponse);

      res.json({ student, history });
    } catch (err) {
      console.error('Error in GET /hostel/students/:id:', err.stack);
      res.status(500).json({ message: 'Server error fetching student details', error: err.message });
    }
  });

  // POST (add) a new hostel student
  router.post('/', checkAdminOrStaff, async (req, res) => {
    console.log('Backend received POST /hostel/students request with body:', JSON.stringify(req.body, null, 2));
    const {
      branch_id, name, address, father_name, mother_name, aadhar_number, phone_number,
      profile_image_url, aadhar_image_url, religion, food_preference, gender,
      security_money_cash, security_money_online,
      registration_number, stay_start_date, stay_end_date, total_fee, cash_paid,
      online_paid, room_number, remark, created_at,
    } = req.body;

    // Validations
    if (!branch_id) return res.status(400).json({ message: 'Branch ID is strictly required.' });
    const parsedBranchId = parseInt(branch_id);
    if (isNaN(parsedBranchId)) return res.status(400).json({ message: 'Branch ID must be a valid number.' });
    if (!name || !name.trim()) return res.status(400).json({ message: 'Name is required.' });
    if (!stay_start_date) return res.status(400).json({ message: 'Stay start date is required.' });
    if (!stay_end_date) return res.status(400).json({ message: 'Stay end date is required.' });
    if (total_fee === undefined || total_fee === null) return res.status(400).json({ message: 'Total fee is required.' });
    const totalFeeNum = parseFloat(total_fee);
    if (isNaN(totalFeeNum) || totalFeeNum < 0) return res.status(400).json({ message: 'Total fee must be a non-negative number.' });
    if (!room_number || !String(room_number).trim()) return res.status(400).json({ message: 'Room number is required.' });
    if (!religion || !String(religion).trim()) return res.status(400).json({ message: 'Religion is required.' });
    if (!food_preference) return res.status(400).json({ message: 'Food preference is required.' });
    if (!gender) return res.status(400).json({ message: 'Gender is required.' });

    const parsedSecurityCash = security_money_cash ? parseFloat(security_money_cash) : 0.0;
    if (isNaN(parsedSecurityCash) || parsedSecurityCash < 0) return res.status(400).json({ message: 'Security money (cash) must be a non-negative number.' });
    const parsedSecurityOnline = security_money_online ? parseFloat(security_money_online) : 0.0;
    if (isNaN(parsedSecurityOnline) || parsedSecurityOnline < 0) return res.status(400).json({ message: 'Security money (online) must be a non-negative number.' });

    const totalSecurityMoney = parsedSecurityCash + parsedSecurityOnline;

    if (aadhar_number && !/^\d{12}$/.test(aadhar_number)) return res.status(400).json({ message: 'Aadhar number must be a 12-digit number.' });
    if (phone_number && !/^\d{10}$/.test(phone_number)) return res.status(400).json({ message: 'Phone number must be a 10-digit number.' });

    const cashPaidNum = cash_paid ? parseFloat(cash_paid) : 0.0;
    if (isNaN(cashPaidNum) || cashPaidNum < 0) return res.status(400).json({ message: 'Cash paid must be a non-negative number.' });
    const onlinePaidNum = online_paid ? parseFloat(online_paid) : 0.0;
    if (isNaN(onlinePaidNum) || onlinePaidNum < 0) return res.status(400).json({ message: 'Online paid must be a non-negative number.' });

    try {
      await pool.query('BEGIN');

      const branchCheck = await pool.query('SELECT id FROM hostel_branches WHERE id = $1', [parsedBranchId]);
      if (branchCheck.rows.length === 0) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ message: `Branch with ID ${parsedBranchId} does not exist.` });
      }

      const studentInsertQuery = `
        INSERT INTO hostel_students (
          branch_id, name, address, father_name, mother_name, aadhar_number, phone_number,
          profile_image_url, aadhar_image_url, religion, food_preference, gender, 
          security_money, security_money_cash, security_money_online, 
          registration_number, room_number, remark, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, CURRENT_TIMESTAMP) 
        RETURNING *`;
      const studentInsertParams = [
        parsedBranchId, name.trim(), address || null, father_name || null, mother_name || null,
        aadhar_number || null, phone_number || null, profile_image_url || null, aadhar_image_url || null,
        String(religion).trim(), food_preference, gender, totalSecurityMoney, parsedSecurityCash, parsedSecurityOnline,
        registration_number || null, String(room_number).trim(), remark || null, created_at || null
      ];
      const studentResult = await pool.query(studentInsertQuery, studentInsertParams);
      const newStudent = studentResult.rows[0];

      const totalPaid = cashPaidNum + onlinePaidNum;
      const dueAmount = totalFeeNum - totalPaid;

      const historyInsertQuery = `
        INSERT INTO hostel_student_history (
          student_id, stay_start_date, stay_end_date, total_fee, cash_paid, online_paid, due_amount, 
          security_money_cash, security_money_online, room_number, remark, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP) 
        RETURNING *`;
      const historyInsertParams = [
        newStudent.id, stay_start_date, stay_end_date, totalFeeNum, cashPaidNum, onlinePaidNum,
        dueAmount, parsedSecurityCash, parsedSecurityOnline, String(room_number).trim(), remark || null
      ];
      const historyResult = await pool.query(historyInsertQuery, historyInsertParams);
      const newHistory = historyResult.rows[0];

      await pool.query('COMMIT');
      res.status(201).json({ student: mapStudentRowToResponse(newStudent), history: mapHistoryRowToResponse(newHistory) });

    } catch (err) {
      await pool.query('ROLLBACK');
      console.error('Error in POST /hostel/students:', err.stack);
      if (err.code === '23503') {
        res.status(400).json({ message: `Invalid reference for ${err.constraint || 'a foreign key'}. Please check input values.`, errorDetail: err.detail });
      } else if (err.code === '23505') {
        res.status(409).json({ message: `Duplicate entry for ${err.constraint || 'a unique field'}. This value already exists.`, errorDetail: err.detail });
      } else {
        res.status(500).json({ message: err.message || 'Server error adding hostel student', error: err.toString() });
      }
    }
  });

  // PUT (update) a hostel student and optionally update the latest history properly
  router.put('/:id', checkAdminOrStaff, async (req, res) => {
    const { id } = req.params;
    const studentId = parseInt(id);
    if (isNaN(studentId)) {
      return res.status(400).json({ message: 'Invalid student ID format' });
    }

    console.log(`Backend received PUT /hostel/students/${studentId} with body:`, JSON.stringify(req.body, null, 2));

    const {
      branch_id, name, address, father_name, mother_name, aadhar_number, phone_number,
      profile_image_url, aadhar_image_url, religion, food_preference, gender,
      security_money, security_money_cash, security_money_online,
      registration_number, room_number, remark,
      // Optional history-related fields (if provided on edit)
      stay_start_date, stay_end_date, total_fee, cash_paid, online_paid,
    } = req.body;

    // Validate branch id if provided
    let parsedBranchId;
    if (branch_id !== undefined && branch_id !== null && String(branch_id).trim() !== '') {
      parsedBranchId = parseInt(branch_id);
      if (isNaN(parsedBranchId)) return res.status(400).json({ message: 'Branch ID must be a valid number if provided.' });
    }

    // Parse security fields if present
    const parsedSecurityCash = (security_money_cash !== undefined && security_money_cash !== null) ? parseFloat(security_money_cash) : undefined;
    if (parsedSecurityCash !== undefined && (isNaN(parsedSecurityCash) || parsedSecurityCash < 0)) {
      return res.status(400).json({ message: 'Security money (cash) must be a non-negative number.' });
    }
    const parsedSecurityOnline = (security_money_online !== undefined && security_money_online !== null) ? parseFloat(security_money_online) : undefined;
    if (parsedSecurityOnline !== undefined && (isNaN(parsedSecurityOnline) || parsedSecurityOnline < 0)) {
      return res.status(400).json({ message: 'Security money (online) must be a non-negative number.' });
    }

    // Validate optional numeric history fields if provided
    const parsedTotalFee = (total_fee !== undefined && total_fee !== null && String(total_fee).trim() !== '') ? parseFloat(total_fee) : undefined;
    if (parsedTotalFee !== undefined && (isNaN(parsedTotalFee) || parsedTotalFee < 0)) return res.status(400).json({ message: 'Total fee must be a non-negative number.' });
    const parsedCashPaid = (cash_paid !== undefined && cash_paid !== null && String(cash_paid).trim() !== '') ? parseFloat(cash_paid) : undefined;
    if (parsedCashPaid !== undefined && (isNaN(parsedCashPaid) || parsedCashPaid < 0)) return res.status(400).json({ message: 'Cash paid must be a non-negative number.' });
    const parsedOnlinePaid = (online_paid !== undefined && online_paid !== null && String(online_paid).trim() !== '') ? parseFloat(online_paid) : undefined;
    if (parsedOnlinePaid !== undefined && (isNaN(parsedOnlinePaid) || parsedOnlinePaid < 0)) return res.status(400).json({ message: 'Online paid must be a non-negative number.' });

    if (aadhar_number && !/^\d{12}$/.test(aadhar_number)) return res.status(400).json({ message: 'Aadhar number must be a 12-digit number.' });
    if (phone_number && !/^\d{10}$/.test(phone_number)) return res.status(400).json({ message: 'Phone number must be a 10-digit number.' });

    try {
      await pool.query('BEGIN');

      // If branch change requested, validate branch
      if (parsedBranchId !== undefined) {
        const branchCheck = await pool.query('SELECT id FROM hostel_branches WHERE id = $1', [parsedBranchId]);
        if (branchCheck.rows.length === 0) {
          await pool.query('ROLLBACK');
          return res.status(400).json({ message: `Branch with ID ${parsedBranchId} does not exist.` });
        }
      }

      // Build student update query dynamically
      const fieldsToUpdate = [];
      const valuesToUpdate = [];
      let paramCount = 1;

      const updatableStudentFields = {
        branch_id: parsedBranchId,
        name: name?.trim(),
        address: address !== undefined ? (address?.trim() || null) : undefined,
        father_name: father_name !== undefined ? (father_name?.trim() || null) : undefined,
        mother_name: mother_name !== undefined ? (mother_name?.trim() || null) : undefined,
        aadhar_number: aadhar_number !== undefined ? (aadhar_number || null) : undefined,
        phone_number: phone_number !== undefined ? (phone_number || null) : undefined,
        profile_image_url: profile_image_url !== undefined ? (profile_image_url || null) : undefined,
        aadhar_image_url: aadhar_image_url !== undefined ? (aadhar_image_url || null) : undefined,
        religion: religion?.trim(),
        food_preference: food_preference,
        gender: gender,
        // Only include security fields if provided (will be undefined otherwise)
        security_money: (parsedSecurityCash !== undefined || parsedSecurityOnline !== undefined) ? undefined : undefined,
        security_money_cash: parsedSecurityCash,
        security_money_online: parsedSecurityOnline,
        registration_number: registration_number !== undefined ? (registration_number?.trim() || null) : undefined,
        room_number: room_number !== undefined ? (room_number?.trim() || null) : undefined,
        remark: remark !== undefined ? (remark?.trim() || null) : undefined,
      };

      // If security parts were provided, compute total using DB for any missing split
      let computedTotalSecurity = undefined;
      if (parsedSecurityCash !== undefined || parsedSecurityOnline !== undefined) {
        // read current DB splits
        const currentStudentRes = await pool.query('SELECT security_money_cash, security_money_online FROM hostel_students WHERE id = $1', [studentId]);
        if (currentStudentRes.rows.length === 0) {
          await pool.query('ROLLBACK');
          return res.status(404).json({ message: 'Student not found for security money update.' });
        }
        const currentRow = currentStudentRes.rows[0];
        const currentCash = parseFloat(String(currentRow.security_money_cash || 0));
        const currentOnline = parseFloat(String(currentRow.security_money_online || 0));
        const newCash = parsedSecurityCash !== undefined ? parsedSecurityCash : currentCash;
        const newOnline = parsedSecurityOnline !== undefined ? parsedSecurityOnline : currentOnline;
        computedTotalSecurity = newCash + newOnline;

        // override to include computed values in update
        updatableStudentFields.security_money_cash = newCash;
        updatableStudentFields.security_money_online = newOnline;
        updatableStudentFields.security_money = computedTotalSecurity;
      }

      // Add each defined field to update arrays
      for (const [key, value] of Object.entries(updatableStudentFields)) {
        if (value !== undefined) {
          fieldsToUpdate.push(`${key} = $${paramCount++}`);
          valuesToUpdate.push(value);
        }
      }

      if (fieldsToUpdate.length > 0) {
        fieldsToUpdate.push(`updated_at = CURRENT_TIMESTAMP`);
        // studentId goes as last param for WHERE clause
        valuesToUpdate.push(studentId);

        const studentUpdateQuery = `
          UPDATE hostel_students
          SET ${fieldsToUpdate.join(', ')}
          WHERE id = $${paramCount}
          RETURNING *`;
        console.log('[hostelStudents.js PUT] Executing student update query:', studentUpdateQuery, valuesToUpdate);
        const updateResult = await pool.query(studentUpdateQuery, valuesToUpdate);

        if (updateResult.rows.length === 0) {
          await pool.query('ROLLBACK');
          return res.status(404).json({ message: 'Student not found during update' });
        }
      }

      // Now handle latest history update if any history-related fields were provided
      const historyFieldsToUpdate = [];
      const historyValuesToUpdate = [];
      let historyParamCount = 1;
      let shouldUpdateHistory = false;

      // Fetch latest history id (if any)
      const latestHistoryRes = await pool.query(
        `SELECT * FROM hostel_student_history WHERE student_id = $1 ORDER BY stay_start_date DESC, created_at DESC LIMIT 1`,
        [studentId]
      );

      const latestHistoryRow = latestHistoryRes.rows[0];

      if (latestHistoryRow) {
        // If room_number or remark provided, update them in the latest history
        if (room_number !== undefined) {
          historyFieldsToUpdate.push(`room_number = $${historyParamCount++}`);
          historyValuesToUpdate.push(String(room_number).trim());
          shouldUpdateHistory = true;
        }
        if (remark !== undefined) {
          historyFieldsToUpdate.push(`remark = $${historyParamCount++}`);
          historyValuesToUpdate.push(remark?.trim() || null);
          shouldUpdateHistory = true;
        }

        // If security parts were provided (or computedTotalSecurity exists), update history's security columns
        if (parsedSecurityCash !== undefined || parsedSecurityOnline !== undefined) {
          // compute values using computedTotalSecurity or fallbacks
          const historyNewCash = parsedSecurityCash !== undefined ? parsedSecurityCash : parseFloat(String(latestHistoryRow.security_money_cash || 0));
          const historyNewOnline = parsedSecurityOnline !== undefined ? parsedSecurityOnline : parseFloat(String(latestHistoryRow.security_money_online || 0));
          historyFieldsToUpdate.push(`security_money_cash = $${historyParamCount++}`);
          historyValuesToUpdate.push(historyNewCash);
          historyFieldsToUpdate.push(`security_money_online = $${historyParamCount++}`);
          historyValuesToUpdate.push(historyNewOnline);
          shouldUpdateHistory = true;
        }

        // If total_fee / cash_paid / online_paid provided, update and recompute due_amount
        if (parsedTotalFee !== undefined || parsedCashPaid !== undefined || parsedOnlinePaid !== undefined) {
          const newTotalFee = parsedTotalFee !== undefined ? parsedTotalFee : parseFloat(String(latestHistoryRow.total_fee || 0));
          const newCashPaid = parsedCashPaid !== undefined ? parsedCashPaid : parseFloat(String(latestHistoryRow.cash_paid || 0));
          const newOnlinePaid = parsedOnlinePaid !== undefined ? parsedOnlinePaid : parseFloat(String(latestHistoryRow.online_paid || 0));
          const newDue = newTotalFee - (newCashPaid + newOnlinePaid);

          historyFieldsToUpdate.push(`total_fee = $${historyParamCount++}`);
          historyValuesToUpdate.push(newTotalFee);
          historyFieldsToUpdate.push(`cash_paid = $${historyParamCount++}`);
          historyValuesToUpdate.push(newCashPaid);
          historyFieldsToUpdate.push(`online_paid = $${historyParamCount++}`);
          historyValuesToUpdate.push(newOnlinePaid);
          historyFieldsToUpdate.push(`due_amount = $${historyParamCount++}`);
          historyValuesToUpdate.push(newDue);

          shouldUpdateHistory = true;
        }

        // If stay dates provided, update them (rarely edited, but included)
        if (stay_start_date !== undefined) {
          historyFieldsToUpdate.push(`stay_start_date = $${historyParamCount++}`);
          historyValuesToUpdate.push(stay_start_date);
          shouldUpdateHistory = true;
        }
        if (stay_end_date !== undefined) {
          historyFieldsToUpdate.push(`stay_end_date = $${historyParamCount++}`);
          historyValuesToUpdate.push(stay_end_date);
          shouldUpdateHistory = true;
        }

        if (shouldUpdateHistory && historyFieldsToUpdate.length > 0) {
          historyValuesToUpdate.push(latestHistoryRow.id); // WHERE id = $n
          const historyUpdateQuery = `UPDATE hostel_student_history SET ${historyFieldsToUpdate.join(', ')} WHERE id = $${historyParamCount}`;
          console.log('[hostelStudents.js PUT] Executing history update:', historyUpdateQuery, historyValuesToUpdate);
          await pool.query(historyUpdateQuery, historyValuesToUpdate);
        }
      } else {
        // No history row exists. If history fields are provided, we could create a history row.
        // For safety, do not automatically create unless stay_start_date and stay_end_date + total_fee present.
        if ((stay_start_date && stay_end_date && parsedTotalFee !== undefined) && (parsedCashPaid !== undefined || parsedOnlinePaid !== undefined)) {
          const createHistoryQuery = `
            INSERT INTO hostel_student_history (
              student_id, stay_start_date, stay_end_date, total_fee, cash_paid, online_paid, due_amount,
              security_money_cash, security_money_online, room_number, remark, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
            RETURNING *`;
          const createParams = [
            studentId,
            stay_start_date,
            stay_end_date,
            parsedTotalFee,
            parsedCashPaid || 0.0,
            parsedOnlinePaid || 0.0,
            parsedTotalFee - ((parsedCashPaid || 0.0) + (parsedOnlinePaid || 0.0)),
            parsedSecurityCash || 0.0,
            parsedSecurityOnline || 0.0,
            room_number ? String(room_number).trim() : null,
            remark || null
          ];
          await pool.query(createHistoryQuery, createParams);
        }
      }

      await pool.query('COMMIT');

      // Fetch updated student and full history to return (and map to camelCase)
      const updatedStudentRes = await pool.query('SELECT s.*, b.name as branch_name FROM hostel_students s LEFT JOIN hostel_branches b ON s.branch_id = b.id WHERE s.id = $1', [studentId]);
      if (updatedStudentRes.rows.length === 0) {
        return res.status(404).json({ message: 'Student not found after update.' });
      }
      const updatedStudent = mapStudentRowToResponse(updatedStudentRes.rows[0]);

      const newHistoryRes = await pool.query(
        `SELECT * FROM hostel_student_history WHERE student_id = $1 ORDER BY stay_start_date DESC, created_at DESC`,
        [studentId]
      );
      const history = newHistoryRes.rows.map(mapHistoryRowToResponse);

      res.json({ student: updatedStudent, history, message: "Student details updated successfully." });

    } catch (err) {
      await pool.query('ROLLBACK');
      console.error('Error in PUT /hostel/students/:id:', err.stack);
      res.status(500).json({ message: 'Server error updating hostel student', error: err.message });
    }
  });

  // POST to renew a student's stay (adds to history)
  router.post('/:id/renew', checkAdminOrStaff, async (req, res) => {
    const { id } = req.params;
    const studentId = parseInt(id);
    if (isNaN(studentId)) {
      return res.status(400).json({ message: 'Invalid student ID format' });
    }

    const {
      stay_start_date, stay_end_date, total_fee, cash_paid, online_paid,
      room_number, remark, created_at,
    } = req.body;

    if (!stay_start_date || !stay_end_date || total_fee === undefined || room_number === undefined || String(room_number).trim() === '') {
      return res.status(400).json({ message: 'Missing required fields for renewal: stay dates, total fee, and room number are required.' });
    }
    const totalFeeNum = parseFloat(total_fee);
    if (isNaN(totalFeeNum) || totalFeeNum < 0) return res.status(400).json({ message: 'Total fee must be a non-negative number.' });
    const cashPaidNum = cash_paid ? parseFloat(cash_paid) : 0.0;
    const onlinePaidNum = online_paid ? parseFloat(online_paid) : 0.0;

    try {
      await pool.query('BEGIN');

      const studentRes = await pool.query('SELECT id, room_number FROM hostel_students WHERE id = $1', [studentId]);
      if (studentRes.rows.length === 0) {
        await pool.query('ROLLBACK');
        return res.status(404).json({ message: 'Student not found for renewal.' });
      }

      if (studentRes.rows[0].room_number !== String(room_number).trim()) {
        await pool.query('UPDATE hostel_students SET room_number = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [String(room_number).trim(), studentId]);
      }

      const totalPaid = cashPaidNum + onlinePaidNum;
      const dueAmount = totalFeeNum - totalPaid;

      const historyInsertQuery = `
            INSERT INTO hostel_student_history (
                student_id, stay_start_date, stay_end_date, total_fee, cash_paid, online_paid, due_amount, 
                security_money_cash, security_money_online, room_number, remark, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
            RETURNING *`;
      const historyInsertParams = [
        studentId,
        stay_start_date,
        stay_end_date,
        totalFeeNum,
        cashPaidNum,
        onlinePaidNum,
        dueAmount,
        0.0,
        0.0,
        String(room_number).trim(),
        remark || null,
        created_at || null
      ];
      const historyResult = await pool.query(historyInsertQuery, historyInsertParams);

      await pool.query('COMMIT');
      res.json({ history: mapHistoryRowToResponse(historyResult.rows[0]), message: "Student renewed successfully." });

    } catch (err) {
      await pool.query('ROLLBACK');
      console.error('Error in POST /hostel/students/:id/renew:', err.stack);
      res.status(500).json({ message: 'Server error renewing student stay', error: err.message });
    }
  });

  // GET expired hostel students
  router.get('/meta/expired', checkAdminOrStaff, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT hs.id, hs.name, hs.phone_number, hs.aadhar_number, hs.room_number,
               MAX(hsh.stay_end_date) as latest_stay_end_date,
               b.name as branch_name
        FROM hostel_students hs
        LEFT JOIN hostel_student_history hsh ON hs.id = hsh.student_id 
        LEFT JOIN hostel_branches b ON hs.branch_id = b.id
        WHERE hsh.id IS NOT NULL 
        GROUP BY hs.id, b.name, hs.phone_number, hs.aadhar_number, hs.room_number
        HAVING MAX(hsh.stay_end_date) < CURRENT_DATE
        ORDER BY hs.name ASC
      `);
      res.json({ expiredStudents: result.rows });
    } catch (err) {
      console.error('Error fetching expired hostel students:', err.stack);
      res.status(500).json({ message: 'Server error fetching expired students', error: err.message });
    }
  });

  // DELETE a hostel student
  router.delete('/:id', checkAdminOrStaff, async (req, res) => {
    const { id } = req.params;
    const parsedId = parseInt(id);
    if (isNaN(parsedId)) {
      return res.status(400).json({ message: 'Invalid student ID format' });
    }
    try {
      await pool.query('BEGIN');
      await pool.query('DELETE FROM hostel_student_history WHERE student_id = $1', [parsedId]);

      const result = await pool.query('DELETE FROM hostel_students WHERE id = $1 RETURNING *', [parsedId]);
      if (result.rowCount === 0) {
        await pool.query('ROLLBACK');
        return res.status(404).json({ message: 'Student not found' });
      }
      await pool.query('COMMIT');
      res.json({ message: 'Student and their history deleted successfully', student: result.rows[0] });
    } catch (err) {
      await pool.query('ROLLBACK');
      console.error('Error in DELETE /hostel/students/:id:', err.stack);
      if (err.code === '23503') {
        res.status(409).json({ message: 'Cannot delete student due to related records in other tables (foreign key constraint).', errorDetail: err.detail });
      } else {
        res.status(500).json({ message: 'Server error deleting hostel student', error: err.message });
      }
    }
  });

  return router;
};
