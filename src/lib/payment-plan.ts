import type { PaymentChange } from './validation';

export function correctedPaid(
  existing: { id: string; amount: number }[],
  changes: PaymentChange[],
  price: number,
) {
  const amounts = new Map(existing.map((p) => [p.id, p.amount]));
  const ids = new Set<string>();
  let added = 0;
  for (const change of changes) {
    if (change.id) {
      if (!amounts.has(change.id)) throw new Error('התשלום אינו שייך לאירוע');
      if (ids.has(change.id)) throw new Error('תשלום מופיע יותר מפעם אחת');
      ids.add(change.id);
      if (change.remove) amounts.delete(change.id);
      else amounts.set(change.id, change.amount);
    } else if (!change.remove) added += change.amount;
  }
  const paid = [...amounts.values()].reduce((sum, amount) => sum + amount, added);
  if (paid < 0 || paid > price) throw new Error('סך התשלומים חייב להיות בין אפס למחיר האירוע');
  return paid;
}
