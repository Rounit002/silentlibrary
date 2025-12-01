-- Create a sequence for registration numbers
CREATE SEQUENCE IF NOT EXISTS student_registration_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Set the sequence to the configured start value or current max + 1
DO $$
DECLARE
    max_num BIGINT;
    start_num BIGINT;
BEGIN
    -- Get the current max registration number
    SELECT COALESCE(MAX(CAST(registration_number AS BIGINT)), 0) INTO max_num 
    FROM students 
    WHERE registration_number ~ '^\d+$';
    
    -- Get the configured start number
    SELECT COALESCE(CAST(value AS BIGINT), 1) INTO start_num
    FROM settings 
    WHERE key = 'registration_number_start';
    
    -- Set the sequence to the higher of max+1 or configured start
    PERFORM setval('student_registration_number_seq', GREATEST(max_num + 1, start_num), false);
END $$;

-- Update the next registration number endpoint to use the sequence
-- This function will be used by the API to get the next number
CREATE OR REPLACE FUNCTION get_next_registration_number()
RETURNS TEXT AS $$
DECLARE
    next_num BIGINT;
BEGIN
    -- Get the next value from the sequence
    next_num := nextval('student_registration_number_seq');
    
    -- Return as text
    RETURN next_num::TEXT;
END;
$$ LANGUAGE plpgsql;
