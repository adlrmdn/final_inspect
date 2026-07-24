import React, { useState, useEffect } from 'react';
import { getInspectorProfile, clearInspectorProfile, InspectorProfile } from '../../utils/inspector_profile';

interface FormHeaderProps {
  activePackagingProject: any;
  activeSession: any;
  getCycleName: (cycleNum: number) => string;
  setActivePackagingProject: (proj: any) => void;
  setSessionEditMode: (mode: boolean) => void;
  setActiveSession: (session: any) => void;
  onMinimize: () => void;
  onClose: () => void;
  onShowGuidelines?: () => void;
}

export const FormHeader: React.FC<FormHeaderProps> = ({
  activePackagingProject,
  activeSession,
  getCycleName,
  setActivePackagingProject,
  setSessionEditMode,
  setActiveSession,
  onMinimize,
  onClose,
  onShowGuidelines,
}) => {
  const [profile, setProfile] = useState<InspectorProfile | null>(() => getInspectorProfile());

  useEffect(() => {
    const handleProfileChange = () => {
      setProfile(getInspectorProfile());
    };
    window.addEventListener('inspector-profile-changed', handleProfileChange);
    return () => {
      window.removeEventListener('inspector-profile-changed', handleProfileChange);
    };
  }, []);

  const handleEditProfile = () => {
    window.dispatchEvent(new CustomEvent('edit-inspector-profile'));
  };

  const handleRemoveProfile = () => {
    clearInspectorProfile();
    window.dispatchEvent(new CustomEvent('inspector-profile-changed'));
  };

  return (
    <div
      className="flex-between dashboard-header form-view-header"
      style={{
        borderBottom: '2px solid rgba(15, 23, 42, 0.16)',
        paddingBottom: '0.85rem',
        marginBottom: '0.85rem',
        flexShrink: 0,
        gap: '1rem',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
        {/* Close button — only shown when a workspace is open; no hub to return to otherwise */}
        {activePackagingProject && (
          <button
            type="button"
            className="btn-electric-outline form-back-btn"
            onClick={() => {
              setActivePackagingProject(null);
              setSessionEditMode(false);
              setActiveSession(null);
            }}
            style={{ width: 'auto', padding: '0.45rem 1.25rem', marginLeft: '6px' }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0, marginRight: '4px', verticalAlign: 'middle', display: 'inline-block' }}
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Close Workspace
          </button>
        )}

        <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
          {activePackagingProject ? (
            <>
              {/* Left Side: Rearranged Project Info (4-row layout) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', textAlign: 'left' }}>
                {/* Row 1: Style Name + Season Badge + Version Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                  <h1 className="dashboard-title" style={{ fontSize: '1.45rem', margin: 0, fontWeight: 900, color: 'var(--deep-ocean)' }}>
                    {activePackagingProject.article_name}
                  </h1>
                  <span
                    className="electric-badge teal hud-header-badge"
                    style={{
                      fontSize: '0.65rem',
                      height: '20px',
                      padding: '0 0.65rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 'normal',
                      fontWeight: 800,
                      background: 'rgba(37, 99, 235, 0.05)',
                      color: 'var(--royal-blue)',
                      border: '2px solid rgba(37, 99, 235, 0.25)',
                      borderRadius: '99px',
                    }}
                  >
                    {activePackagingProject.season}
                  </span>
                  {(() => {
                    const latestSession =
                      activePackagingProject.sessions && activePackagingProject.sessions.length > 0
                        ? [...activePackagingProject.sessions].sort((a: any, b: any) => b.cycle_number - a.cycle_number)[0]
                        : activeSession;
                    if (!latestSession) return null;
                    return (
                      <span
                        className="electric-badge emerald hud-header-badge"
                        style={{
                          fontSize: '0.65rem',
                          height: '20px',
                          padding: '0 0.65rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          lineHeight: 'normal',
                          fontWeight: 800,
                          background: 'rgba(16, 185, 129, 0.05)',
                          color: '#10B981',
                          border: '2px solid rgba(16, 185, 129, 0.35)',
                          borderRadius: '99px',
                        }}
                      >
                        VERSION: {getCycleName(latestSession.cycle_number).toUpperCase()}
                      </span>
                    );
                  })()}
                </div>

                {/* Row 2: Vendor Name */}
                {activePackagingProject.po_vendor && (
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--royal-blue)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                    {activePackagingProject.po_vendor}
                  </div>
                )}

                {/* Row 3: PO, Qty, Plan Date details */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  {activePackagingProject.po_info && (
                    <span>
                      PO: <strong style={{ color: 'var(--deep-ocean)', fontWeight: 800 }}>{activePackagingProject.po_info}</strong>
                    </span>
                  )}
                  {activePackagingProject.po_info && (activePackagingProject.po_qty || activePackagingProject.po_plan_date) && (
                    <span style={{ opacity: 0.5, margin: '0 0.2rem' }}>•</span>
                  )}
                  {activePackagingProject.po_qty && (
                    <span>
                      Qty: <strong style={{ color: 'var(--deep-ocean)', fontWeight: 800 }}>{activePackagingProject.po_qty} units</strong>
                    </span>
                  )}
                  {activePackagingProject.po_qty && activePackagingProject.po_plan_date && (
                    <span style={{ opacity: 0.5, margin: '0 0.2rem' }}>•</span>
                  )}
                  {activePackagingProject.po_plan_date && (
                    <span>
                      Plan Date: <strong style={{ color: 'var(--deep-ocean)', fontWeight: 800 }}>{activePackagingProject.po_plan_date}</strong>
                    </span>
                  )}
                </div>

                {/* Row 4: Lighter grey monospaced IDs */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap', fontFamily: 'monospace', fontSize: '0.72rem', color: '#64748B' }}>
                  <span>{activePackagingProject.plm_id}</span>
                  {activePackagingProject.production_group && (
                    <>
                      <span style={{ opacity: 0.5 }}>•</span>
                      <span>{activePackagingProject.production_group}</span>
                    </>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
              <span className="dashboard-system-label">QC Console System</span>
              <h1 className="dashboard-title" style={{ fontSize: '1.45rem', marginTop: '0.15rem' }}>
                FINAL INSPECTION
              </h1>
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
        <span style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--text-muted)', opacity: 0.75, fontFamily: 'monospace', lineHeight: '1' }}>
          v1.2.1
        </span>
        <div className="hud-window-controls hud-window-controls-bar" style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          {onShowGuidelines && (
            <button
              type="button"
              className="btn-electric-outline"
              onClick={onShowGuidelines}
              aria-label="View Guidelines"
              title="View Guidelines"
              style={{
                width: '32px',
                height: '32px',
                padding: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--royal-blue)',
                borderColor: 'rgba(37, 99, 235, 0.35)',
                background: 'rgba(37, 99, 235, 0.05)',
                borderRadius: '50%',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </button>
          )}
          <button className="hud-win-btn minimize" onClick={onMinimize} aria-label="Minimize" title="Minimize Window">
            <svg width="10" height="2" viewBox="0 0 10 2" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.85 }}>
              <path d="M1 1H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          <button className="hud-win-btn close" onClick={onClose} aria-label="Close" title="Quit Application">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.85 }}>
              <path d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {profile && (
          <div
            className="inspector-profile-chip no-print"
            style={{
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
              flexShrink: 0,
              marginTop: '0.4rem',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--royal-blue)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span style={{ fontWeight: 800 }}>{profile.name}</span>
            <span style={{ color: '#64748B' }}>{profile.email}</span>
            <button
              type="button"
              onClick={handleEditProfile}
              title="Change the registered QC inspector"
              style={{ border: 'none', background: 'transparent', color: 'var(--royal-blue)', fontWeight: 800, fontSize: '0.66rem', cursor: 'pointer', padding: '0 0.15rem' }}
            >
              Change
            </button>
            <button
              type="button"
              onClick={handleRemoveProfile}
              title="Remove the registered QC inspector from this device"
              style={{ border: 'none', background: 'transparent', color: '#EF4444', fontWeight: 800, fontSize: '0.66rem', cursor: 'pointer', padding: '0 0.15rem' }}
            >
              Remove
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
