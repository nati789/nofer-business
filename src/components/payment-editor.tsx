'use client';
import { methods, today, type BusinessEvent, type Method } from '@/lib/domain';
import type { PaymentChange } from '@/lib/validation';

export type PaymentDraft = {
  key: string;
  id?: string;
  requestId?: string;
  amount: string;
  date: string;
  method: Method;
  note: string;
  removed: boolean;
};
export const paymentDrafts = (event?: BusinessEvent): PaymentDraft[] =>
  (event?.payments ?? []).map((p) => ({
    key: p.id,
    id: p.id,
    amount: String(p.amount / 100),
    date: p.date.slice(0, 10),
    method: p.method,
    note: p.note,
    removed: false,
  }));
export const paymentChanges = (drafts: PaymentDraft[]): PaymentChange[] =>
  drafts
    .filter((p) => !p.removed || p.id)
    .map((p) =>
      p.removed && p.id
        ? { id: p.id, remove: true }
        : {
            id: p.id,
            requestId: p.requestId,
            amount: Math.round(Number(p.amount) * 100),
            date: p.date,
            method: p.method,
            note: p.note,
            remove: false,
          },
    );

export default function PaymentEditor({
  drafts,
  onChange,
  allowAdd = true,
}: {
  drafts: PaymentDraft[];
  onChange: (drafts: PaymentDraft[]) => void;
  allowAdd?: boolean;
}) {
  function update(key: string, changes: Partial<PaymentDraft>) {
    onChange(drafts.map((p) => (p.key === key ? { ...p, ...changes } : p)));
  }
  return (
    <div className="payment-editor">
      <h3>תיקון תשלומים</h3>
      <p className="muted">
        כבר שולם מחושב מהתשלומים כאן. אפשר לתקן סכום, להוסיף תשלום או למחוק רישום שגוי. כל השינויים
        יישמרו יחד עם האירוע בלחיצה על שמירת שינויים.
      </p>
      {drafts.map((p, index) => (
        <div className={'payment-edit-row ' + (p.removed ? 'removed' : '')} key={p.key}>
          <div className="section-head">
            <h3>
              תשלום {index + 1}
              {p.removed ? ' — מסומן למחיקה' : ''}
            </h3>
            <button
              type="button"
              className="text-button"
              onClick={() => update(p.key, { removed: !p.removed })}
            >
              {p.removed ? 'ביטול מחיקה' : 'מחיקת תשלום'}
            </button>
          </div>
          {!p.removed && (
            <div className="form-grid">
              <label>
                סכום תשלום {index + 1} (₪)
                <input
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  max="1000000"
                  step="0.01"
                  required
                  value={p.amount}
                  onChange={(e) => update(p.key, { amount: e.target.value })}
                />
              </label>
              <label>
                תאריך תשלום {index + 1}
                <input
                  type="date"
                  min="2000-01-01"
                  max="2100-12-31"
                  required
                  value={p.date}
                  onChange={(e) => update(p.key, { date: e.target.value })}
                />
              </label>
              <label>
                אמצעי תשלום {index + 1}
                <select
                  value={p.method}
                  onChange={(e) => update(p.key, { method: e.target.value as Method })}
                >
                  {Object.entries(methods).map(([key, label]) => (
                    <option value={key} key={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                הערה לתשלום {index + 1}
                <input
                  maxLength={1000}
                  value={p.note}
                  onChange={(e) => update(p.key, { note: e.target.value })}
                />
              </label>
            </div>
          )}
        </div>
      ))}
      <button
        className="secondary"
        type="button"
        disabled={!allowAdd}
        onClick={() => {
          const requestId = crypto.randomUUID();
          onChange([
            ...drafts,
            {
              key: requestId,
              requestId,
              amount: '',
              date: today(),
              method: 'TRANSFER',
              note: '',
              removed: false,
            },
          ]);
        }}
      >
        הוספת תשלום
      </button>
    </div>
  );
}
