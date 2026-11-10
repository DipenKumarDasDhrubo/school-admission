import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClassesPanel } from './components/ClassesPanel';
import { HoldCard } from './components/HoldCard';
import { IdentityBar } from './components/IdentityBar';
import type { ClassInfo, MyHold } from './api';

const VALID_ID = '20152691234567890';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const cls = (over: Partial<ClassInfo> = {}): ClassInfo => ({
  id: 'c1',
  name: 'Class 6 - Morning Shift',
  totalSeats: 120,
  heldSeats: 15,
  confirmedSeats: 80,
  availableSeats: 25,
  ...over,
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('IdentityBar', () => {
  it('rejects a number that is not 17 digits and accepts a valid one', () => {
    const onSave = vi.fn();
    render(<IdentityBar studentId="" onSave={onSave} />);
    const input = screen.getByLabelText(/birth registration number/i);

    fireEvent.change(input, { target: { value: '12345' } });
    fireEvent.click(screen.getByRole('button', { name: /save number/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/exactly 17 digits/i);
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: VALID_ID } });
    fireEvent.click(screen.getByRole('button', { name: /save number/i }));
    expect(onSave).toHaveBeenCalledWith(VALID_ID);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('ClassesPanel', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('shows a plain-language message when the last seat is taken (409)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return jsonResponse({ error: 'NO_SEATS', message: 'raw server text' }, 409);
        }
        return jsonResponse([cls()]);
      }),
    );
    render(<ClassesPanel studentId={VALID_ID} refreshKey={0} onApplied={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Apply' }));
    expect(await screen.findByText(/no seats left in this class/i)).toBeInTheDocument();
  });

  it('asks for the registration number instead of calling the server when it is missing', async () => {
    const fetchMock = vi.fn(async () => jsonResponse([cls()]));
    vi.stubGlobal('fetch', fetchMock);
    render(<ClassesPanel studentId="" refreshKey={0} onApplied={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Apply' }));
    expect(await screen.findByText(/17-digit birth registration number/i)).toBeInTheDocument();
    expect(fetchMock.mock.calls.every(([, init]) => (init as RequestInit | undefined)?.method !== 'POST')).toBe(true);
  });

  it('shows a friendly banner when the server is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    render(<ClassesPanel studentId={VALID_ID} refreshKey={0} onApplied={vi.fn()} />);
    expect(await screen.findByText(/could not reach the server/i)).toBeInTheDocument();
  });

  it('updates seat counts by itself without a reload', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let call = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse([call++ === 0 ? cls({ availableSeats: 25 }) : cls({ availableSeats: 24, heldSeats: 16 })])),
    );
    render(<ClassesPanel studentId={VALID_ID} refreshKey={0} onApplied={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('25')).toBeInTheDocument());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4100);
    });
    await waitFor(() => expect(screen.getByText('24')).toBeInTheDocument());
  });
});

describe('HoldCard', () => {
  it('flips to EXPIRED and disables the pay button when the timer ends, with no reload', async () => {
    vi.useFakeTimers();
    const hold: MyHold = {
      holdId: 'h1',
      classId: 'c1',
      className: 'Class 6 - Morning Shift',
      status: 'HELD',
      expiresAt: new Date(Date.now() + 3000).toISOString(),
    };
    const onChanged = vi.fn();
    render(<HoldCard hold={hold} studentId={VALID_ID} onChanged={onChanged} />);

    expect(screen.getByText('HELD')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pay admission fee/i })).toBeEnabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3500);
    });

    expect(screen.getByText('EXPIRED')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pay admission fee/i })).toBeDisabled();
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('keeps pay disabled for a confirmed admission', () => {
    const hold: MyHold = {
      holdId: 'h2',
      classId: 'c1',
      className: 'Class 6',
      status: 'CONFIRMED',
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    };
    render(<HoldCard hold={hold} studentId={VALID_ID} onChanged={vi.fn()} />);
    expect(screen.getByText('CONFIRMED')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pay admission fee/i })).toBeDisabled();
  });
});
