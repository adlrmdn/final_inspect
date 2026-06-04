import React from 'react';

interface WorkspaceControlsProps {
  activePackagingProject: any;
  activeSession: any;
  deletingProjectId: string | null;
  hasNextVersionExists: () => boolean;
  getCycleName: (cycleNum: number) => string;
  handleMoveVersion: () => void;
  handleCompleteProject: () => void;
  handleRemovePackagingProject: (projectId: string) => void;
  setActiveSession: (session: any) => void;
  setSelectedSizeTab: (size: string) => void;
  setSessionEditMode: (mode: boolean) => void;
  headerButtonStyle: React.CSSProperties;
  versionSelectorButtonStyle: (isSelected: boolean) => React.CSSProperties;
}

export const WorkspaceControls: React.FC<WorkspaceControlsProps> = ({
  activePackagingProject,
  activeSession,
  deletingProjectId,
  hasNextVersionExists,
  getCycleName,
  handleMoveVersion,
  handleCompleteProject,
  handleRemovePackagingProject,
  setActiveSession,
  setSelectedSizeTab,
  setSessionEditMode,
  headerButtonStyle,
  versionSelectorButtonStyle,
}) => {
  return (
    <div
      className="flex-between"
      style={{
        borderBottom: '1.5px solid rgba(37, 99, 235, 0.12)',
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
                        border: '1.5px solid rgba(16, 185, 129, 0.3)',
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
                      border: '1.5px solid rgba(16, 185, 129, 0.3)',
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
                Complete Workspace
              </button>
            ) : (
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
                ✓ Completed
              </span>
            )}
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
              Remove Workspace
            </button>
          </>
        )}
      </div>
    </div>
  );
};
