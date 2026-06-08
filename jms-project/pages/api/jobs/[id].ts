import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';
import { ApiResponse, Job } from '@/lib/types';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<Job | null>>
) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }

  const { id: _ } = req.query;

  try {
    if (req.method === 'GET') {
      // Get single job
      return res.status(200).json({
        success: true,
        data: null,
      });
    } else if (req.method === 'PUT') {
      // Update job
      const _updates = req.body;

      return res.status(200).json({
        success: true,
        data: null,
      });
    } else if (req.method === 'DELETE') {
      // Delete job
      return res.status(200).json({
        success: true,
        data: null,
      });
    } else {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
