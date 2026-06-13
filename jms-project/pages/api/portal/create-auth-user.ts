import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, password, authToken } = req.body;
  if (!userId || !password) return res.status(400).json({ error: 'userId and password required' });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return res.status(500).json({ error: 'Server configuration error.' });

  try {
    const supabase = createClient(url, anonKey);

    // Set the caller's auth session so RLS and function grants apply
    if (authToken) {
      await supabase.auth.setSession({ access_token: authToken, refresh_token: '' });
    }

    // Call SECURITY DEFINER function to hash and store password
    const { data, error } = await supabase.rpc('set_portal_password', {
      p_user_id: userId,
      p_password: password,
    });

    if (error) {
      console.error('set_portal_password error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true, updated: data });
  } catch (err: any) {
    console.error('Error setting portal password:', err);
    return res.status(500).json({ error: err.message || 'Failed to set password' });
  }
}
