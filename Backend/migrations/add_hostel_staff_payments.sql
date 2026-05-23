-- Create hostel_staff table
CREATE TABLE IF NOT EXISTS hostel_staff (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on hostel_staff name for faster lookups
CREATE INDEX IF NOT EXISTS idx_hostel_staff_name ON hostel_staff(name);

-- Create hostel_staff_payments table
CREATE TABLE IF NOT EXISTS hostel_staff_payments (
  id SERIAL PRIMARY KEY,
  staff_id INTEGER NOT NULL REFERENCES hostel_staff(id) ON DELETE CASCADE,
  cash DECIMAL(10, 2) DEFAULT 0,
  online DECIMAL(10, 2) DEFAULT 0,
  amount DECIMAL(10, 2) NOT NULL,
  date DATE NOT NULL,
  remark TEXT,
  branch_id INTEGER REFERENCES hostel_branches(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for hostel_staff_payments
CREATE INDEX IF NOT EXISTS idx_hostel_staff_payments_staff_id ON hostel_staff_payments(staff_id);
CREATE INDEX IF NOT EXISTS idx_hostel_staff_payments_date ON hostel_staff_payments(date);
CREATE INDEX IF NOT EXISTS idx_hostel_staff_payments_branch_id ON hostel_staff_payments(branch_id);

-- Add trigger to update updated_at timestamp for hostel_staff
CREATE OR REPLACE FUNCTION update_hostel_staff_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_hostel_staff_updated_at') THEN
    DROP TRIGGER trigger_update_hostel_staff_updated_at ON hostel_staff;
  END IF;
END $$;

CREATE TRIGGER trigger_update_hostel_staff_updated_at
BEFORE UPDATE ON hostel_staff
FOR EACH ROW
EXECUTE FUNCTION update_hostel_staff_updated_at();

-- Add trigger to update updated_at timestamp for hostel_staff_payments
CREATE OR REPLACE FUNCTION update_hostel_staff_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_hostel_staff_payments_updated_at') THEN
    DROP TRIGGER trigger_update_hostel_staff_payments_updated_at ON hostel_staff_payments;
  END IF;
END $$;

CREATE TRIGGER trigger_update_hostel_staff_payments_updated_at
BEFORE UPDATE ON hostel_staff_payments
FOR EACH ROW
EXECUTE FUNCTION update_hostel_staff_payments_updated_at();
