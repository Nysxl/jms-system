import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { portalUserId, subContactId, email, password } = req.body;
  if (!portalUserId || !subContactId || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Verify contractor portal user
    const { data: contractorPortalUser } = await supabase
      .from('portal_users').select('customer_id').eq('id', portalUserId).single();
    if (!contractorPortalUser) return res.status(404).json({ error: 'Portal user not found' });

    // Verify sub-contact belongs to contractor
    const { data: subContact } = await supabase
      .from('customers').select('id').eq('id', subContactId)
      .eq('contractor_id', contractorPortalUser.customer_id)
      .eq('customer_type', 'sub_contact').single();
    if (!subContact) return res.status(403).json({ error: 'Sub-contact not found or access denied' });

    // Check if portal user already exists for this sub-contact
    const { data: existingUser } = await supabase
      .from('portal_users').select('id').eq('customer_id', subContactId).maybeSingle();
    if (existingUser) return res.status(400).json({ error: 'Portal user already exists for this sub-contact' });

    // Create Supabase auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
    });
    if (authError) return res.status(400).json({ error: 'Failed to create auth user: ' + authError.message });

    // Create portal user
    const { data: portalUser, error: portalError } = await supabase
      .from('portal_users')
      .insert({
        customer_id: subContactId,
        user_id: authData.user.id,
        email: email.trim().toLowerCase(),
        password_plain: password,
        is_active: 1,
      })
      .select()
      .single();

    if (portalError) return res.status(500).json({ error: 'Failed to create portal user: ' + portalError.message });

    return res.status(201).json({ success: true, portal_user: portalUser });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error: ' + (err.message || 'Unknown error') });
  }
}
