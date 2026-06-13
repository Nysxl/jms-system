import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { customerId, inventoryId } = req.query;
  if (!customerId || !inventoryId) {
    return res.status(400).json({ error: 'customerId and inventoryId are required.' });
  }

  // Get override price if exists, otherwise get standard price from inventory
  const { data: override } = await supabase
    .from('customer_pricing')
    .select('override_price')
    .eq('customer_id', customerId as string)
    .eq('inventory_id', inventoryId as string)
    .single();

  if (override) {
    return res.status(200).json({ price: override.override_price, isOverride: true });
  }

  // Fall back to standard price
  const { data: item } = await supabase
    .from('inventory')
    .select('unit_price')
    .eq('id', inventoryId as string)
    .single();

  return res.status(200).json({ price: item?.unit_price || 0, isOverride: false });
}
