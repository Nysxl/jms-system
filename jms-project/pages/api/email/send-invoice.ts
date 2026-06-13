import type { NextApiRequest, NextApiResponse } from 'next';
// import { Resend } from 'resend'; // TODO: install resend package
import { createClient } from '@supabase/supabase-js';

// const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return res.status(501).json({ error: 'Email functionality requires resend package. Install with: bun add resend' });
}
