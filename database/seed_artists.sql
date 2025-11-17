-- Seed 10 dummy makeup artists
-- Run this SQL in your Supabase SQL Editor

INSERT INTO makeup_artists (name, email, whatsapp, created_at, updated_at) VALUES
('Sarah Johnson', 'sarah.johnson@looksbyanum.com', '14165551234', NOW(), NOW()),
('Emily Chen', 'emily.chen@looksbyanum.com', '14165552345', NOW(), NOW()),
('Maria Rodriguez', 'maria.rodriguez@looksbyanum.com', '14165553456', NOW(), NOW()),
('Jessica Williams', 'jessica.williams@looksbyanum.com', '14165554567', NOW(), NOW()),
('Amanda Brown', 'amanda.brown@looksbyanum.com', '14165555678', NOW(), NOW()),
('Nicole Davis', 'nicole.davis@looksbyanum.com', '14165556789', NOW(), NOW()),
('Rachel Martinez', 'rachel.martinez@looksbyanum.com', '14165557890', NOW(), NOW()),
('Lauren Anderson', 'lauren.anderson@looksbyanum.com', '14165558901', NOW(), NOW()),
('Michelle Taylor', 'michelle.taylor@looksbyanum.com', '14165559012', NOW(), NOW()),
('Ashley Thomas', 'ashley.thomas@looksbyanum.com', '14165550123', NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- Verify the data was inserted
SELECT COUNT(*) as total_artists FROM makeup_artists;

