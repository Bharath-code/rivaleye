CREATE OR REPLACE FUNCTION increment_manual_check_count(user_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE users
    SET manual_checks_today = manual_checks_today + 1
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;
