import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { portalUserId, title, description, scheduledDate, subContactId } = req.body;
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

    // Use subContactId if provided, otherwise use the portal user's own customer
    const targetCustomerId = subContactId || portalUser.customer_id;

    // Create the job with 'requested' status so admin can review it
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        user_id: portalUser.user_id,
        customer_id: targetCustomerId,
        billing_customer_id: subContactId ? portalUser.customer_id : null,
        created_by_portal_user: portalUserId,
        title,
        description: description || '',
        scheduled_date: scheduledDate || null,
        status: 'requested',
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

    // Send email to admin (optional - gracefully handles missing Resend)
    if (process.env.RESEND_API_KEY) {
      try {
        // @ts-ignore - dynamic import of optional dependency
        const { Resend } = await import('resend').catch(() => null);
        if (Resend) {
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
        console.log(`[EMAIL PENDING] Job created by ${portalUser.customer?.name}: ${title}`);
      }
    }

    return res.status(201).json({ success: true, job });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
