import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  if (_req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  return res.status(501).json({ error: 'Email functionality coming soon. Will implement with OAuth2.' });
}
