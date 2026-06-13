import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { portalUserId } = req.query;
  if (!portalUserId) return res.status(400).json({ error: 'portalUserId required' });

  const { data: portalUser, error: puError } = await supabase
    .from('portal_users').select('customer_id').eq('id', portalUserId).single();

  if (puError || !portalUser) {
    console.error('Portal user lookup error:', puError, 'for ID:', portalUserId);
    return res.status(404).json({ error: 'Portal user not found', details: puError?.message });
  }

  const { data: subs } = await supabase
    .from('customers').select('id').eq('contractor_id', portalUser.customer_id).eq('customer_type', 'sub_contact');

  const customerIds = [portalUser.customer_id, ...(subs?.map((s: any) => s.id) || [])];

  const { data: invoices, error: invError } = await supabase
    .from('invoices')
    .select('*, job:jobs(title)')
    .in('customer_id', customerIds)
    .order('created_at', { ascending: false });

  if (invError) {
    console.error('Invoices lookup error:', invError);
  }

  return res.status(200).json({ invoices: invoices || [], debug: { customerIds, subCount: subs?.length } });
}
