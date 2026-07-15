import React, { useState } from 'react';
import {
  InspectorProfile,
  getInspectorProfile,
  saveInspectorProfile,
  clearInspectorProfile,
} from '../utils/inspector_profile';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Blocking startup gate: before the QC Console can be used, the inspector must
 * register their name + email on this device (persisted offline in
 * localStorage). The email is written onto sessions at verification-send time
 * so the portal can notify the inspector when an approval stage rejects the
 * inspection ("back to QC") and when the project completes.
 *
 * While a profile exists, a discreet chip in the bottom-left shows who is
 * registered, with Change (re-opens the popup prefilled) and Remove (deletes
 * the profile → the gate blocks again).
 */
export const InspectorProfileGate: React.FC = () => {
  const [profile, setProfile] = useState<InspectorProfile | null>(() => getInspectorProfile());
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [error, setError] = useState('');

  const modalOpen = !profile || editing;

  const openEditor = () => {
    setNameInput(profile?.name || '');
    setEmailInput(profile?.email || '');
    setError('');
    setEditing(true);
  };

  const handleSave = () => {
    const name = nameInput.trim();
    const email = emailInput.trim();
    if (!name) {
      setError('Please enter your name.');
      return;
    }
    if (!EMAIL_REGEX.test(email)) {
      setError('Please enter a valid email address (e.g. qc@megaperintis.co.id).');
      return;
    }
    const next = { name, email };
    saveInspectorProfile(next);
    setProfile(next);
    setEditing(false);
    setError('');
  };

  const handleRemove = () => {
    clearInspectorProfile();
    setProfile(null);
    setNameInput('');
    setEmailInput('');
    setError('');
    setEditing(false); // no profile → gate blocks again
  };

  if (!modalOpen) {
    return (
      <div
        className="inspector-profile-chip no-print"
        style={{
          position: 'fixed',
          top: '10px',
          right: '90px',
          zIndex: 9000,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.45rem',
          background: 'rgba(255, 255, 255, 0.88)',
          backdropFilter: 'blur(6px)',
          border: '1.5px solid rgba(15, 23, 42, 0.12)',
          borderRadius: '999px',
          padding: '0.3rem 0.75rem',
          fontSize: '0.68rem',
          color: '#0F172A',
          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
        }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--royal-blue)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <span style={{ fontWeight: 800 }}>{profile!.name}</span>
        <span style={{ color: '#64748B' }}>{profile!.email}</span>
        <button
          type="button"
          onClick={openEditor}
          title="Change the registered QC inspector"
          style={{ border: 'none', background: 'transparent', color: 'var(--royal-blue)', fontWeight: 800, fontSize: '0.66rem', cursor: 'pointer', padding: '0 0.15rem' }}
        >
          Change
        </button>
        <button
          type="button"
          onClick={handleRemove}
          title="Remove the registered QC inspector from this device"
          style={{ border: 'none', background: 'transparent', color: '#EF4444', fontWeight: 800, fontSize: '0.66rem', cursor: 'pointer', padding: '0 0.15rem' }}
        >
          Remove
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div
        style={{
          width: '400px',
          maxWidth: '92%',
          background: '#ffffff',
          borderRadius: '16px',
          padding: '1.6rem 1.75rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
        }}
      >
        <div>
          <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', fontFamily: "'Outfit', sans-serif" }}>
            QC Inspector Registration
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '0.25rem', lineHeight: 1.5 }}>
            Register who is inspecting on this device. Your email is used to notify you when an
            approval stage <strong>rejects</strong> an inspection and when a project is <strong>completed &amp; fully signed</strong>.
            It is saved on this device only and can be changed or removed at any time.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <label style={{ fontSize: '0.66rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Name</label>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="e.g. Wulan"
            autoFocus
            style={{
              border: '2px solid rgba(15, 23, 42, 0.16)',
              borderRadius: '8px',
              padding: '0.5rem 0.7rem',
              fontSize: '0.8rem',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <label style={{ fontSize: '0.66rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Email</label>
          <input
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
            placeholder="e.g. qc@megaperintis.co.id"
            style={{
              border: '2px solid rgba(15, 23, 42, 0.16)',
              borderRadius: '8px',
              padding: '0.5rem 0.7rem',
              fontSize: '0.8rem',
              outline: 'none',
            }}
          />
        </div>

        {error && (
          <div style={{ fontSize: '0.7rem', color: '#EF4444', fontWeight: 700 }}>{error}</div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
          {profile && (
            <button
              type="button"
              onClick={() => { setEditing(false); setError(''); }}
              style={{
                border: '2px solid rgba(15, 23, 42, 0.16)',
                background: 'transparent',
                color: '#475569',
                fontWeight: 800,
                fontSize: '0.72rem',
                borderRadius: '10px',
                padding: '0.5rem 1rem',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            className="btn-electric"
            onClick={handleSave}
            style={{
              border: 'none',
              fontWeight: 800,
              fontSize: '0.72rem',
              borderRadius: '10px',
              padding: '0.5rem 1.2rem',
              cursor: 'pointer',
            }}
          >
            Save &amp; Continue
          </button>
        </div>
      </div>
    </div>
  );
};
