import { useState } from 'react';
import { createClass, errorText } from '../api';

interface Props {
  onCreated: () => void;
}

export function CreateClassForm({ onCreated }: Props) {
  const [name, setName] = useState('');
  const [seats, setSeats] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSuccess(null);
    const trimmed = name.trim();
    const count = Number(seats);
    if (!trimmed) return setError('Enter a class name, for example “Class 6 - Morning Shift”.');
    if (trimmed.length > 100) return setError('The class name must be 100 characters or fewer.');
    if (!/^[0-9]+$/.test(seats) || count < 1 || count > 100000)
      return setError('Total seats must be a whole number between 1 and 100000.');
    setError(null);
    setBusy(true);
    try {
      const created = await createClass(trimmed, count);
      setSuccess(`Created “${created.name}” with ${created.totalSeats} seats.`);
      setName('');
      setSeats('');
      onCreated();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="create-title">
      <h2 id="create-title">Create class</h2>
      <p className="muted">Each shift is its own class with its own seats.</p>
      <form className="stack" onSubmit={submit} noValidate>
        <label htmlFor="class-name">Class name</label>
        <input id="class-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        <label htmlFor="class-seats">Total seats</label>
        <input id="class-seats" inputMode="numeric" value={seats} onChange={(e) => setSeats(e.target.value)} />
        {error && (
          <p className="banner banner-error" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="banner banner-ok" role="status">
            {success}
          </p>
        )}
        <button type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Create class'}
        </button>
      </form>
    </section>
  );
}
