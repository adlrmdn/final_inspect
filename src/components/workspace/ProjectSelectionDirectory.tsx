import React, { useState } from 'react';

interface ProjectSelectionDirectoryProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isDropdownOpen: boolean;
  setIsDropdownOpen: (open: boolean) => void;
  activeActivities: any[];
  packagingProjects: any[];
  deviceProjectIds: string[];
  selectedActivity: any;
  setSelectedActivity: (activity: any) => void;
  isDownloading: boolean;
  deletingProjectId: string | null;
  handleDownloadProject: () => void;
  handleRemovePackagingProject: (projectId: string) => void;
  setActivePackagingProject: (project: any) => void;
  isFetchingProjects: boolean;
  showProfessionalAlert: (title: string, msg: string, type?: 'alert' | 'success' | 'danger') => Promise<any>;
  getCycleName: (cycleNum: number) => string;
}

const formatLastModified = (dateStr: string) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    const hr = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `Last Modified: ${d}/${m}/${y} ${hr}:${min}`;
  } catch {
    return '';
  }
};

export const ProjectSelectionDirectory: React.FC<ProjectSelectionDirectoryProps> = ({
  searchQuery,
  setSearchQuery,
  isDropdownOpen,
  setIsDropdownOpen,
  activeActivities,
  packagingProjects,
  deviceProjectIds,
  selectedActivity,
  setSelectedActivity,
  isDownloading,
  deletingProjectId,
  handleDownloadProject,
  handleRemovePackagingProject,
  setActivePackagingProject,
  isFetchingProjects,
  showProfessionalAlert,
  getCycleName,
}) => {
  const [filterMode, setFilterMode] = useState<'device' | 'all'>('device');

  const filteredProjects = React.useMemo(() => {
    if (filterMode === 'device') {
      return packagingProjects.filter((p: any) => deviceProjectIds.includes(p.project_id));
    }
    return packagingProjects;
  }, [packagingProjects, deviceProjectIds, filterMode]);

  const deviceCount = React.useMemo(() => {
    return packagingProjects.filter((p: any) => deviceProjectIds.includes(p.project_id)).length;
  }, [packagingProjects, deviceProjectIds]);

  const allCount = packagingProjects.length;

  return (
    <div style={{ flex: 1, overflowY: 'auto', width: '100%', display: 'flex', flexDirection: 'column', zIndex: 2, position: 'relative', paddingRight: '0.75rem' }}>
      {/* UPPER DROPDOWN SELECTOR FOR STYLE PASSWORDS */}
      <div style={{ width: '100%', maxWidth: '520px', margin: '0 auto 1.5rem auto', position: 'relative', zIndex: 10 }}>
        <label className="form-label" style={{ textAlign: 'center', marginBottom: '0.5rem', display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--royal-blue)' }}>
          Select Style to Start
        </label>

        {selectedActivity ? (
          /* Selected Style Passport */
          <div
            className="bento-card"
            style={{
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(239, 246, 255, 0.9) 100%)',
              border: '2px solid rgba(37, 99, 235, 0.38) !important',
              padding: '1rem',
              borderRadius: '16px',
              boxShadow: '0 8px 24px rgba(37, 99, 235, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '1rem' }}>
              <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--deep-ocean)' }}>{selectedActivity.article_name}</div>
                  <span
                    className="electric-badge silver"
                    style={{ fontSize: '0.58rem', padding: '0 0.4rem', lineHeight: '1', display: 'inline-flex', alignItems: 'center', height: '1.05rem', flexShrink: 0 }}
                  >
                    {selectedActivity.season}
                  </span>
                </div>

                <div style={{ fontSize: '0.72rem', color: 'var(--royal-blue)', fontFamily: 'monospace', marginTop: '0.1rem' }}>
                  PRG: <strong>{selectedActivity.production_group}</strong> {selectedActivity.plm_id && selectedActivity.plm_id !== 'N/A' && `• PLM: ${selectedActivity.plm_id}`}
                </div>

                {selectedActivity.po_vendor && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--royal-blue)', fontWeight: 800, textAlign: 'left' }}>
                    {selectedActivity.po_vendor}
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                  {selectedActivity.po_info && (
                    <span>
                      PO: <strong style={{ color: 'var(--deep-ocean)' }}>{selectedActivity.po_info}</strong>
                    </span>
                  )}
                  {selectedActivity.po_qty && (
                    <>
                      <span>•</span>
                      <span>
                        Qty: <strong style={{ color: 'var(--deep-ocean)' }}>{selectedActivity.po_qty} units</strong>
                      </span>
                    </>
                  )}
                  {selectedActivity.po_plan_date && (
                    <>
                      <span>•</span>
                      <span>
                        Plan Date: <strong style={{ color: 'var(--deep-ocean)' }}>{selectedActivity.po_plan_date}</strong>
                      </span>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedActivity(null)}
                className="btn-electric-outline"
                style={{ width: 'auto', padding: '0.4rem 0.85rem', fontSize: '0.72rem', borderRadius: '10px', flexShrink: 0, cursor: 'pointer' }}
              >
                Change Style
              </button>
            </div>

            {/* Action button to download */}
            <button
              onClick={() => handleDownloadProject()}
              disabled={isDownloading}
              className="btn-electric-outline"
              style={{
                width: '100%',
                padding: '0.65rem',
                background: 'var(--royal-blue)',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '0.78rem',
                fontWeight: 800,
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem',
                cursor: 'pointer',
              }}
            >
              {isDownloading ? (
                <>
                  <span className="sync-activity-indicator" style={{ display: 'inline-flex', width: '12px', height: '12px', marginRight: '6px' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                  </span>
                  Configuring Workspace...
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Start Workspace
                </>
              )}
            </button>
          </div>
        ) : (
          /* Search Input Box */
          <div style={{ position: 'relative' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: '#FFFFFF',
                border: '2px solid rgba(37, 99, 235, 0.28)',
                borderRadius: '99px',
                padding: '0.35rem 0.5rem 0.35rem 0.85rem',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.02)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--royal-blue)" strokeWidth="2.5" style={{ marginRight: '0.5rem', flexShrink: 0 }}>
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                className="premium-chat-input"
                placeholder="Search active styles (e.g. Carmenta, basic, WINTER)..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                style={{ fontSize: '0.8rem', padding: '0.3rem 0 !important' }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.9rem', cursor: 'pointer', padding: '0.2rem' }}
                >
                  &times;
                </button>
              )}
            </div>

            {/* Dropdown Floating Results List */}
            {isDropdownOpen && (
              <>
                <div onClick={() => setIsDropdownOpen(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99, cursor: 'default' }} />
                <div
                  className="bento-card style-search-scroll"
                  style={{
                    position: 'absolute',
                    top: '105%',
                    left: 0,
                    right: 0,
                    maxHeight: '200px',
                    overflowY: 'auto',
                    background: '#ffffff',
                    border: '2px solid rgba(37, 99, 235, 0.22) !important',
                    borderRadius: '16px',
                    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.08)',
                    padding: '0.5rem 0.75rem 0.5rem 0.5rem !important',
                    zIndex: 100,
                  }}
                >
                  {activeActivities.filter(
                    (act) =>
                      act.plm_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      act.article_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      act.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (act.production_group || '').toLowerCase().includes(searchQuery.toLowerCase())
                  ).length > 0 ? (
                    activeActivities
                      .filter(
                        (act) =>
                          act.plm_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          act.article_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          act.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (act.production_group || '').toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((act, index) => {
                        const isDownloaded = packagingProjects.some((p: any) => p.production_group === act.production_group);
                        return (
                          <div
                            key={index}
                            onClick={async () => {
                              const isPoMissing = (act.production_type || '').toUpperCase() === 'CMT' && (!act.po_info || act.po_info.trim() === '');
                              if (isPoMissing) {
                                await showProfessionalAlert(
                                  'PO Not Registered',
                                  `The style '${act.article_name}' (${act.production_group}) cannot be downloaded or configured because its CMT purchase order has not been registered yet.`,
                                  'danger'
                                );
                                return;
                              }
                              setIsDropdownOpen(false);
                              setSearchQuery('');
                              if (isDownloaded) {
                                await showProfessionalAlert(
                                  'Style Already Active',
                                  `The style '${act.article_name}' (${act.production_group}) is already active in your directory. To inspect this style, please open it from the Active Inspection Workspaces list below.`,
                                  'alert'
                                );
                              } else {
                                setSelectedActivity(act);
                              }
                            }}
                            className="operation-chip-premium"
                            style={{
                              padding: '0.65rem 0.85rem',
                              borderRadius: '10px',
                              cursor: ((act.production_type || '').toUpperCase() === 'CMT' && (!act.po_info || act.po_info.trim() === '')) ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'flex-start',
                              textAlign: 'left',
                              marginBottom: '0.25rem',
                              transition: 'all 0.15s ease',
                              opacity: ((act.production_type || '').toUpperCase() === 'CMT' && (!act.po_info || act.po_info.trim() === '')) ? 0.6 : 1,
                              border: isDownloaded ? '1px dashed rgba(13, 148, 136, 0.4)' : '1px solid transparent',
                              background: isDownloaded ? 'rgba(13, 148, 136, 0.02)' : (((act.production_type || '').toUpperCase() === 'CMT' && (!act.po_info || act.po_info.trim() === '')) ? 'rgba(239, 68, 68, 0.02)' : ''),
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', width: '100%' }}>
                              <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--deep-ocean)' }}>{act.article_name}</div>
                              <span
                                className="electric-badge silver"
                                style={{
                                  fontSize: '0.58rem',
                                  padding: '0 0.4rem',
                                  lineHeight: '1',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  height: '1.05rem',
                                  flexShrink: 0,
                                }}
                              >
                                {act.season}
                              </span>
                              {((act.production_type || '').toUpperCase() === 'CMT' && (!act.po_info || act.po_info.trim() === '')) ? (
                                <span
                                  className="electric-badge silver"
                                  style={{
                                    fontSize: '0.52rem',
                                    padding: '0.05rem 0.35rem',
                                    textTransform: 'uppercase',
                                    height: 'auto',
                                    lineHeight: '1.2',
                                    border: '1px solid rgba(239,68,68,0.3)',
                                    background: 'rgba(239,68,68,0.05)',
                                    color: '#EF4444',
                                  }}
                                >
                                  Locked: PO Pending
                                </span>
                              ) : isDownloaded && (
                                <span
                                  className="electric-badge teal"
                                  style={{
                                    fontSize: '0.52rem',
                                    padding: '0.05rem 0.35rem',
                                    textTransform: 'uppercase',
                                    height: 'auto',
                                    lineHeight: '1.2',
                                    border: '1px solid rgba(13,148,136,0.3)',
                                    background: 'rgba(13,148,136,0.05)',
                                    color: 'var(--teal-blue)',
                                  }}
                                >
                                  Active in Directory
                                </span>
                              )}
                            </div>

                            <div style={{ fontSize: '0.68rem', color: 'var(--royal-blue)', fontFamily: 'monospace', marginTop: '0.1rem', textAlign: 'left' }}>
                              PRG: <strong>{act.production_group}</strong> {act.plm_id && act.plm_id !== 'N/A' && `• PLM: ${act.plm_id}`}
                            </div>

                            {act.po_vendor && (
                              <div style={{ fontSize: '0.72rem', color: 'var(--royal-blue)', fontWeight: 800, marginTop: '0.2rem', textAlign: 'left' }}>
                                {act.po_vendor}
                              </div>
                            )}

                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.45rem',
                                flexWrap: 'wrap',
                                marginTop: '0.2rem',
                                fontSize: '0.65rem',
                                color: 'var(--text-muted)',
                              }}
                            >
                              <span>
                                PO: <strong style={{ color: 'var(--deep-ocean)' }}>{act.po_info || ((act.production_type || '').toUpperCase() === 'CMT' ? 'Pending Registration' : 'In-house Production')}</strong>
                              </span>
                              {act.po_info && act.po_info.trim() !== '' && (
                                <>
                                  <span>•</span>
                                  <span>
                                    Qty: <strong style={{ color: 'var(--deep-ocean)' }}>{act.po_qty} units</strong>
                                  </span>
                                  <span>•</span>
                                  <span>
                                    Plan Date: <strong style={{ color: 'var(--deep-ocean)' }}>{act.po_plan_date}</strong>
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })
                  ) : (
                    <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.78rem', textAlign: 'center' }}>
                      No matching active PLM styles found.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* SECTION: DOWNLOADED PROJECTS DIRECTORY */}
      <div style={{ borderTop: '2px solid rgba(15, 23, 42, 0.16)', paddingTop: '1rem', width: '100%', textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', width: '100%', gap: '1rem', flexWrap: 'wrap' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--deep-ocean)', margin: 0 }}>
            Active Inspection Workspaces ({filteredProjects.length})
          </h3>

          {/* Glassmorphic Tab Selector */}
          <div style={{
            display: 'flex',
            background: 'rgba(15, 23, 42, 0.04)',
            borderRadius: '99px',
            padding: '2px',
            border: '1.5px solid rgba(15, 23, 42, 0.08)',
          }}>
            <button
              onClick={() => setFilterMode('device')}
              style={{
                border: 'none',
                background: filterMode === 'device' ? '#FFFFFF' : 'transparent',
                color: filterMode === 'device' ? 'var(--royal-blue)' : 'var(--text-muted)',
                fontWeight: filterMode === 'device' ? 800 : 600,
                fontSize: '0.7rem',
                padding: '0.35rem 0.85rem',
                borderRadius: '99px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: filterMode === 'device' ? '0 2px 6px rgba(0, 0, 0, 0.05)' : 'none',
              }}
            >
              My Device ({deviceCount})
            </button>
            <button
              onClick={() => setFilterMode('all')}
              style={{
                border: 'none',
                background: filterMode === 'all' ? '#FFFFFF' : 'transparent',
                color: filterMode === 'all' ? 'var(--royal-blue)' : 'var(--text-muted)',
                fontWeight: filterMode === 'all' ? 800 : 600,
                fontSize: '0.7rem',
                padding: '0.35rem 0.85rem',
                borderRadius: '99px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: filterMode === 'all' ? '0 2px 6px rgba(0, 0, 0, 0.05)' : 'none',
              }}
            >
              All Devices ({allCount})
            </button>
          </div>
        </div>

        {isFetchingProjects ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.85rem' }}>
            {[1, 2].map((i) => (
              <div
                key={i}
                className="qms-project-card skeleton-card-pulse"
                style={{
                  marginBottom: '0.5rem',
                  height: '95px',
                  background: 'rgba(37, 99, 235, 0.03)',
                  border: '2px solid rgba(15, 23, 42, 0.12)',
                  borderRadius: '16px',
                  padding: '0.85rem 1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <div style={{ width: '40px', height: '11px', borderRadius: '4px', background: 'rgba(37,99,235,0.06)' }} />
                    <div style={{ width: '50px', height: '11px', borderRadius: '4px', background: 'rgba(37,99,235,0.06)' }} />
                  </div>
                  <div style={{ width: '45%', height: '14px', borderRadius: '4px', background: 'rgba(37,99,235,0.08)' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ width: '130px', height: '10px', borderRadius: '4px', background: 'rgba(37,99,235,0.04)' }} />
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <div style={{ width: '85px', height: '24px', borderRadius: '8px', background: 'rgba(37,99,235,0.05)' }} />
                    <div style={{ width: '55px', height: '24px', borderRadius: '8px', background: 'rgba(239,68,68,0.05)' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          filterMode === 'device' ? (
            <div
              style={{
                padding: '2.5rem 1.5rem',
                borderRadius: '16px',
                background: 'rgba(37, 99, 235, 0.02)',
                border: '2px solid rgba(15, 23, 42, 0.16)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.85rem',
                textAlign: 'center',
                margin: '1.5rem 0',
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ maxWidth: '360px' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--deep-ocean)', display: 'block', marginBottom: '0.25rem' }}>
                  No Workspace on This Device
                </span>
                <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '0 0 1rem 0', lineHeight: 1.45 }}>
                  You haven't started or adopted any active workspaces on this device yet.
                </p>
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className="btn-electric-outline"
                  style={{ width: 'auto', padding: '0.45rem 1rem', fontSize: '0.72rem', background: 'rgba(37, 99, 235, 0.05)', borderRadius: '10px', cursor: 'pointer' }}
                >
                  View All Devices ({allCount})
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: '2.5rem 1.5rem',
                borderRadius: '16px',
                background: 'rgba(37, 99, 235, 0.02)',
                border: '2px solid rgba(15, 23, 42, 0.16)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.85rem',
                textAlign: 'center',
                margin: '1.5rem 0',
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ maxWidth: '360px' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--deep-ocean)', display: 'block', marginBottom: '0.25rem' }}>
                  No Active Inspection Workspace
                </span>
                <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.45 }}>
                  Search and select a PLM style from the dropdown above to download it and start logging iterative QC inspection sessions.
                </p>
              </div>
            </div>
          )
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.85rem' }}>
            {filteredProjects.map((proj: any) => {
              const isDeleting = deletingProjectId === proj.project_id;
              const latestSession =
                proj.sessions && proj.sessions.length > 0
                  ? [...proj.sessions].sort((a: any, b: any) => b.cycle_number - a.cycle_number)[0]
                  : null;
              const versionText = latestSession
                ? `VERSION: ${getCycleName(latestSession.cycle_number).toUpperCase()}`
                : 'NO VERSION INITIALIZED';

              return (
                <div
                  key={proj.project_id}
                  className={`qms-project-card ${isDeleting ? 'skeleton-card-pulse' : ''}`}
                  style={{
                    marginBottom: '0.5rem',
                    opacity: isDeleting ? 0.6 : 1,
                    pointerEvents: isDeleting ? 'none' : 'auto',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      {/* First line: Article Name + Season Badge */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--deep-ocean)', margin: 0 }}>{proj.article_name}</h4>
                        <span
                          className="electric-badge silver"
                          style={{
                            fontSize: '0.56rem',
                            height: '18px',
                            padding: '0 0.5rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            lineHeight: 'normal',
                          }}
                        >
                          {proj.season}
                        </span>
                      </div>

                      {/* Second line: Vendor Name */}
                      {proj.po_vendor && (
                        <div style={{ fontSize: '0.74rem', color: 'var(--royal-blue)', fontWeight: 800, marginTop: '0.1rem' }}>{proj.po_vendor}</div>
                      )}

                      {/* Third line: PO info, Qty, Plan Date */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          flexWrap: 'wrap',
                          fontSize: '0.68rem',
                          color: 'var(--text-muted)',
                          marginTop: '0.1rem',
                        }}
                      >
                        <span>
                          PO: <strong style={{ color: 'var(--deep-ocean)' }}>{proj.po_info || 'N/A'}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Qty: <strong style={{ color: 'var(--deep-ocean)' }}>{proj.po_qty || 0} units</strong>
                        </span>
                        {proj.po_plan_date && (
                          <>
                            <span>•</span>
                            <span>
                              Plan Date: <strong style={{ color: 'var(--deep-ocean)' }}>{proj.po_plan_date}</strong>
                            </span>
                          </>
                        )}
                      </div>

                      {/* Fourth line: PLM ID, Group ID, Job Transaction ID */}
                      <div
                        style={{
                          display: 'flex',
                          gap: '0.45rem',
                          fontFamily: 'monospace',
                          fontSize: '0.62rem',
                          color: 'var(--text-muted)',
                          marginTop: '0.1rem',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span>{proj.plm_id}</span>
                        <span>•</span>
                        <span>{proj.production_group}</span>
                        <span>•</span>
                        <span>{proj.cmt_pak_job_id || proj.cmt_cut_job_id || '(No Job Transaction)'}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem', flexShrink: 0 }}>
                      <span
                        className="electric-badge teal"
                        style={{
                          fontSize: '0.52rem',
                          height: '16px',
                          padding: '0 0.45rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          lineHeight: 'normal',
                          fontWeight: 800,
                        }}
                      >
                        {versionText}
                      </span>
                      {proj.updated_at && (
                        <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'monospace', opacity: 0.85 }}>
                          {formatLastModified(proj.updated_at)}
                        </span>
                      )}
                      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                        {isDeleting ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: '#EF4444', padding: '0.45rem 1rem' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                border: '2px solid rgba(239, 68, 68, 0.2)',
                                borderTopColor: '#EF4444',
                                animation: 'spin-sync 1s linear infinite',
                              }}
                            />
                            Removing...
                          </div>
                        ) : (
                          <>
                            {proj.status === 'completed' ? (
                              <div
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.4rem',
                                  fontSize: '0.72rem',
                                  color: '#10B981',
                                  fontWeight: 800,
                                  paddingRight: '0.5rem',
                                }}
                              >
                                <span
                                  style={{
                                    display: 'inline-block',
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    backgroundColor: '#10B981',
                                  }}
                                />
                                Completed & Synced
                              </div>
                            ) : (
                              <div
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.4rem',
                                  fontSize: '0.72rem',
                                  color: 'var(--text-muted)',
                                  fontWeight: 800,
                                  paddingRight: '0.5rem',
                                }}
                              >
                                <span
                                  style={{
                                    display: 'inline-block',
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    backgroundColor: 'var(--text-muted)',
                                  }}
                                />
                                Draft
                              </div>
                            )}

                            <button
                              onClick={() => {
                                setActivePackagingProject(proj);
                              }}
                              className="btn-electric-outline"
                              style={{ width: 'auto', padding: '0.45rem 1rem', fontSize: '0.72rem', background: 'rgba(37, 99, 235, 0.05)', borderRadius: '10px', cursor: 'pointer' }}
                            >
                              Open
                            </button>

                            <button
                              onClick={() => handleRemovePackagingProject(proj.project_id)}
                              className="btn-electric-outline"
                              style={{ width: 'auto', padding: '0.45rem 1rem', fontSize: '0.72rem', color: '#EF4444', borderColor: 'rgba(239, 68, 68, 0.28)', borderRadius: '10px', cursor: 'pointer' }}
                            >
                              Remove
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
