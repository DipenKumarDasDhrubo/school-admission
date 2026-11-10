import { useState } from 'react';
import { isValidStudentId } from '../validation';

interface Props {
  studentId: string;
  onSave: (id: string) => void;
}

export function IdentityBar({ studentId, onSave }: Props) {
  const [draft, setDraft] = useState(studentId);
  const [error, setError] = useState<string | null>(null);
  const saved = isValidStudentId(studentId) && draft === studentId;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = draft.trim();
    if (!isValidStudentId(value)) {
      setError('The birth registration number must be exactly 17 digits (numbers only).');
      return;
    }
    setError(null);
    setDraft(value);
    onSave(value);
  }

  return (
    <form className="identity" onSubmit={submit} noValidate>
      <label htmlFor="student-id">Student birth registration number</label>
      <div className="identity-row">
        <input
          id="student-id"
          inputMode="numeric"
          autoComplete="off"
          placeholder="17 digits, e.g. 20152691234567890"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'student-id-error' : undefined}
        />
        <button type="submit">{saved ? 'Saved' : 'Save number'}</button>
      </div>
      {error && (
        <p id="student-id-error" className="field-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
