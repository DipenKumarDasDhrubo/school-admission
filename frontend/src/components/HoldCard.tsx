import { useEffect, useRef, useState } from 'react';
import { cancelHold, confirmHold, errorText, type HoldStatus, type MyHold } from '../api';
import { useNow } from '../hooks';

interface Props {
  hold: MyHold;
  studentId: string;
  onChanged: () => void;
}

export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const HELP: Record<HoldStatus, string> = {
  HELD: 'Pay the admission fee before the timer ends, or the seat goes back to other families.',
  CONFIRMED: 'Admission confirmed. Nothing more to do.',
  EXPIRED: 'Time ran out and the seat was released. You can apply again from the Classes tab.',
  CANCELLED: 'This application was cancelled.',
};

export function HoldCard({ hold, studentId, onChanged }: Props) {
  const now = useNow(1000);
  const [busy, setBusy] = useState<'pay' | 'cancel' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remaining = Date.parse(hold.expiresAt) - now;
  // The UI flips to EXPIRED by itself as soon as the timer hits zero (no page reload).
  const status: HoldStatus = hold.status === 'HELD' && remaining <= 0 ? 'EXPIRED' : hold.status;
  const active = status === 'HELD';

  // When the timer runs out, ask the server once so the list matches reality.
  const reported = useRef(false);
  useEffect(() => {
    if (hold.status === 'HELD' && status === 'EXPIRED' && !reported.current) {
      reported.current = true;
      onChanged();
    }
  }, [hold.status, status, onChanged]);

  async function run(kind: 'pay' | 'cancel') {
    setError(null);
    setBusy(kind);
    try {
      if (kind === 'pay') await confirmHold(hold.holdId, studentId);
      else await cancelHold(hold.holdId, studentId);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
      onChanged();
    }
  }

  return (
    <li className={`hold hold-${status.toLowerCase()}`}>
      <div className="hold-head">
        <h3>{hold.className}</h3>
        <span className={`badge badge-${status.toLowerCase()}`}>{status}</span>
      </div>
      {active && (
        <p className="timer" aria-live="off">
          Time left <strong>{formatRemaining(remaining)}</strong>
        </p>
      )}
      <p className="muted">{HELP[status]}</p>
      {error && (
        <p className="banner banner-error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button onClick={() => run('pay')} disabled={!active || busy !== null}>
          {busy === 'pay' ? 'Paying…' : 'Pay admission fee'}
        </button>
        <button className="secondary" onClick={() => run('cancel')} disabled={!active || busy !== null}>
          {busy === 'cancel' ? 'Cancelling…' : 'Cancel application'}
        </button>
      </div>
    </li>
  );
}
