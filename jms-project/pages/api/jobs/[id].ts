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

  const { id } = req.query;

  try {
    if (req.method === 'GET') {
      // Get single job
      const { data } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      return res.status(200).json({
        success: true,
        data,
      });
    } else if (req.method === 'PUT') {
      const { title, description, status, priority, scheduled_date } = req.body;
      const { data } = await supabase
        .from('jobs')
        .update({ title, description, status, priority, scheduled_date })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      return res.status(200).json({
        success: true,
        data,
      });
    } else if (req.method === 'DELETE') {
      // Delete job and all related data
      // First delete job notes
      await supabase.from('job_notes').delete().eq('job_id', id);
      // Delete job images
      await supabase.from('job_images').delete().eq('job_id', id);
      // Delete job attachments
      await supabase.from('job_attachments').delete().eq('job_id', id);
      // Delete time entries
      await supabase.from('time_entries').delete().eq('job_id', id);
      // Delete expenses
      await supabase.from('expenses').delete().eq('job_id', id);
      // Finally delete the job itself
      const { data } = await supabase
        .from('jobs')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      return res.status(200).json({
        success: true,
        message: 'Job deleted successfully',
        data,
      });
    } else {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
