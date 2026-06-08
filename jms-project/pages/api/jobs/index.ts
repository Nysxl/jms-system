import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib_supabase';
import { ApiResponse, Job } from '@/lib_types';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<Job[] | Job>>
) {
  // Verify user is authenticated
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }

  try {
    if (req.method === 'GET') {
      // Get all jobs for user
      // In production, this would query D1 database
      return res.status(200).json({
        success: true,
        data: [],
      });
    } else if (req.method === 'POST') {
      // Create new job
      const { customer_id, title, description, priority, scheduled_date } = req.body;

      if (!customer_id || !title) {
        return res.status(400).json({
          success: false,
          error: 'customer_id and title are required',
        });
      }

      // In production, insert into D1 database
      const newJob: Job = {
        id: `job_${Date.now()}`,
        user_id: user.id,
        customer_id,
        title,
        description: description || '',
        status: 'pending',
        priority: priority || 'medium',
        scheduled_date: scheduled_date || undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      return res.status(201).json({
        success: true,
        data: newJob,
      });
    } else {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
