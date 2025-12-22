-- Fix incorrect year values in hostel_expenses table
-- Updates records with year 20258 to 2025

UPDATE hostel_expenses 
SET date = REPLACE(date, '20258-', '2025-')
WHERE date LIKE '20258-%';

-- Verify the fix
SELECT id, title, date, amount 
FROM hostel_expenses 
WHERE date LIKE '2025-%' 
ORDER BY date DESC;
