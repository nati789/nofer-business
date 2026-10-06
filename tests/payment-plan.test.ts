import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paymentChangeSchema } from '../src/lib/validation';
import { correctedPaid } from '../src/lib/payment-plan';
const existing = [
  { id: 'one', amount: 10000 },
  { id: 'two', amount: 20000 },
];
const edit = (id: string, amount: number) =>
  paymentChangeSchema.parse({ id, amount, date: '2026-10-06', method: 'BIT' });
test('correction reconciles existing, added and removed payments against the new price', () => {
  assert.equal(correctedPaid(existing, [edit('one', 5000)], 25000), 25000);
  assert.equal(
    correctedPaid(
      existing,
      [
        { id: 'one', remove: true },
        edit('two', 10000),
        paymentChangeSchema.parse({
          amount: 3000,
          date: '2026-10-06',
          method: 'CASH',
          requestId: crypto.randomUUID(),
        }),
      ],
      13000,
    ),
    13000,
  );
  assert.equal(
    correctedPaid(
      existing,
      existing.map((p) => ({ id: p.id, remove: true })),
      0,
    ),
    0,
  );
  assert.deepEqual(existing, [
    { id: 'one', amount: 10000 },
    { id: 'two', amount: 20000 },
  ]);
});
test('correction rejects overpayment, other-event IDs, repeated IDs and invalid payment amounts', () => {
  assert.throws(() => correctedPaid(existing, [], 29999));
  assert.throws(() => correctedPaid(existing, [edit('foreign', 100)], 30000));
  assert.throws(() => correctedPaid(existing, [edit('one', 100), edit('one', 100)], 30000));
  for (const amount of [-1, 0, 0.5, 100000001])
    assert.equal(
      paymentChangeSchema.safeParse({ id: 'one', amount, date: '2026-10-06', method: 'BIT' })
        .success,
      false,
    );
  assert.equal(
    paymentChangeSchema.safeParse({ amount: 100, date: '2026-10-06', method: 'BIT' }).success,
    false,
  );
});
