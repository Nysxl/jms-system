import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  if (_req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { invoiceId, recipientEmail, message } = _req.body;
  if (!invoiceId || !recipientEmail) {
    return res.status(400).json({ error: 'invoiceId and recipientEmail are required.' });
  }

  try {
    // Dynamically import Resend
    let Resend;
    try {
      const module = await import('resend');
      Resend = module.Resend;
    } catch {
      return res.status(501).json({ error: 'Email service not configured. Install resend: npm install resend' });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    // Fetch invoice + job + company details
    const { data: invoice } = await supabase
      .from('invoices')
      .select('*, job:jobs(*), customer:customers(*)')
      .eq('id', invoiceId)
      .single();

    if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });

    // Fetch company settings
    const { data: settings } = await supabase
      .from('company_settings')
      .select('*')
      .eq('user_id', invoice.user_id)
      .single();

    const companyName = settings?.company_name || 'Service Invoice';
    const fromEmail = settings?.email || 'noreply@jms-system.local';

    // Generate HTML invoice
    const html = `
      <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
          <h2>${companyName}</h2>
          <p>Invoice #${invoice.invoice_number}</p>
          <hr />

          <h4>Bill To:</h4>
          <p>
            ${invoice.customer?.company_name || invoice.customer?.name}<br />
            ${invoice.customer?.email || ''}<br />
            ${invoice.customer?.phone || ''}
          </p>

          ${invoice.job ? `<p><strong>Job:</strong> ${invoice.job.title}</p>` : ''}

          <table style="width: 100%; border-collapse: collapse;">
            <tr style="background: #f5f5f5;">
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Description</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Amount</th>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px;">Subtotal</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">$${(invoice.subtotal || 0).toFixed(2)}</td>
            </tr>
            ${invoice.tax_amount ? `
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px;">Tax</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">$${invoice.tax_amount.toFixed(2)}</td>
            </tr>
            ` : ''}
            <tr style="background: #f5f5f5; font-weight: bold;">
              <td style="border: 1px solid #ddd; padding: 8px;">Total</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">$${(invoice.total_amount || 0).toFixed(2)}</td>
            </tr>
          </table>

          ${invoice.payment_terms ? `<p><strong>Payment Terms:</strong> ${invoice.payment_terms}</p>` : ''}
          ${invoice.due_date ? `<p><strong>Due Date:</strong> ${new Date(invoice.due_date).toLocaleDateString()}</p>` : ''}
          ${invoice.notes ? `<p><strong>Notes:</strong> ${invoice.notes}</p>` : ''}

          ${message ? `<p style="margin-top: 20px; padding: 10px; background: #f0f0f0; border-left: 4px solid #007bff;">${message}</p>` : ''}

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
      subject: `Invoice #${invoice.invoice_number}`,
      html,
    });

    if (result.error) {
      return res.status(500).json({ error: result.error.message });
    }

    // Update invoice status to 'sent' if it was draft
    if (invoice.status === 'draft') {
      await supabase.from('invoices').update({ status: 'sent' }).eq('id', invoiceId);
    }

    return res.status(200).json({ success: true, message: `Invoice sent to ${recipientEmail}` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
