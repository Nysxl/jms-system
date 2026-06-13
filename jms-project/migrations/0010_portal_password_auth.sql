-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add password_hash column to portal_users
ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Function to authenticate portal user (SECURITY DEFINER bypasses RLS, callable by anon)
CREATE OR REPLACE FUNCTION portal_authenticate(p_email TEXT, p_password TEXT)
RETURNS TABLE (
  id UUID,
  email TEXT,
  customer_id UUID,
  is_active INTEGER,
  last_login TIMESTAMPTZ,
  customer_name TEXT,
  customer_address TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  customer_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user portal_users%ROWTYPE;
  v_customer customers%ROWTYPE;
BEGIN
  -- Look up user by email
  SELECT * INTO v_user
  FROM portal_users
  WHERE portal_users.email = lower(trim(p_email))
    AND portal_users.is_active = 1;

  -- Check user exists and password matches
  IF v_user.id IS NULL THEN
    RETURN;
  END IF;

  IF v_user.password_hash IS NULL OR v_user.password_hash = '' THEN
    RETURN;
  END IF;

  IF crypt(p_password, v_user.password_hash) != v_user.password_hash THEN
    RETURN;
  END IF;

  -- Update last_login
  UPDATE portal_users SET last_login = NOW() WHERE portal_users.id = v_user.id;

  -- Get customer data
  SELECT * INTO v_customer FROM customers WHERE customers.id = v_user.customer_id;

  -- Return user + customer data
  RETURN QUERY SELECT
    v_user.id,
    v_user.email,
    v_user.customer_id,
    v_user.is_active,
    v_user.last_login,
    v_customer.name,
    v_customer.address,
    v_customer.phone,
    v_customer.email,
    v_customer.contact_type;
END;
$$;

-- Grant execute to anon and authenticated roles
GRANT EXECUTE ON FUNCTION portal_authenticate(TEXT, TEXT) TO anon, authenticated;

-- Function to set portal user password (callable by authenticated admin users)
CREATE OR REPLACE FUNCTION set_portal_password(p_user_id UUID, p_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE portal_users
  SET password_hash = crypt(p_password, gen_salt('bf', 10))
  WHERE id = p_user_id;

  RETURN FOUND;
END;
$$;

-- Grant execute to authenticated role only (admin must be logged in)
GRANT EXECUTE ON FUNCTION set_portal_password(UUID, TEXT) TO authenticated;
