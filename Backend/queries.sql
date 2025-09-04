CREATE TABLE IF NOT EXISTS advance_payments (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'online')),
    payment_date TIMESTAMP NOT NULL DEFAULT NOW(),
    used_amount DECIMAL(10,2) DEFAULT 0 CHECK (used_amount >= 0),
    remaining_amount DECIMAL(10,2) GENERATED ALWAYS AS (amount - used_amount) STORED,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'fully_used', 'cancelled')),
    notes TEXT,
    branch_id INTEGER REFERENCES branches(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for advance_payments
CREATE INDEX IF NOT EXISTS idx_advance_payments_student_id ON advance_payments (student_id);
CREATE INDEX IF NOT EXISTS idx_advance_payments_status ON advance_payments (status);
CREATE INDEX IF NOT EXISTS idx_advance_payments_branch_id ON advance_payments (branch_id);
CREATE INDEX IF NOT EXISTS idx_advance_payments_payment_date ON advance_payments (payment_date);

-- Create advance_payment_usage table to track how advance payments are used
CREATE TABLE IF NOT EXISTS advance_payment_usage (
    id SERIAL PRIMARY KEY,
    advance_payment_id INTEGER NOT NULL REFERENCES advance_payments(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    membership_history_id INTEGER REFERENCES student_membership_history(id),
    amount_used DECIMAL(10,2) NOT NULL CHECK (amount_used > 0),
    usage_date TIMESTAMP NOT NULL DEFAULT NOW(),
    usage_type VARCHAR(50) DEFAULT 'membership_renewal',
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for advance_payment_usage
CREATE INDEX IF NOT EXISTS idx_advance_payment_usage_advance_payment_id ON advance_payment_usage (advance_payment_id);
CREATE INDEX IF NOT EXISTS idx_advance_payment_usage_student_id ON advance_payment_usage (student_id);
CREATE INDEX IF NOT EXISTS idx_advance_payment_usage_membership_history_id ON advance_payment_usage (membership_history_id);