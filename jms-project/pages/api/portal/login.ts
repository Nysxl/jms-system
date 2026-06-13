import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  try {
    const supabase = createClient(url, anonKey);
    const cleanEmail = email.trim().toLowerCase();

    // Use SECURITY DEFINER RPC function - works with anon key, no service role needed
    const { data, error } = await supabase.rpc('portal_authenticate', {
      p_email: cleanEmail,
      p_password: password,
    });

    console.log('portal_authenticate result:', { rows: data?.length, error: error?.message });

    if (error) {
      console.error('RPC error:', error);
      return res.status(500).json({ error: 'Authentication error.' });
    }

    if (!data || data.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = data[0];

    // Log activity (best effort)
    try {
      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '';
      await supabase.from('portal_activity_log').insert([{
        portal_user_id: user.id,
        action_type: 'login',
        ip_address: ip,
        created_at: new Date().toISOString(),
      }]);
    } catch (_e) {}

    return res.status(200).json({
      success: true,
      portal_user: {
        id: user.id,
        email: user.email,
        customer_id: user.customer_id,
        customer: {
          id: user.customer_id,
          name: user.customer_name,
          address: user.customer_address,
          phone: user.customer_phone,
          email: user.customer_email,
          contact_type: user.customer_type,
        },
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed: ' + (err.message || 'Unknown error') });
  }
}
