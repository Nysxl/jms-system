import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { portalUserId, jobId, signatureData, signedBy } = req.body;
  if (!portalUserId || !jobId || !signatureData) return res.status(400).json({ error: 'Missing required fields' });

  const { data: portalUser } = await supabase
    .from('portal_users').select('customer_id').eq('id', portalUserId).single();

  if (!portalUser) return res.status(404).json({ error: 'Portal user not found' });

  const { data: subs } = await supabase
    .from('customers').select('id').eq('contractor_id', portalUser.customer_id).eq('customer_type', 'sub_contact');
  const customerIds = [portalUser.customer_id, ...(subs?.map((s: any) => s.id) || [])];

  const { data: job } = await supabase.from('jobs').select('id').eq('id', jobId).in('customer_id', customerIds).single();
  if (!job) return res.status(403).json({ error: 'Access denied' });

  const { error } = await supabase.from('jobs').update({
    signature_data: signatureData,
    signed_by: signedBy,
    signed_at: new Date().toISOString(),
  }).eq('id', jobId);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ success: true });
}
