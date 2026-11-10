import { listMyHolds } from '../api';
import { usePolling } from '../hooks';
import { isValidStudentId } from '../validation';
import { HoldCard } from './HoldCard';

interface Props {
  studentId: string;
  refreshKey: number;
}

export function MyApplications({ studentId, refreshKey }: Props) {
  const valid = isValidStudentId(studentId);
  const { data, error, loading, refresh } = usePolling(() => listMyHolds(studentId), 5000, [studentId, refreshKey], valid);

  return (
    <section aria-labelledby="mine-title">
      <h2 id="mine-title">My applications</h2>
      {!valid && <p className="empty">Enter and save your birth registration number at the top to see your applications.</p>}
      {valid && error && (
        <p className="banner banner-error" role="alert">
          {error} Showing the last information we received; retrying automatically.
        </p>
      )}
      {valid && loading && !data && <p className="muted">Loading your applications…</p>}
      {valid && data && data.length === 0 && (
        <p className="empty">You have no applications yet. Pick a class on the Classes tab and press Apply.</p>
      )}
      <ul className="hold-list">
        {data?.map((h) => (
          <HoldCard key={h.holdId} hold={h} studentId={studentId} onChanged={refresh} />
        ))}
      </ul>
    </section>
  );
}
