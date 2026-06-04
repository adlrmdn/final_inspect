import React from 'react';

interface FormHeaderProps {
  activePackagingProject: any;
  activeSession: any;
  template: { title: string } | null;
  getCycleName: (cycleNum: number) => string;
  onBack: () => void;
  setActivePackagingProject: (proj: any) => void;
  setSessionEditMode: (mode: boolean) => void;
  setActiveSession: (session: any) => void;
  onMinimize: () => void;
  onClose: () => void;
}

export const FormHeader: React.FC<FormHeaderProps> = ({
  activePackagingProject,
  activeSession,
  template,
  getCycleName,
  onBack,
  setActivePackagingProject,
  setSessionEditMode,
  setActiveSession,
  onMinimize,
  onClose,
}) => {
  return (
    <div
      className="flex-between dashboard-header form-view-header"
      style={{
        borderBottom: '1.5px solid rgba(37, 99, 235, 0.1)',
        paddingBottom: '0.85rem',
        marginBottom: '0.85rem',
        flexShrink: 0,
        gap: '1rem',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
        {/* Navigation/Close button */}
        <button
          type="button"
          className="btn-electric-outline form-back-btn"
          onClick={
            activePackagingProject
              ? () => {
                  setActivePackagingProject(null);
                  setSessionEditMode(false);
                  setActiveSession(null);
                }
              : onBack
          }
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
            style={{
              flexShrink: 0,
              marginRight: '4px',
              verticalAlign: 'middle',
              display: 'inline-block',
            }}
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          {activePackagingProject ? 'Close Workspace' : 'Return to Hub'}
        </button>

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
                      border: '1.5px solid rgba(37, 99, 235, 0.15)',
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
                          border: '1.5px solid rgba(16, 185, 129, 0.25)',
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
                  {activePackagingProject.cmt_cut_job_id && (
                    <>
                      <span style={{ opacity: 0.5 }}>•</span>
                      <span>{activePackagingProject.cmt_cut_job_id}</span>
                    </>
                  )}
                  {activePackagingProject.cmt_pak_job_id && (
                    <>
                      <span style={{ opacity: 0.5 }}>•</span>
                      <span>{activePackagingProject.cmt_pak_job_id}</span>
                    </>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
              <span className="dashboard-system-label">Quality Control Schema</span>
              <h1 className="dashboard-title" style={{ fontSize: '1.45rem', marginTop: '0.15rem' }}>
                {template ? template.title : ''}
              </h1>
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div className="hud-window-controls hud-window-controls-bar" style={{ display: 'flex', gap: '0.35rem' }}>
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
      </div>
    </div>
  );
};
