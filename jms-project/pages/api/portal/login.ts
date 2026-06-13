import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    console.log('=== PORTAL LOGIN API ===');
    console.log('Env vars available:', {
      url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      serviceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    });

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { email, password } = req.body;
    console.log('Request body:', { email: email ? email.substring(0, 3) + '...' : 'missing', passwordLen: password?.length || 0 });

    if (!email || !password) {
      console.log('Missing email or password');
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    console.log('Clean email:', cleanEmail);

    console.log('Creating Supabase clients...');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log('Env var values:', {
      url: url ? url.substring(0, 20) + '...' : 'MISSING',
      anonKey: anonKey ? anonKey.substring(0, 20) + '...' : 'MISSING',
      serviceKey: serviceKey ? serviceKey.substring(0, 20) + '...' : 'MISSING',
    });

    if (!url || !anonKey || !serviceKey) {
      console.error('CRITICAL: Missing environment variables');
      return res.status(500).json({
        error: 'Server configuration error',
        available: { url: !!url, anonKey: !!anonKey, serviceKey: !!serviceKey }
      });
    }

    const supabaseAnon = createClient(url, anonKey);
    const supabaseAdmin = createClient(url, serviceKey);

    // Authenticate via Supabase Auth
    console.log('Attempting Supabase Auth signInWithPassword...');
    const { data: authData, error: authError } = await supabaseAnon.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    console.log('Auth response:', { authError: authError?.message, userExists: !!authData?.user });

    if (authError || !authData.user) {
      console.error('Auth failed:', authError?.message);
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    console.log('Auth successful, user ID:', authData.user.id);

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
