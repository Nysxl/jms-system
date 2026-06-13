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

    // Authenticate - works with anon key only
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (authError || !authData.user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Set the session so we can query as this user (RLS: auth.uid() = user_id)
    await supabase.auth.setSession(authData.session);

    // Query portal_users - RLS allows user to read their own record via user_id = auth.uid()
    const { data: portalUser, error: portalError } = await supabase
      .from('portal_users')
      .select('*, customer:customers(*)')
      .eq('user_id', authData.user.id)
      .eq('is_active', 1)
      .maybeSingle();

    console.log('portal user lookup:', { found: !!portalUser, error: portalError?.message, authUid: authData.user.id });

    if (portalError || !portalUser) {
      // Fallback: try matching by email in case user_id isn't set
      const { data: portalUserByEmail } = await supabase
        .from('portal_users')
        .select('*, customer:customers(*)')
        .eq('email', cleanEmail)
        .eq('is_active', 1)
        .maybeSingle();

      if (!portalUserByEmail) {
        return res.status(401).json({ error: 'Portal access not configured for this account.' });
      }

      return res.status(200).json({
        success: true,
        session: authData.session,
        portal_user: {
          id: portalUserByEmail.id,
          email: portalUserByEmail.email,
          customer_id: portalUserByEmail.customer_id,
          customer: portalUserByEmail.customer,
        },
      });
    }

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
