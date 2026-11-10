import { useState } from 'react';
import { applyToClass, errorText, listClasses, type ClassInfo } from '../api';
import { usePolling } from '../hooks';
import { isValidStudentId } from '../validation';
import { SeatBar } from './SeatBar';

interface Props {
  studentId: string;
  refreshKey: number;
  onApplied: () => void;
}

export function ClassesPanel({ studentId, refreshKey, onApplied }: Props) {
  // Seat counts refresh every 4 seconds without a page reload.
  const { data, error, loading, refresh } = usePolling(listClasses, 4000, [refreshKey]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function apply(c: ClassInfo) {
    setMessage(null);
    if (!isValidStudentId(studentId)) {
      setMessage('Enter and save your 17-digit birth registration number at the top before applying.');
      return;
    }
    setBusyId(c.id);
    try {
      await applyToClass(c.id, studentId);
      onApplied();
    } catch (e) {
      setMessage(errorText(e));
      refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section aria-labelledby="classes-title">
      <h2 id="classes-title">Classes</h2>
      {error && (
        <p className="banner banner-error" role="alert">
          {error} Showing the last numbers we received; retrying automatically.
        </p>
      )}
      {message && (
        <p className="banner banner-error" role="alert">
          {message}
        </p>
      )}
      {loading && !data && <p className="muted">Loading classes…</p>}
      {data && data.length === 0 && (
        <p className="empty">No classes yet. Create the first class from the “Create class” tab.</p>
      )}
      <ul className="class-list">
        {data?.map((c) => (
          <li key={c.id} className="class-row">
            <div className="class-head">
              <h3>{c.name}</h3>
              <button onClick={() => apply(c)} disabled={busyId === c.id || c.availableSeats <= 0}>
                {busyId === c.id ? 'Applying…' : c.availableSeats <= 0 ? 'Full' : 'Apply'}
              </button>
            </div>
            <SeatBar total={c.totalSeats} held={c.heldSeats} confirmed={c.confirmedSeats} />
            <dl className="counts">
              <div>
                <dt>Total</dt>
                <dd>{c.totalSeats}</dd>
              </div>
              <div>
                <dt>On hold</dt>
                <dd>{c.heldSeats}</dd>
              </div>
              <div>
                <dt>Confirmed</dt>
                <dd>{c.confirmedSeats}</dd>
              </div>
              <div>
                <dt>Available</dt>
                <dd className="available">{c.availableSeats}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}
