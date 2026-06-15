import React, { useState } from 'react';

interface WorkspaceControlsProps {
  activePackagingProject: any;
  activeSession: any;
  deletingProjectId: string | null;
  hasNextVersionExists: () => boolean;
  getCycleName: (cycleNum: number) => string;
  handleMoveVersion: () => void;
  handleCompleteProject: () => void;
  handleRevertProject: () => void;
  handleRemovePackagingProject: (projectId: string) => void;
  setActiveSession: (session: any) => void;
  setSelectedSizeTab: (size: string) => void;
  setSessionEditMode: (mode: boolean) => void;
  headerButtonStyle: React.CSSProperties;
  versionSelectorButtonStyle: (isSelected: boolean) => React.CSSProperties;
  handlePrintReport: () => void;
  handleUploadVerificationDoc: (projectId: string, docBase64: string) => Promise<void>;
}

export const WorkspaceControls: React.FC<WorkspaceControlsProps> = ({
  activePackagingProject,
  activeSession,
  deletingProjectId,
  hasNextVersionExists,
  getCycleName,
  handleMoveVersion,
  handleCompleteProject,
  handleRevertProject,
  handleRemovePackagingProject,
  setActiveSession,
  setSelectedSizeTab,
  setSessionEditMode,
  headerButtonStyle,
  versionSelectorButtonStyle,
  handlePrintReport,
  handleUploadVerificationDoc,
}) => {
  const [showPreview, setShowPreview] = useState(false);
  return (
    <div
      className="flex-between"
      style={{
        borderBottom: '2px solid rgba(15, 23, 42, 0.16)',
        paddingBottom: '0.75rem',
        marginBottom: '0.75rem',
        width: '100%',
        flexShrink: 0,
        alignItems: 'center',
        gap: '1rem',
        flexWrap: 'wrap',
      }}
    >
      {/* Left Side: Version Selectors */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: 800,
            color: 'var(--text-muted)',
            marginRight: '0.45rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          QC WORKSPACE VERSION:
        </span>
        {(() => {
          const visibleSessions = (activePackagingProject.sessions || [])
            .filter((s: any) => s.cycle_number >= 1)
            .sort((a: any, b: any) => a.cycle_number - b.cycle_number);

          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
              {visibleSessions.map((ses: any) => {
                const isSelected = activeSession && activeSession.session_id === ses.session_id;
                return (
                  <button
                    key={ses.session_id}
                    type="button"
                    onClick={() => {
                      setActiveSession(ses);
                      setSessionEditMode(false);
                      if (ses.report_lines && ses.report_lines.length > 0) {
                        setSelectedSizeTab(ses.report_lines[0].size_val || '');
                      }
                    }}
                    className={isSelected ? 'btn-electric' : 'btn-electric-outline'}
                    style={versionSelectorButtonStyle(isSelected)}
                  >
                    {getCycleName(ses.cycle_number)}
                  </button>
                );
              })}

              {/* + Next Version Button placed inline right after versions */}
              {activePackagingProject.status !== 'completed' &&
                (activeSession ? (
                  !hasNextVersionExists() &&
                  activeSession.cycle_number >= 1 &&
                  activeSession.cycle_number <= 3 && (
                    <button
                      type="button"
                      onClick={handleMoveVersion}
                      style={{
                        ...headerButtonStyle,
                        background: 'rgba(16, 185, 129, 0.08)',
                        border: '2px solid rgba(16, 185, 129, 0.4)',
                        color: '#10B981',
                        gap: '0.25rem',
                      }}
                    >
                      + Next Version
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={handleMoveVersion}
                    style={{
                      ...headerButtonStyle,
                      background: 'rgba(16, 185, 129, 0.08)',
                      border: '2px solid rgba(16, 185, 129, 0.4)',
                      color: '#10B981',
                      gap: '0.25rem',
                    }}
                  >
                    + Start Version 1
                  </button>
                ))}
            </div>
          );
        })()}
      </div>

      {/* Right Side: Workspace Control Panel */}
      <div style={{ display: 'flex', gap: '0.55rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: 800,
            color: 'var(--royal-blue)',
            marginRight: '0.45rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          ACTION:
        </span>

        {deletingProjectId === activePackagingProject.project_id ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.74rem', color: '#EF4444', padding: '0.45rem 1.15rem' }}>
            <span
              style={{
                display: 'inline-block',
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                border: '2px solid rgba(239, 68, 68, 0.2)',
                borderTopColor: '#EF4444',
                animation: 'spin-sync 1s linear infinite',
              }}
            />
            Removing Workspace...
          </div>
        ) : (
          <>
            {/* 1. Report */}
            {activeSession && (
              <button
                className="btn-electric-outline"
                onClick={handlePrintReport}
                style={{
                  height: '32px',
                  boxSizing: 'border-box',
                  width: 'auto',
                  padding: '0 0.85rem',
                  fontSize: '0.72rem',
                  color: 'var(--royal-blue)',
                  borderColor: 'rgba(37, 99, 235, 0.28)',
                  background: 'rgba(37, 99, 235, 0.05)',
                  fontWeight: 800,
                  borderRadius: '10px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: '1',
                  gap: '0.25rem',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
                Report
              </button>
            )}

            {/* 2. Verify */}
            <input
              type="file"
              id="verify-doc-upload"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    if (event.target?.result) {
                      handleUploadVerificationDoc(activePackagingProject.project_id, event.target.result as string);
                    }
                  };
                  reader.readAsDataURL(file);
                }
              }}
            />
            {activePackagingProject.verified_doc ? (
              <button
                type="button"
                className="btn-electric-outline"
                onClick={() => setShowPreview(true)}
                style={{
                  height: '32px',
                  boxSizing: 'border-box',
                  width: 'auto',
                  padding: '0 0.85rem',
                  fontSize: '0.72rem',
                  color: '#10B981',
                  borderColor: 'rgba(16, 185, 129, 0.28)',
                  background: 'rgba(16, 185, 129, 0.05)',
                  fontWeight: 800,
                  borderRadius: '10px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: '1',
                  gap: '0.25rem',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                ✓ Verified
              </button>
            ) : (
              <button
                type="button"
                className="btn-electric-outline"
                onClick={() => document.getElementById('verify-doc-upload')?.click()}
                style={{
                  height: '32px',
                  boxSizing: 'border-box',
                  width: 'auto',
                  padding: '0 0.85rem',
                  fontSize: '0.72rem',
                  color: 'var(--royal-blue)',
                  borderColor: 'rgba(37, 99, 235, 0.28)',
                  background: 'rgba(37, 99, 235, 0.05)',
                  fontWeight: 800,
                  borderRadius: '10px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: '1',
                  gap: '0.25rem',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
                Verify
              </button>
            )}

            {/* 3. Complete */}
            {activePackagingProject.status !== 'completed' ? (
              <button
                className="btn-electric-outline"
                onClick={handleCompleteProject}
                style={{
                  height: '32px',
                  boxSizing: 'border-box',
                  width: 'auto',
                  padding: '0 0.85rem',
                  fontSize: '0.72rem',
                  color: '#10B981',
                  borderColor: 'rgba(16, 185, 129, 0.28)',
                  background: 'rgba(16, 185, 129, 0.05)',
                  fontWeight: 800,
                  borderRadius: '10px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: '1',
                }}
              >
                Complete & Sync
              </button>
            ) : (
              <>
                <span
                  className="electric-badge emerald"
                  style={{
                    fontSize: '0.72rem',
                    height: '32px',
                    boxSizing: 'border-box',
                    padding: '0 0.85rem',
                    borderRadius: '10px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 'normal',
                  }}
                >
                  ✓ Completed & Synced
                </span>
                <button
                  className="btn-electric-outline"
                  onClick={handleRevertProject}
                  style={{
                    height: '32px',
                    boxSizing: 'border-box',
                    width: 'auto',
                    padding: '0 0.85rem',
                    fontSize: '0.72rem',
                    color: 'var(--amber-warm)',
                    borderColor: 'rgba(245, 158, 11, 0.28)',
                    background: 'rgba(245, 158, 11, 0.05)',
                    fontWeight: 800,
                    borderRadius: '10px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: '1',
                  }}
                >
                  Revert
                </button>
              </>
            )}

            {/* 4. Remove */}
            <button
              className="btn-electric-outline"
              onClick={() => handleRemovePackagingProject(activePackagingProject.project_id)}
              style={{
                height: '32px',
                boxSizing: 'border-box',
                width: 'auto',
                padding: '0 0.85rem',
                fontSize: '0.72rem',
                color: '#EF4444',
                borderColor: 'rgba(239, 68, 68, 0.28)',
                fontWeight: 800,
                borderRadius: '10px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: '1',
              }}
            >
              Remove
            </button>
          </>
        )}
      </div>

      {/* Verification Doc Preview Modal */}
      {showPreview && activePackagingProject.verified_doc && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            padding: '2rem',
          }} 
          onClick={() => setShowPreview(false)}
        >
          <div 
            style={{
              position: 'relative',
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '1.5rem',
              width: '500px',
              maxWidth: '90%',
              maxHeight: '90%',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            }} 
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(15, 23, 42, 0.08)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#0F172A', fontFamily: "'Outfit', sans-serif" }}>Verification Document</h3>
              <button 
                type="button" 
                onClick={() => setShowPreview(false)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: '1.25rem',
                  fontWeight: 'bold',
                  color: '#64748B',
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ overflow: 'auto', display: 'flex', justifyContent: 'center', background: '#F8FAFC', borderRadius: '8px', padding: '0.5rem' }}>
              <img 
                src={activePackagingProject.verified_doc} 
                alt="Verification Doc" 
                style={{ maxWidth: '100%', maxHeight: '50vh', objectFit: 'contain', borderRadius: '6px' }} 
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid rgba(15, 23, 42, 0.08)', paddingTop: '0.75rem' }}>
              <button
                type="button"
                className="btn-electric-outline"
                onClick={() => {
                  setShowPreview(false);
                  document.getElementById('verify-doc-upload')?.click();
                }}
                style={{
                  height: '32px',
                  boxSizing: 'border-box',
                  width: 'auto',
                  padding: '0 0.85rem',
                  fontSize: '0.72rem',
                  color: 'var(--royal-blue)',
                  borderColor: 'rgba(37, 99, 235, 0.28)',
                  background: 'rgba(37, 99, 235, 0.05)',
                  fontWeight: 800,
                  borderRadius: '10px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: '1',
                }}
              >
                Re-upload Doc
              </button>
              <button
                type="button"
                className="btn-electric"
                onClick={() => setShowPreview(false)}
                style={{
                  height: '32px',
                  boxSizing: 'border-box',
                  width: 'auto',
                  padding: '0 1rem',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  borderRadius: '10px',
                  cursor: 'pointer',
                  background: 'var(--royal-blue)',
                  color: '#ffffff',
                  border: 'none',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
