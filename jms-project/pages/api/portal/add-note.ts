import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { portalUserId, jobId, content } = req.body;
  if (!portalUserId || !jobId || !content?.trim()) {
    return res.status(400).json({ error: 'portalUserId, jobId and content are required.' });
  }

  const { data: portalUser } = await supabase
    .from('portal_users')
    .select('user_id')
    .eq('id', portalUserId)
    .single();

  if (!portalUser) return res.status(404).json({ error: 'Portal user not found.' });

  const { data: note, error } = await supabase
    .from('job_notes')
    .insert({
      job_id: jobId,
      user_id: portalUser.user_id,
      portal_user_id: portalUserId,
      content: content.trim(),
      author_type: 'portal_user',
      is_internal: false,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json({ note });
}
