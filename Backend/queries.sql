ALTER TABLE hostel_students
ADD COLUMN security_money_cash NUMERIC(10, 2) DEFAULT 0.00,
ADD COLUMN security_money_online NUMERIC(10, 2) DEFAULT 0.00;


ALTER TABLE hostel_student_history
ADD COLUMN security_money_cash NUMERIC(10, 2) DEFAULT 0.00,
ADD COLUMN security_money_online NUMERIC(10, 2) DEFAULT 0.00;


UPDATE hostel_student_history
SET security_money_cash = hostel_students.security_money
FROM hostel_students
WHERE hostel_student_history.student_id = hostel_students.id;