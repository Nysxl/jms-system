import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return res.status(500).json({ error: 'Server configuration error.' });

  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const supabase = createClient(url, anonKey);
  const cleanEmail = email.trim().toLowerCase();

  try {
    // Try service key first if available (allows password updates for existing users)
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceKey) {
      const admin = createClient(url, serviceKey);
      const { error: createError } = await admin.auth.admin.createUser({
        email: cleanEmail,
        password,
        email_confirm: true,
      });

      if (createError) {
        if (createError.message?.includes('already been registered') || createError.message?.includes('already exists')) {
          const { data: users } = await admin.auth.admin.listUsers();
          const existing = users?.users?.find((u: any) => u.email === cleanEmail);
          if (existing) {
            await admin.auth.admin.updateUserById(existing.id, { password });
          }
        } else {
          throw createError;
        }
      }

      return res.status(200).json({ success: true });
    }

    // Fallback: use signUp (requires email confirmation disabled in Supabase Auth settings)
    const { error: signUpError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
    });

    // "User already registered" is fine - they can still log in
    if (signUpError && !signUpError.message?.includes('already registered')) {
      throw signUpError;
    }

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('Auth user error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create auth user' });
  }
}
