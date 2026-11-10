import { useState } from 'react';
import { ClassesPanel } from './components/ClassesPanel';
import { CreateClassForm } from './components/CreateClassForm';
import { IdentityBar } from './components/IdentityBar';
import { MyApplications } from './components/MyApplications';
import { useStudentId } from './hooks';

type Tab = 'classes' | 'mine' | 'create';

export default function App() {
  const [studentId, setStudentId] = useStudentId();
  const [tab, setTab] = useState<Tab>('classes');
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = () => setRefreshKey((n) => n + 1);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'classes', label: 'Classes' },
    { id: 'mine', label: 'My applications' },
    { id: 'create', label: 'Create class' },
  ];

  return (
    <div className="page">
      <header>
        <h1>School admissions</h1>
        <p className="muted">First come, first served. A seat is held for you while you pay the admission fee.</p>
      </header>

      <IdentityBar studentId={studentId} onSave={setStudentId} />

      <nav className="tabs" aria-label="Sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'tab active' : 'tab'}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => {
              setTab(t.id);
              setNotice(null);
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {notice && (
        <p className="banner banner-ok" role="status">
          {notice}
        </p>
      )}

      <main>
        {tab === 'classes' && (
          <ClassesPanel
            studentId={studentId}
            refreshKey={refreshKey}
            onApplied={() => {
              bump();
              setTab('mine');
              setNotice('Seat held. Pay the admission fee before the timer ends to confirm the admission.');
            }}
          />
        )}
        {tab === 'mine' && <MyApplications studentId={studentId} refreshKey={refreshKey} />}
        {tab === 'create' && <CreateClassForm onCreated={bump} />}
      </main>
    </div>
  );
}
