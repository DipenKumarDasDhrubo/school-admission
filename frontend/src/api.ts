declare global {
  interface Window {
    __CONFIG__?: { API_URL?: string };
  }
}

// Backend URL: runtime config (container env var API_URL) > build-time VITE_API_URL > default.
const rawBase: string =
  window.__CONFIG__?.API_URL || (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:8080';
export const API_URL = rawBase.replace(/\/+$/, '');

export type HoldStatus = 'HELD' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED';

export interface ClassInfo {
  id: string;
  name: string;
  totalSeats: number;
  heldSeats: number;
  confirmedSeats: number;
  availableSeats: number;
}

export interface MyHold {
  holdId: string;
  classId: string;
  className: string;
  status: HoldStatus;
  expiresAt: string;
}

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const FRIENDLY: Record<string, string> = {
  NO_SEATS: 'Sorry, there are no seats left in this class.',
  ALREADY_APPLIED: 'You already have an application or confirmed admission in this class.',
  HOLD_EXPIRED: 'This application has expired and the seat was released. Please apply again.',
  HOLD_CANCELLED: 'This application was cancelled, so it cannot be paid.',
  ALREADY_CONFIRMED: 'This admission is already confirmed and cannot be cancelled here.',
  NOT_YOUR_APPLICATION: 'This application belongs to a different student.',
  INVALID_STUDENT_ID: 'Please enter a valid 17-digit birth registration number.',
  CLASS_NOT_FOUND: 'This class no longer exists. The list will refresh.',
  HOLD_NOT_FOUND: 'We could not find this application.',
};

export const NETWORK_MESSAGE = 'We could not reach the server. Check your connection and try again.';

function friendlyMessage(status: number, code: string, serverMessage: string): string {
  if (FRIENDLY[code]) return FRIENDLY[code];
  if (serverMessage) return serverMessage;
  if (status >= 500) return 'The server had a problem. Please try again in a moment.';
  if (status === 404) return 'We could not find what you asked for.';
  return 'Something went wrong. Please check what you entered and try again.';
}

export const errorText = (e: unknown): string =>
  e instanceof ApiError ? e.message : 'Something went wrong. Please try again.';

// Difference between the server clock and this device's clock, so countdowns stay correct
// even if the device clock is wrong.
let serverOffsetMs = 0;
export const serverNow = (): number => Date.now() + serverOffsetMs;

async function request<T>(
  method: string,
  path: string,
  opts: { studentId?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.studentId) headers['X-Student-Id'] = opts.studentId;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', NETWORK_MESSAGE);
  }

  const serverTime = res.headers.get('X-Server-Time');
  if (serverTime) {
    const t = Date.parse(serverTime);
    if (!Number.isNaN(t)) serverOffsetMs = t - Date.now();
  }

  if (!res.ok) {
    let code = '';
    let message = '';
    try {
      const j = (await res.json()) as { error?: string; message?: string };
      code = j.error ?? '';
      message = j.message ?? '';
    } catch {
      /* body was not JSON */
    }
    throw new ApiError(res.status, code, friendlyMessage(res.status, code, message));
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const listClasses = () => request<ClassInfo[]>('GET', '/classes');

export const createClass = (name: string, totalSeats: number) =>
  request<{ id: string; name: string; totalSeats: number }>('POST', '/classes', {
    body: { name, totalSeats },
  });

export const applyToClass = (classId: string, studentId: string) =>
  request<{ holdId: string; status: HoldStatus; expiresAt: string }>(
    'POST',
    `/classes/${encodeURIComponent(classId)}/holds`,
    { studentId },
  );

export const listMyHolds = (studentId: string) => request<MyHold[]>('GET', '/me/holds', { studentId });

export const confirmHold = (holdId: string, studentId: string) =>
  request<{ holdId: string; status: HoldStatus }>('POST', `/holds/${encodeURIComponent(holdId)}/confirm`, {
    studentId,
  });

export const cancelHold = (holdId: string, studentId: string) =>
  request<void>('DELETE', `/holds/${encodeURIComponent(holdId)}`, { studentId });
