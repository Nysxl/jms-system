import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { portalUserId, title, description, scheduledDate } = req.body;
  if (!portalUserId || !title) {
    return res.status(400).json({ error: 'portalUserId and title are required.' });
  }

  try {
    // Get portal user and their customer
    const { data: portalUser, error: fetchError } = await supabase
      .from('portal_users')
      .select('*, customer:customers(*)')
      .eq('id', portalUserId)
      .single();

    if (fetchError || !portalUser) {
      return res.status(404).json({ error: 'Portal user not found.' });
    }

    // Create the job
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        user_id: portalUser.user_id,
        customer_id: portalUser.customer_id,
        created_by_portal_user: portalUserId,
        title,
        description: description || '',
        scheduled_date: scheduledDate || null,
        status: 'pending',
        priority: 'medium',
      })
      .select()
      .single();

    if (jobError) {
      return res.status(500).json({ error: jobError.message });
    }

    // Log activity
    await supabase.from('portal_activity_log').insert({
      portal_user_id: portalUserId,
      user_id: portalUser.user_id,
      action_type: 'job_created',
      entity_type: 'job',
      entity_id: job.id,
      details: JSON.stringify({ title, scheduledDate }),
    });

    // Send email to admin
    try {
      // Try to send via Resend if configured
      if (process.env.RESEND_API_KEY) {
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);

        const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
        await resend.emails.send({
          from: 'jobs@jms.local',
          to: adminEmail,
          subject: `New Job Request: ${title}`,
          html: `<h2>New Job Created</h2>
            <p><strong>Customer:</strong> ${portalUser.customer?.name}</p>
            <p><strong>Title:</strong> ${title}</p>
            ${description ? `<p><strong>Description:</strong> ${description}</p>` : ''}
            ${scheduledDate ? `<p><strong>Scheduled Date:</strong> ${new Date(scheduledDate).toLocaleDateString()}</p>` : ''}
            <p><a href="${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/jobs/${job.id}">View Job</a></p>`,
        });
      }
    } catch (err) {
      console.log(`[EMAIL PENDING] Job created by ${portalUser.customer?.name}: ${title} (configure RESEND_API_KEY to send emails)`);
    }

    return res.status(201).json({ success: true, job });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
