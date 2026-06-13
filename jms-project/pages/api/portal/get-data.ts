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

  const { data: portalUser } = await supabase
    .from('portal_users')
    .select('customer_id')
    .eq('id', portalUserId)
    .single();

  if (!portalUser) return res.status(404).json({ error: 'Portal user not found', receivedId: portalUserId, hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY });

  const customerId = portalUser.customer_id;

  // Get sub-contacts
  const { data: subContacts } = await supabase
    .from('customers')
    .select('id, name, company_name')
    .eq('contractor_id', customerId)
    .eq('customer_type', 'sub_contact');

  const customerIds = [customerId, ...(subContacts?.map((s: any) => s.id) || [])];

  // Get jobs for this customer + sub-contacts
  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select('*')
    .in('customer_id', customerIds)
    .order('created_at', { ascending: false });

  // Get invoices for this customer + sub-contacts
  const { data: invoices } = await supabase
    .from('invoices')
    .select('*, job:jobs(title)')
    .in('customer_id', customerIds)
    .order('created_at', { ascending: false });

  return res.status(200).json({
    subContacts: subContacts || [],
    jobs: jobs || [],
    invoices: invoices || [],
    _debug: { customerId, customerIds, jobsError: jobsError?.message },
  });
}
