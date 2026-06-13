import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

  // Authenticate via Supabase Auth
  const { data: authData, error: authError } = await supabaseAnon.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  console.log('Auth attempt:', { email: email.trim().toLowerCase(), authError, userExists: !!authData?.user });

  if (authError || !authData.user) {
    console.error('Auth failed:', authError?.message);
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  // Get portal user details
  const { data: portalUser, error: portalError } = await supabaseAdmin
    .from('portal_users')
    .select('*, customer:customers(*)')
    .eq('email', email.trim().toLowerCase())
    .eq('is_active', 1)
    .maybeSingle();

  console.log('Portal user lookup:', { email: email.trim().toLowerCase(), portalError, userFound: !!portalUser, isActive: portalUser?.is_active });

  if (portalError || !portalUser) {
    console.error('Portal user not found:', portalError?.message);
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  try {
    // Update last_login
    await supabaseAdmin
      .from('portal_users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', portalUser.id);
  } catch (e) {
    console.error('Failed to update last_login:', e);
  }

  try {
    // Log the login activity
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '';
    await supabaseAdmin.from('portal_activity_log').insert([{
      portal_user_id: portalUser.id,
      user_id: portalUser.user_id,
      action_type: 'login',
      ip_address: ip,
      created_at: new Date().toISOString(),
    }]);
  } catch (e) {
    console.error('Failed to log activity:', e);
  }

  return res.status(200).json({
    success: true,
    portal_user: {
      id: portalUser.id,
      email: portalUser.email,
      customer_id: portalUser.customer_id,
      user_id: portalUser.user_id,
      customer: portalUser.customer,
    },
    session: authData.session,
  });
}
