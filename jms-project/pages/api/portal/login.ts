import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase, getAdminClient } from '@/lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const supabaseAdmin = getAdminClient();
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    const cleanEmail = email.trim().toLowerCase();

    // Authenticate via Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (authError || !authData.user) {
      console.error('Auth failed:', authError?.message);
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Get portal user details
    const { data: portalUser, error: portalError } = await supabaseAdmin
      .from('portal_users')
      .select('*, customer:customers(*)')
      .eq('email', cleanEmail)
      .eq('is_active', 1)
      .maybeSingle();

    if (portalError || !portalUser) {
      return res.status(401).json({ error: 'Portal user not found.' });
    }

    try {
      await supabaseAdmin
        .from('portal_users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', portalUser.id);
    } catch (e) {
      console.error('Failed to update last_login:', e);
    }

    try {
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
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed: ' + (err.message || 'Unknown error') });
  }
}
