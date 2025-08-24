ALTER TABLE student_membership_history
ADD COLUMN payment_date timestamp;

ALTER TABLE students
ADD COLUMN payment_date timestamp;

CREATE INDEX IF NOT EXISTS idx_smh_payment_date
ON student_membership_history (payment_date);