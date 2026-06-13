import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { portal_user_id, user_id, action_type, entity_type, entity_id, details } = req.body;
  if (!portal_user_id || !user_id || !action_type) {
    return res.status(400).json({ error: 'portal_user_id, user_id, and action_type are required.' });
  }

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '';

  const { error } = await supabase.from('portal_activity_log').insert([{
    portal_user_id,
    user_id,
    action_type,
    entity_type: entity_type || null,
    entity_id: entity_id || null,
    details: details ? JSON.stringify(details) : null,
    ip_address: ip,
    created_at: new Date().toISOString(),
  }]);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ success: true });
}
