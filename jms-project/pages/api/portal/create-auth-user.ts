import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return res.status(500).json({ error: 'Server configuration error.' });

  const supabaseAdmin = createClient(url, serviceKey);
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const cleanEmail = email.trim().toLowerCase();

    // Try to create new auth user
    const { error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
    });

    if (createError) {
      if (createError.message?.includes('already been registered') || createError.message?.includes('already exists')) {
        // User exists - update their password instead
        const { data: users } = await supabaseAdmin.auth.admin.listUsers();
        const existing = users?.users?.find((u: any) => u.email === cleanEmail);
        if (existing) {
          await supabaseAdmin.auth.admin.updateUserById(existing.id, { password });
        }
      } else {
        throw createError;
      }
    }

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('Auth user error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create auth user' });
  }
}
