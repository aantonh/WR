import type { Assignment, SchoolClass, Submission } from '../types';

const STORAGE_KEY = 'writingmaster_gsites_state_v1';

export interface PersistedState {
  classes: SchoolClass[];
  assignments: Assignment[];
  submissions: Record<string, Submission>;
  updatedAt?: string;
}

export function loadPersistedState(): PersistedState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (!Array.isArray(parsed.classes) || !Array.isArray(parsed.assignments) || !parsed.submissions) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function savePersistedState(state: PersistedState): { ok: boolean; quotaFallback: boolean } {
  const payload: PersistedState = {
    ...state,
    updatedAt: new Date().toISOString(),
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return { ok: true, quotaFallback: false };
  } catch {
    // If scanned base64 pages exceed browser storage quota (~5MB), persist text/tokens/grades/rubrics
    try {
      const compactSubmissions: Record<string, Submission> = {};
      Object.entries(state.submissions).forEach(([key, sub]) => {
        compactSubmissions[key] = {
          ...sub,
          draftPages: [],
          finalPages: [],
        };
      });
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          classes: state.classes,
          assignments: state.assignments,
          submissions: compactSubmissions,
          updatedAt: payload.updatedAt,
        })
      );
      return { ok: true, quotaFallback: true };
    } catch {
      return { ok: false, quotaFallback: true };
    }
  }
}

export function clearPersistedState(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage access errors in restricted contexts
  }
}

export function exportStateAsJson(state: PersistedState): void {
  const json = JSON.stringify(
    {
      ...state,
      exportedAt: new Date().toISOString(),
      app: 'WritingMaster AI - Google Sites Edition',
    },
    null,
    2
  );
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `writingmaster-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
