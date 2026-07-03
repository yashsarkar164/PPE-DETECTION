-- ============================================================================
-- Seed data for PPE Detection Management System
-- Run AFTER schema.sql:  psql -U <user> -d <database> -f seed.sql
--
-- Default credentials (CHANGE IMMEDIATELY after first login in any real deployment):
--   operator / operator123   (role: operator)
--   staff    / staff123      (role: staff)
--
-- Password hashes below are bcrypt (12 rounds) generated for exactly these
-- passwords. To add more users, generate a new hash with:
--   python3 -c "import bcrypt; print(bcrypt.hashpw(b'yourpassword', bcrypt.gensalt()).decode())"
-- ============================================================================

INSERT INTO users (username, password_hash, full_name, role, is_active)
VALUES
    ('operator', '$2b$12$hw.6.WgmXKz/YYb8PsnSSuiW1XQnh.rfNA/0gLegHx8XcsfnW6pwq', 'Site Operator', 'operator', TRUE),
    ('staff',    '$2b$12$yLeXmcq2Fc/vjg.mThcaz.6XdXhmjyh.LtSFYzhMGDABGBIIfwBoe', 'Field Staff',   'staff',    TRUE)
ON CONFLICT (username) DO NOTHING;
