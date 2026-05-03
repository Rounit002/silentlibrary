CREATE TABLE IF NOT EXISTS hostel_seats (
  id SERIAL PRIMARY KEY,
  seat_number VARCHAR(50) NOT NULL,
  branch_id INTEGER NOT NULL REFERENCES hostel_branches(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(seat_number, branch_id)
);

ALTER TABLE hostel_students 
ADD COLUMN room_id INTEGER REFERENCES hostel_seats(id);

ALTER TABLE hostel_student_history 
ADD COLUMN room_id INTEGER REFERENCES hostel_seats(id);