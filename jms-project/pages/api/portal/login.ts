import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

  const { data: portalUser, error } = await supabase
    .from('portal_users')
    .select('*, customer:customers(*)')
    .eq('email', email.trim().toLowerCase())
    .eq('password_plain', password)
    .eq('is_active', true)
    .single();

  if (error || !portalUser) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  // Update last_login
  await supabase
    .from('portal_users')
    .update({ last_login: new Date().toISOString() })
    .eq('id', portalUser.id);

  // Log the login activity
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '';
  await supabase.from('portal_activity_log').insert([{
    portal_user_id: portalUser.id,
    user_id: portalUser.user_id,
    action_type: 'login',
    ip_address: ip,
    created_at: new Date().toISOString(),
  }]);

  return res.status(200).json({
    success: true,
    portal_user: {
      id: portalUser.id,
      email: portalUser.email,
      customer_id: portalUser.customer_id,
      user_id: portalUser.user_id,
      customer: portalUser.customer,
    },
  });
}
