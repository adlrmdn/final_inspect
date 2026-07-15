// Device-persisted QC inspector identity (offline-first: localStorage only).
// Captured by the blocking startup popup in InspectorProfileGate; stamped onto
// packaging_project_sessions (inspector / inspector_email) when a session is
// sent for verification, so the vendor portal can email the inspector on
// rejections ("back to QC") and on final completion.

const STORAGE_KEY = 'chimera_qc_inspector_profile';

export interface InspectorProfile {
  name: string;
  email: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidProfile = (p: any): p is InspectorProfile =>
  !!p && typeof p.name === 'string' && p.name.trim().length > 0
  && typeof p.email === 'string' && EMAIL_REGEX.test(p.email.trim());

export const getInspectorProfile = (): InspectorProfile | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isValidProfile(parsed) ? { name: parsed.name.trim(), email: parsed.email.trim() } : null;
  } catch {
    return null;
  }
};

export const saveInspectorProfile = (profile: InspectorProfile): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: profile.name.trim(), email: profile.email.trim() }));
};

export const clearInspectorProfile = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};
