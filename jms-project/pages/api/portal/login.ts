import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('Env check:', { url: !!url, anonKey: !!anonKey, serviceKey: !!serviceKey });

  if (!url || !anonKey || !serviceKey) {
    return res.status(500).json({
      error: 'Server configuration error.',
      missing: { url: !url, anonKey: !anonKey, serviceKey: !serviceKey }
    });
  }

  try {
    const supabaseAnon = createClient(url, anonKey);
    const supabaseAdmin = createClient(url, serviceKey);
    const cleanEmail = email.trim().toLowerCase();

    // Authenticate via Supabase Auth
    const { data: authData, error: authError } = await supabaseAnon.auth.signInWithPassword({
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
      console.error('Portal user not found:', portalError?.message);
      return res.status(401).json({ error: 'Portal user not found or inactive.' });
    }

    // Update last_login and log activity (best effort)
    try {
      await supabaseAdmin.from('portal_users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', portalUser.id);
      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '';
      await supabaseAdmin.from('portal_activity_log').insert([{
        portal_user_id: portalUser.id,
        action_type: 'login',
        ip_address: ip,
        created_at: new Date().toISOString(),
      }]);
    } catch (_e) {}

    return res.status(200).json({
      success: true,
      session: authData.session,
      portal_user: {
        id: portalUser.id,
        email: portalUser.email,
        customer_id: portalUser.customer_id,
        customer: portalUser.customer,
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed: ' + (err.message || 'Unknown error') });
  }
}
