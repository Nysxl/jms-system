import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { portalUserId, jobId, imageUrl, fileName } = req.body;
  if (!portalUserId || !jobId || !imageUrl) {
    return res.status(400).json({ error: 'portalUserId, jobId and imageUrl are required.' });
  }

  const { data: portalUser } = await supabase
    .from('portal_users')
    .select('user_id')
    .eq('id', portalUserId)
    .single();

  if (!portalUser) return res.status(404).json({ error: 'Portal user not found.' });

  const { data: image, error } = await supabase
    .from('job_images')
    .insert({
      job_id: jobId,
      user_id: portalUser.user_id,
      portal_user_id: portalUserId,
      image_url: imageUrl,
      file_name: fileName || 'photo',
      author_type: 'portal_user',
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json({ image });
}
