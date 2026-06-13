import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  if (_req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { reportId, recipientEmail, message } = _req.body;
  if (!reportId || !recipientEmail) {
    return res.status(400).json({ error: 'reportId and recipientEmail are required.' });
  }

  try {
    if (!process.env.RESEND_API_KEY) {
      return res.status(501).json({ error: 'Email service not configured. Set RESEND_API_KEY environment variable and install resend: npm install resend' });
    }

    // Dynamically import Resend - use @ts-ignore to suppress type errors when package not installed
    // @ts-ignore
    const { Resend } = await import('resend').catch(() => {
      throw new Error('Resend package not installed. Run: npm install resend');
    });

    const resend = new Resend(process.env.RESEND_API_KEY);

    // Fetch report + job + customer details
    const { data: report } = await supabase
      .from('service_reports')
      .select('*, job:jobs(*, customer:customers(*))')
      .eq('id', reportId)
      .single();

    if (!report) return res.status(404).json({ error: 'Report not found.' });

    // Fetch company settings
    const { data: settings } = await supabase
      .from('company_settings')
      .select('*')
      .eq('user_id', report.user_id)
      .single();

    const companyName = settings?.company_name || 'Service Report';
    const fromEmail = settings?.email || 'noreply@jms-system.local';

    // Generate HTML report
    const html = `
      <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
          <h2>${companyName}</h2>
          <h3>Service Report: ${report.title}</h3>
          <p style="color: #666;">Generated ${new Date().toLocaleDateString()}</p>
          <hr />

          <h4>Job Details:</h4>
          <p>
            <strong>Job:</strong> ${report.job?.title}<br />
            <strong>Customer:</strong> ${report.job?.customer?.company_name || report.job?.customer?.name}<br />
            <strong>Date:</strong> ${new Date(report.job?.scheduled_date || report.created_at).toLocaleDateString()}
          </p>

          ${report.description ? `
          <h4>Description:</h4>
          <p>${report.description}</p>
          ` : ''}

          ${report.work_performed ? `
          <h4>Work Performed:</h4>
          <p style="white-space: pre-wrap;">${report.work_performed}</p>
          ` : ''}

          ${report.parts_used ? `
          <h4>Parts/Materials Used:</h4>
          <p style="white-space: pre-wrap;">${report.parts_used}</p>
          ` : ''}

          ${report.labor_hours || report.labor_rate ? `
          <h4>Labor:</h4>
          <p>
            ${report.labor_hours ? `Hours: ${report.labor_hours}` : ''}
            ${report.labor_rate ? `Rate: $${report.labor_rate}/hr` : ''}
          </p>
          ` : ''}

          ${message ? `
          <hr />
          <p style="margin-top: 20px; padding: 10px; background: #f0f0f0; border-left: 4px solid #007bff;">
            ${message}
          </p>
          ` : ''}

          <hr />
          <p style="font-size: 12px; color: #666;">
            This is an automated email. Please do not reply to this address.
          </p>
        </body>
      </html>
    `;

    // Send email
    const result = await resend.emails.send({
      from: `${companyName} <${fromEmail}>`,
      to: recipientEmail,
      subject: `Service Report: ${report.title}`,
      html,
    });

    if (result.error) {
      return res.status(500).json({ error: result.error.message });
    }

    return res.status(200).json({ success: true, message: `Report sent to ${recipientEmail}` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
