import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { portalUserId, clientId } = req.query;
  if (!portalUserId || !clientId) return res.status(400).json({ error: 'portalUserId and clientId required' });

  const { data: portalUser } = await supabase
    .from('portal_users').select('customer_id').eq('id', portalUserId).single();

  if (!portalUser) return res.status(404).json({ error: 'Portal user not found' });

  // Verify this client belongs to the portal user's contractor
  const { data: client } = await supabase
    .from('customers').select('*').eq('id', clientId).eq('contractor_id', portalUser.customer_id).single();

  if (!client) return res.status(403).json({ error: 'Access denied' });

  const [{ data: jobs }, { data: invoices }] = await Promise.all([
    supabase.from('jobs').select('*').eq('customer_id', clientId).order('created_at', { ascending: false }),
    supabase.from('invoices').select('*').eq('customer_id', clientId).order('created_at', { ascending: false }),
  ]);

  return res.status(200).json({ client, jobs: jobs || [], invoices: invoices || [] });
}
