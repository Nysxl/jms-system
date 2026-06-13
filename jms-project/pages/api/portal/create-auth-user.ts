import type { NextApiRequest, NextApiResponse } from 'next';
import { getAdminClient } from '@/lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseAdmin = getAdminClient();
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const cleanEmail = email.trim().toLowerCase();

    try {
      await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password,
        email_confirm: true,
      });
    } catch (error: any) {
      // If user already exists, update their password
      if (error.message?.includes('already exists')) {
        const { data: users } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = users?.users?.find((u: any) => u.email === cleanEmail);

        if (existingUser) {
          await supabaseAdmin.auth.admin.updateUserById(existingUser.id, { password });
        }
      } else {
        throw error;
      }
    }

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('Auth user error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create auth user' });
  }
}
