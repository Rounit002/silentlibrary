UPDATE hostel_students
SET created_at = TIMESTAMP '2026-01-22 05:30:00',
    updated_at = NOW()
WHERE LOWER(name) = LOWER('krishna murari');