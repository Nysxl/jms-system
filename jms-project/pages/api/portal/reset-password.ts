import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { portalUserId, newPassword } = req.body;
  if (!portalUserId || !newPassword) {
    return res.status(400).json({ error: 'portalUserId and newPassword are required.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  try {
    // Get portal user
    const { data: portalUser, error: fetchError } = await supabase
      .from('portal_users')
      .select('email')
      .eq('id', portalUserId)
      .single();

    if (fetchError || !portalUser) {
      return res.status(404).json({ error: 'Portal user not found.' });
    }

    // Update portal user password
    const { error: updateError } = await supabase
      .from('portal_users')
      .update({
        password_plain: newPassword,
        updated_at: new Date().toISOString(),
      })
      .eq('id', portalUserId);

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    // Also update Supabase Auth password if user exists
    try {
      await supabase.auth.admin.updateUserById(portalUserId, {
        password: newPassword,
      });
    } catch (e) {
      // Auth user might not exist, that's ok
    }

    return res.status(200).json({ success: true, message: 'Password reset successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
