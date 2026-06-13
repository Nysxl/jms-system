import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { portalUserId, jobId } = req.query;
  if (!portalUserId || !jobId) return res.status(400).json({ error: 'portalUserId and jobId required' });

  const { data: portalUser } = await supabase
    .from('portal_users').select('customer_id').eq('id', portalUserId).single();

  if (!portalUser) return res.status(404).json({ error: 'Portal user not found' });

  // Get sub-contact IDs to verify access
  const { data: subs } = await supabase
    .from('customers').select('id').eq('contractor_id', portalUser.customer_id).eq('customer_type', 'sub_contact');
  const customerIds = [portalUser.customer_id, ...(subs?.map((s: any) => s.id) || [])];

  const { data: job } = await supabase
    .from('jobs').select('*').eq('id', jobId).in('customer_id', customerIds).single();

  if (!job) return res.status(403).json({ error: 'Access denied' });

  const [{ data: notes }, { data: images }] = await Promise.all([
    supabase.from('job_notes').select('*').eq('job_id', jobId).order('created_at', { ascending: false }),
    supabase.from('job_images').select('*').eq('job_id', jobId).order('uploaded_at', { ascending: false }),
  ]);

  return res.status(200).json({ job, notes: notes || [], images: images || [] });
}
