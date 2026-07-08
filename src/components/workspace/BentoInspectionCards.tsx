import React from 'react';

interface BentoInspectionCardsProps {
  activePackagingProject: any;
  activeSession: any;
  sessionEditMode: boolean;
  selectedSizeTab: string;
  setSelectedSizeTab: (size: string) => void;
  setActiveSession: React.Dispatch<React.SetStateAction<any>>;
  handleRefetchReportLines: () => Promise<void>;
}

export const BentoInspectionCards: React.FC<BentoInspectionCardsProps> = ({
  activePackagingProject,
  activeSession,
  sessionEditMode,
  selectedSizeTab,
  setSelectedSizeTab,
  setActiveSession,
  handleRefetchReportLines,
}) => {
  const [activeLineId, setActiveLineId] = React.useState<string | null>(null);

  // Sync state when activeSession or report_lines load or change
  React.useEffect(() => {
    if (activeSession && activeSession.report_lines && activeSession.report_lines.length > 0) {
      const isValid = activeSession.report_lines.some((l: any) => l.report_id === activeLineId);
      if (!isValid) {
        setActiveLineId(activeSession.report_lines[0].report_id);
      }
    }
  }, [activeSession, activeLineId]);

  // Auto-fill cutting_pcs from base_lines total — runs once per session, never overwrites after that
  const cuttingAutoFilledRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!activeSession || !activePackagingProject) return;
    if (cuttingAutoFilledRef.current === activeSession.session_id) return;
    if (activeSession.cutting_pcs && activeSession.cutting_pcs !== 0) {
      cuttingAutoFilledRef.current = activeSession.session_id;
      return;
    }
    const total = (activePackagingProject.base_lines || []).reduce(
      (sum: number, l: any) => sum + (l.total_good_qty || 0), 0
    );
    if (total > 0) {
      cuttingAutoFilledRef.current = activeSession.session_id;
      setActiveSession((prev: any) => ({ ...prev, cutting_pcs: total }));
    }
  }, [activeSession?.session_id, activePackagingProject?.project_id]);

  // Sync state when parent size tab changes (e.g. from AI commands)
  React.useEffect(() => {
    if (selectedSizeTab && activeSession && activeSession.report_lines) {
      const line = activeSession.report_lines.find((l: any) => l.size_val === selectedSizeTab);
      if (line && line.report_id !== activeLineId) {
        setActiveLineId(line.report_id);
      }
    }
  }, [selectedSizeTab, activeSession]);

  const cardStyle: React.CSSProperties = {

    padding: '1.25rem',
    background: '#ffffff',
    border: '2px solid rgba(15, 23, 42, 0.16)',
    borderRadius: '16px',
    boxShadow: '0 4px 20px rgba(15, 23, 42, 0.02)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    textAlign: 'left',
    transform: 'none',
    transition: 'box-shadow 0.3s ease, border-color 0.3s ease',
  };

  const renderSizeDetailsGrid = (isEdit: boolean) => {
    if (!activeSession || !activeSession.report_lines || activeSession.report_lines.length === 0) {
      return (
        <div
          style={{
            padding: '1.25rem',
            border: '2px dashed rgba(15, 23, 42, 0.16)',
            borderRadius: '12px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.65rem',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'rgba(15, 23, 42, 0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--deep-ocean)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--deep-ocean)', marginBottom: '0.25rem' }}>No Size Data Available</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', maxWidth: '300px', lineHeight: 1.5 }}>
              CMT-Pak size report lines have not been loaded for this version. This could mean D365 has no active CMT-Pak job for this production group,
              or the data fetch failed.
            </div>
          </div>
          {/* Diagnostic Panel */}
          <div
            style={{
              width: '100%',
              background: '#F8FAFC',
              borderRadius: '8px',
              padding: '0.75rem',
              textAlign: 'left',
              fontSize: '0.62rem',
              color: 'var(--text-muted)',
              border: '2px solid rgba(15, 23, 42, 0.12)',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '0.65rem', color: 'var(--deep-ocean)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
              Data Diagnostic
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem 0.75rem' }}>
              <span style={{ fontWeight: 700 }}>PLM ID:</span>
              <span style={{ fontFamily: 'monospace' }}>{activePackagingProject?.plm_id || '—'}</span>
              <span style={{ fontWeight: 700 }}>Production Group:</span>
              <span style={{ fontFamily: 'monospace' }}>{activePackagingProject?.production_group || '—'}</span>
              <span style={{ fontWeight: 700 }}>CMT-Cut Job ID:</span>
              <span style={{ fontFamily: 'monospace', color: activePackagingProject?.cmt_cut_job_id ? '#16A34A' : '#EF4444' }}>
                {activePackagingProject?.cmt_cut_job_id || 'NULL'}
              </span>
              <span style={{ fontWeight: 700 }}>CMT-Pak Job ID:</span>
              <span style={{ fontFamily: 'monospace', color: activePackagingProject?.cmt_pak_job_id ? '#16A34A' : '#EF4444' }}>
                {activePackagingProject?.cmt_pak_job_id || 'NULL'}
              </span>
              <span style={{ fontWeight: 700 }}>Base Lines (CMT-Cut):</span>
              <span style={{ fontFamily: 'monospace' }}>{(activePackagingProject?.base_lines || []).length} rows</span>
              <span style={{ fontWeight: 700 }}>Session report_lines:</span>
              <span style={{ fontFamily: 'monospace' }}>{(activeSession?.report_lines || []).length} rows</span>
              <span style={{ fontWeight: 700 }}>Active Session ID:</span>
              <span style={{ fontFamily: 'monospace', fontSize: '0.55rem' }}>{activeSession?.session_id || '—'}</span>
              <span style={{ fontWeight: 700 }}>Cycle Number:</span>
              <span style={{ fontFamily: 'monospace' }}>{activeSession?.cycle_number ?? '—'}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRefetchReportLines}
            style={{
              padding: '0.5rem 1.15rem',
              fontSize: '0.72rem',
              fontWeight: 800,
              borderRadius: '10px',
              background: 'var(--royal-blue)',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Re-fetch Size Data from D365
          </button>
        </div>
      );
    }

    const currentLineId = activeLineId || (activeSession.report_lines[0]?.report_id);
    const lineIndex = activeSession.report_lines.findIndex((l: any) => l.report_id === currentLineId);
    const activeLine = activeSession.report_lines[lineIndex] || activeSession.report_lines[0];
    const currentSize = activeLine?.size_val || 'N/A';

    if (!activeLine) {
      return (
        <div
          style={{
            padding: '1rem',
            border: '1px dashed rgba(37,99,235,0.15)',
            borderRadius: '8px',
            textAlign: 'center',
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
          }}
        >
          Select a size tab to view details.
        </div>
      );
    }

    // Look up cutting pcs from base lines (CMT-Cut)
    const baseLine = (activePackagingProject?.base_lines || []).find((l: any) => l.size_val === currentSize);
    const qtyCutting = baseLine ? baseLine.total_good_qty || 0 : 0;

    // Reject sub-groups calculations
    const rBahan = activeLine.reject_bahan || 0;
    const rCutting = activeLine.reject_cutting || 0;
    const rSewing = activeLine.reject_sewing || 0;
    const rFinishing = activeLine.reject_finishing || 0;
    const rPrinting = activeLine.reject_printing || 0;
    const rEmbro = activeLine.reject_embro || 0;
    const rWashing = activeLine.reject_washing || 0;
    const btjVal = activeLine.btj || 0;
    const bHilang = activeLine.barang_hilang || 0;

    const rejectProduksi = rCutting + rSewing + rFinishing + rPrinting + rEmbro + rWashing;
    
    // Cumulative rejects calculation across versions
    const otherSessionsRejectQty = (activePackagingProject?.sessions || [])
      .filter((s: any) => s.cycle_number <= activeSession.cycle_number && s.session_id !== activeSession.session_id)
      .reduce((sum: number, s: any) => {
        const line = (s.report_lines || []).find((l: any) => l.size_val === currentSize);
        if (!line) return sum;
        const rc = line.reject_cutting || 0;
        const rs = line.reject_sewing || 0;
        const rf = line.reject_finishing || 0;
        const rp = line.reject_printing || 0;
        const re = line.reject_embro || 0;
        const rw = line.reject_washing || 0;
        const rb = line.reject_bahan || 0;
        const bt = line.btj || 0;
        const bh = line.barang_hilang || 0;
        const rejProd = rc + rs + rf + rp + re + rw;
        return sum + (rb + rejProd + bt + bh);
      }, 0);
    const totalReject = otherSessionsRejectQty + (rBahan + rejectProduksi + btjVal + bHilang);
    
    // Cumulative good qty calculation across versions
    const otherSessionsGoodQty = (activePackagingProject?.sessions || [])
      .filter((s: any) => s.cycle_number <= activeSession.cycle_number && s.session_id !== activeSession.session_id)
      .reduce((sum: number, s: any) => {
        const line = (s.report_lines || []).find((l: any) => l.size_val === currentSize);
        return sum + (line?.session_qty || 0);
      }, 0);
    const totalGood = otherSessionsGoodQty + (activeLine.session_qty || 0);

    const updateLineField = (field: string, val: number | '') => {
      if (!isEdit) return;
      setActiveSession((prev: any) => {
        const nextLines = [...prev.report_lines];
        const updatedLine = { ...nextLines[lineIndex], [field]: val };

        // Compute calculated fields in the copy
        const rc = updatedLine.reject_cutting || 0;
        const rs = updatedLine.reject_sewing || 0;
        const rf = updatedLine.reject_finishing || 0;
        const rp = updatedLine.reject_printing || 0;
        const re = updatedLine.reject_embro || 0;
        const rw = updatedLine.reject_washing || 0;
        const rb = updatedLine.reject_bahan || 0;
        const bt = updatedLine.btj || 0;
        const bh = updatedLine.barang_hilang || 0;

        const newRejectProduksi = rc + rs + rf + rp + re + rw;
        
        // Cumulative reject calculation
        const otherReject = (activePackagingProject?.sessions || [])
          .filter((s: any) => s.cycle_number <= activeSession.cycle_number && s.session_id !== activeSession.session_id)
          .reduce((sum: number, s: any) => {
            const line = (s.report_lines || []).find((l: any) => l.size_val === currentSize);
            if (!line) return sum;
            const lrc = line.reject_cutting || 0;
            const lrs = line.reject_sewing || 0;
            const lrf = line.reject_finishing || 0;
            const lrp = line.reject_printing || 0;
            const lre = line.reject_embro || 0;
            const lrw = line.reject_washing || 0;
            const lrb = line.reject_bahan || 0;
            const lbt = line.btj || 0;
            const lbh = line.barang_hilang || 0;
            const rejProd = lrc + lrs + lrf + lrp + lre + lrw;
            return sum + (lrb + rejProd + lbt + lbh);
          }, 0);
        const currentReject = rb + newRejectProduksi + bt + bh;
        const newTotalReject = otherReject + currentReject;
        
        // Cumulative good qty calculation
        const otherGood = (activePackagingProject?.sessions || [])
          .filter((s: any) => s.cycle_number <= activeSession.cycle_number && s.session_id !== activeSession.session_id)
          .reduce((sum: number, s: any) => {
            const line = (s.report_lines || []).find((l: any) => l.size_val === currentSize);
            return sum + (line?.session_qty || 0);
          }, 0);
        const currentQty = updatedLine.session_qty || 0;
        const newTotalGood = otherGood + currentQty;

        updatedLine.reject_produksi = newRejectProduksi;
        updatedLine.total_reject_qty = newTotalReject;
        updatedLine.total_good_qty = newTotalGood;

        nextLines[lineIndex] = updatedLine;
        return { ...prev, report_lines: nextLines };
      });
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
        {/* Horizontal Size Tabs */}
        <div style={{ display: 'flex', gap: '0.45rem', borderBottom: '2px solid rgba(15, 23, 42, 0.12)', paddingBottom: '0.45rem', flexWrap: 'wrap' }}>
          {activeSession.report_lines.map((line: any) => {
            const size = line.size_val || 'N/A';
            const duplicates = activeSession.report_lines.filter((l: any) => l.size_val === size);
            let label = size;
            if (duplicates.length > 1) {
              const occurrenceIndex = duplicates.findIndex((l: any) => l.report_id === line.report_id) + 1;
              label = `${size} (#${occurrenceIndex})`;
            }
            const isTabSelected = currentLineId === line.report_id;
            return (
              <button
                key={line.report_id}
                type="button"
                onClick={() => {
                  setActiveLineId(line.report_id);
                  setSelectedSizeTab(size);
                }}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.72rem',
                  fontWeight: isTabSelected ? 800 : 600,
                  borderRadius: '6px',
                  border: isTabSelected ? 'none' : '2px solid rgba(15, 23, 42, 0.16)',
                  background: isTabSelected ? 'rgba(37,99,235,0.12)' : 'transparent',
                  color: isTabSelected ? 'var(--royal-blue)' : 'var(--deep-ocean)',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Section 1: Summary Metrics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          <div style={{ marginBottom: '0.25rem', display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--deep-ocean)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Summary Metrics
            </span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr 1.2fr',
              gap: '0.85rem',
              background: '#F8FAFC',
              padding: '1rem',
              borderRadius: '12px',
              border: '2px solid rgba(15, 23, 42, 0.16)',
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.01)',
            }}
          >
            <div>
              <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>QTY ORDER</label>
              <div
                style={{
                  padding: '0.35rem 0.5rem',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  background: '#E2E8F0',
                  border: '1px solid rgba(0,0,0,0.05)',
                  borderRadius: '6px',
                  color: 'var(--deep-ocean)',
                }}
              >
                {activeLine.qty_order || 0}
              </div>
            </div>
            <div>
              <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
                QTY CUTT (BASELINE)
              </label>
              <div
                style={{
                  padding: '0.35rem 0.5rem',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  background: '#E2E8F0',
                  border: '1px solid rgba(0,0,0,0.05)',
                  borderRadius: '6px',
                  color: 'var(--deep-ocean)',
                }}
              >
                {qtyCutting}
              </div>
            </div>
            <div>
              <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--royal-blue)', display: 'block', marginBottom: '0.15rem' }}>QTY VERSION</label>
              {isEdit ? (
                <input
                  type="number"
                  value={activeLine.session_qty === 0 ? '' : activeLine.session_qty ?? ''}
                  placeholder="0"
                  onFocus={(e) => e.target.select()}
                  onWheel={(e) => e.currentTarget.blur()}
                  onChange={(e) => {
                    const cleanVal = e.target.value.replace(/^0+(?=\d)/, '');
                    e.target.value = cleanVal;
                    const val = cleanVal === '' ? '' : parseFloat(cleanVal) || 0.0;
                    updateLineField('session_qty', val);
                  }}
                  className="qms-num-input"
                  style={{
                    width: '100%',
                    padding: '0.35rem 0.45rem',
                    fontSize: '0.74rem',
                    border: '2px solid rgba(15, 23, 42, 0.16)',
                    borderRadius: '6px',
                    outline: 'none',
                    background: '#FFFFFF',
                  }}
                />
              ) : (
                <div
                  style={{
                    padding: '0.35rem 0.5rem',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    background: '#F1F5F9',
                    border: '1px solid rgba(0,0,0,0.03)',
                    borderRadius: '6px',
                    color: 'var(--royal-blue)',
                  }}
                >
                  {activeLine.session_qty || 0}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              <div>
                <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
                  TOTAL QTY GOOD
                </label>
                <div
                  style={{
                    padding: '0.35rem 0.5rem',
                    fontSize: '0.74rem',
                    fontWeight: 900,
                    background: '#D1FAE5',
                    border: '2px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '6px',
                    color: '#10B981',
                  }}
                >
                  {totalGood}
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
                  TOTAL QTY REJECT
                </label>
                <div
                  style={{
                    padding: '0.35rem 0.5rem',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    background: '#FEE2E2',
                    border: '2px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '6px',
                    color: '#EF4444',
                  }}
                >
                  {totalReject}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Material & Miscellaneous Losses */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.45rem' }}>
          <div style={{ marginBottom: '0.25rem', display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--deep-ocean)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Material & Miscellaneous Losses
            </span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '0.85rem',
              background: '#F8FAFC',
              padding: '1rem',
              borderRadius: '12px',
              border: '2px solid rgba(15, 23, 42, 0.16)',
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.01)',
            }}
          >
            <div>
              <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>REJECT BAHAN</label>
              {isEdit ? (
                <input
                  type="number"
                  value={activeLine.reject_bahan === 0 ? '' : activeLine.reject_bahan ?? ''}
                  placeholder="0"
                  onFocus={(e) => e.target.select()}
                  onWheel={(e) => e.currentTarget.blur()}
                  onChange={(e) => {
                    const cleanVal = e.target.value.replace(/^0+(?=\d)/, '');
                    e.target.value = cleanVal;
                    updateLineField('reject_bahan', cleanVal === '' ? '' : parseInt(cleanVal, 10) || 0);
                  }}
                  className="qms-num-input"
                  style={{
                    width: '100%',
                    padding: '0.35rem 0.45rem',
                    fontSize: '0.74rem',
                    border: '2px solid rgba(15, 23, 42, 0.16)',
                    borderRadius: '6px',
                    outline: 'none',
                  }}
                />
              ) : (
                <div
                  style={{
                    padding: '0.35rem 0.5rem',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    background: '#F1F5F9',
                    border: '1px solid rgba(0,0,0,0.03)',
                    borderRadius: '6px',
                    color: 'var(--deep-ocean)',
                  }}
                >
                  {rBahan}
                </div>
              )}
            </div>
            <div>
              <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>BTJ</label>
              {isEdit ? (
                <input
                  type="number"
                  value={activeLine.btj === 0 ? '' : activeLine.btj ?? ''}
                  placeholder="0"
                  onFocus={(e) => e.target.select()}
                  onWheel={(e) => e.currentTarget.blur()}
                  onChange={(e) => {
                    const cleanVal = e.target.value.replace(/^0+(?=\d)/, '');
                    e.target.value = cleanVal;
                    updateLineField('btj', cleanVal === '' ? '' : parseInt(cleanVal, 10) || 0);
                  }}
                  className="qms-num-input"
                  style={{
                    width: '100%',
                    padding: '0.35rem 0.45rem',
                    fontSize: '0.74rem',
                    border: '2px solid rgba(15, 23, 42, 0.16)',
                    borderRadius: '6px',
                    outline: 'none',
                  }}
                />
              ) : (
                <div
                  style={{
                    padding: '0.35rem 0.5rem',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    background: '#F1F5F9',
                    border: '1px solid rgba(0,0,0,0.03)',
                    borderRadius: '6px',
                    color: 'var(--deep-ocean)',
                  }}
                >
                  {btjVal}
                </div>
              )}
            </div>
            <div>
              <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
                BARANG HILANG
              </label>
              {isEdit ? (
                <input
                  type="number"
                  value={activeLine.barang_hilang === 0 ? '' : activeLine.barang_hilang ?? ''}
                  placeholder="0"
                  onFocus={(e) => e.target.select()}
                  onWheel={(e) => e.currentTarget.blur()}
                  onChange={(e) => {
                    const cleanVal = e.target.value.replace(/^0+(?=\d)/, '');
                    e.target.value = cleanVal;
                    updateLineField('barang_hilang', cleanVal === '' ? '' : parseInt(cleanVal, 10) || 0);
                  }}
                  className="qms-num-input"
                  style={{
                    width: '100%',
                    padding: '0.35rem 0.45rem',
                    fontSize: '0.74rem',
                    border: '2px solid rgba(15, 23, 42, 0.16)',
                    borderRadius: '6px',
                    outline: 'none',
                  }}
                />
              ) : (
                <div
                  style={{
                    padding: '0.35rem 0.5rem',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    background: '#F1F5F9',
                    border: '1px solid rgba(0,0,0,0.03)',
                    borderRadius: '6px',
                    color: 'var(--deep-ocean)',
                  }}
                >
                  {bHilang}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Production Process Rejects */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.45rem' }}>
          <div style={{ marginBottom: '0.25rem', display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--deep-ocean)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Production Process Rejects
            </span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr 1fr',
              gap: '0.85rem',
              background: '#F8FAFC',
              padding: '1rem',
              borderRadius: '12px',
              border: '2px solid rgba(15, 23, 42, 0.16)',
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.01)',
            }}
          >
            <div>
              <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
                REJECT CUTTING
              </label>
              {isEdit ? (
                <input
                  type="number"
                  value={activeLine.reject_cutting === 0 ? '' : activeLine.reject_cutting ?? ''}
                  placeholder="0"
                  onFocus={(e) => e.target.select()}
                  onWheel={(e) => e.currentTarget.blur()}
                  onChange={(e) => {
                    const cleanVal = e.target.value.replace(/^0+(?=\d)/, '');
                    e.target.value = cleanVal;
                    updateLineField('reject_cutting', cleanVal === '' ? '' : parseInt(cleanVal, 10) || 0);
                  }}
                  className="qms-num-input"
                  style={{
                    width: '100%',
                    padding: '0.35rem 0.45rem',
                    fontSize: '0.74rem',
                    border: '2px solid rgba(15, 23, 42, 0.16)',
                    borderRadius: '6px',
                    outline: 'none',
                  }}
                />
              ) : (
                <div
                  style={{
                    padding: '0.35rem 0.5rem',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    background: '#F1F5F9',
                    border: '1px solid rgba(0,0,0,0.03)',
                    borderRadius: '6px',
                    color: 'var(--deep-ocean)',
                  }}
                >
                  {rCutting}
                </div>
              )}
            </div>
            <div>
              <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>REJECT SEWING</label>
              {isEdit ? (
                <input
                  type="number"
                  value={activeLine.reject_sewing === 0 ? '' : activeLine.reject_sewing ?? ''}
                  placeholder="0"
                  onFocus={(e) => e.target.select()}
                  onWheel={(e) => e.currentTarget.blur()}
                  onChange={(e) => {
                    const cleanVal = e.target.value.replace(/^0+(?=\d)/, '');
                    e.target.value = cleanVal;
                    updateLineField('reject_sewing', cleanVal === '' ? '' : parseInt(cleanVal, 10) || 0);
                  }}
                  className="qms-num-input"
                  style={{
                    width: '100%',
                    padding: '0.35rem 0.45rem',
                    fontSize: '0.74rem',
                    border: '2px solid rgba(15, 23, 42, 0.16)',
                    borderRadius: '6px',
                    outline: 'none',
                  }}
                />
              ) : (
                <div
                  style={{
                    padding: '0.35rem 0.5rem',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    background: '#F1F5F9',
                    border: '1px solid rgba(0,0,0,0.03)',
                    borderRadius: '6px',
                    color: 'var(--deep-ocean)',
                  }}
                >
                  {rSewing}
                </div>
              )}
            </div>
            <div>
              <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
                REJECT FINISHING
              </label>
              {isEdit ? (
                <input
                  type="number"
                  value={activeLine.reject_finishing === 0 ? '' : activeLine.reject_finishing ?? ''}
                  placeholder="0"
                  onFocus={(e) => e.target.select()}
                  onWheel={(e) => e.currentTarget.blur()}
                  onChange={(e) => {
                    const cleanVal = e.target.value.replace(/^0+(?=\d)/, '');
                    e.target.value = cleanVal;
                    updateLineField('reject_finishing', cleanVal === '' ? '' : parseInt(cleanVal, 10) || 0);
                  }}
                  className="qms-num-input"
                  style={{
                    width: '100%',
                    padding: '0.35rem 0.45rem',
                    fontSize: '0.74rem',
                    border: '2px solid rgba(15, 23, 42, 0.16)',
                    borderRadius: '6px',
                    outline: 'none',
                  }}
                />
              ) : (
                <div
                  style={{
                    padding: '0.35rem 0.5rem',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    background: '#F1F5F9',
                    border: '1px solid rgba(0,0,0,0.03)',
                    borderRadius: '6px',
                    color: 'var(--deep-ocean)',
                  }}
                >
                  {rFinishing}
                </div>
              )}
            </div>
            <div>
              <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>REJECT WASHING</label>
              {isEdit ? (
                <input
                  type="number"
                  value={activeLine.reject_washing === 0 ? '' : activeLine.reject_washing ?? ''}
                  placeholder="0"
                  onFocus={(e) => e.target.select()}
                  onWheel={(e) => e.currentTarget.blur()}
                  onChange={(e) => {
                    const cleanVal = e.target.value.replace(/^0+(?=\d)/, '');
                    e.target.value = cleanVal;
                    updateLineField('reject_washing', cleanVal === '' ? '' : parseInt(cleanVal, 10) || 0);
                  }}
                  className="qms-num-input"
                  style={{
                    width: '100%',
                    padding: '0.35rem 0.45rem',
                    fontSize: '0.74rem',
                    border: '2px solid rgba(15, 23, 42, 0.16)',
                    borderRadius: '6px',
                    outline: 'none',
                  }}
                />
              ) : (
                <div
                  style={{
                    padding: '0.35rem 0.5rem',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    background: '#F1F5F9',
                    border: '1px solid rgba(0,0,0,0.03)',
                    borderRadius: '6px',
                    color: 'var(--deep-ocean)',
                  }}
                >
                  {rWashing}
                </div>
              )}
            </div>
            <div>
              <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>REJECT PRINTING</label>
              {isEdit ? (
                <input
                  type="number"
                  value={activeLine.reject_printing === 0 ? '' : activeLine.reject_printing ?? ''}
                  placeholder="0"
                  onFocus={(e) => e.target.select()}
                  onWheel={(e) => e.currentTarget.blur()}
                  onChange={(e) => {
                    const cleanVal = e.target.value.replace(/^0+(?=\d)/, '');
                    e.target.value = cleanVal;
                    updateLineField('reject_printing', cleanVal === '' ? '' : parseInt(cleanVal, 10) || 0);
                  }}
                  className="qms-num-input"
                  style={{
                    width: '100%',
                    padding: '0.35rem 0.45rem',
                    fontSize: '0.74rem',
                    border: '2px solid rgba(15, 23, 42, 0.16)',
                    borderRadius: '6px',
                    outline: 'none',
                  }}
                />
              ) : (
                <div
                  style={{
                    padding: '0.35rem 0.5rem',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    background: '#F1F5F9',
                    border: '1px solid rgba(0,0,0,0.03)',
                    borderRadius: '6px',
                    color: 'var(--deep-ocean)',
                  }}
                >
                  {rPrinting}
                </div>
              )}
            </div>
            <div>
              <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>REJECT EMBRO</label>
              {isEdit ? (
                <input
                  type="number"
                  value={activeLine.reject_embro === 0 ? '' : activeLine.reject_embro ?? ''}
                  placeholder="0"
                  onFocus={(e) => e.target.select()}
                  onWheel={(e) => e.currentTarget.blur()}
                  onChange={(e) => {
                    const cleanVal = e.target.value.replace(/^0+(?=\d)/, '');
                    e.target.value = cleanVal;
                    updateLineField('reject_embro', cleanVal === '' ? '' : parseInt(cleanVal, 10) || 0);
                  }}
                  className="qms-num-input"
                  style={{
                    width: '100%',
                    padding: '0.35rem 0.45rem',
                    fontSize: '0.74rem',
                    border: '2px solid rgba(15, 23, 42, 0.16)',
                    borderRadius: '6px',
                    outline: 'none',
                  }}
                />
              ) : (
                <div
                  style={{
                    padding: '0.35rem 0.5rem',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    background: '#F1F5F9',
                    border: '1px solid rgba(0,0,0,0.03)',
                    borderRadius: '6px',
                    color: 'var(--deep-ocean)',
                  }}
                >
                  {rEmbro}
                </div>
              )}
            </div>
            <div>
              <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
                REJECT PRODUKSI
              </label>
              <div
                style={{
                  padding: '0.35rem 0.5rem',
                  fontSize: '0.74rem',
                  fontWeight: 900,
                  background: '#F1F5F9',
                  border: '2px solid rgba(15, 23, 42, 0.16)',
                  borderRadius: '6px',
                  color: 'var(--deep-ocean)',
                }}
              >
                {rejectProduksi}
              </div>
            </div>
            <div style={{ visibility: 'hidden' }}>
              {/* Spacer slot to fill 4-column row */}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (sessionEditMode) {
    return (
      <>
        {/* CARD 1: Inspection Details (Top) */}
        <div className="bento-card" style={cardStyle}>
          <h4
            style={{
              fontSize: '0.76rem',
              fontWeight: 900,
              color: 'var(--royal-blue)',
              textTransform: 'uppercase',
              marginBottom: '0.5rem',
              borderBottom: '1px solid rgba(37,99,235,0.06)',
              paddingBottom: '0.35rem',
            }}
          >
            1. Inspection Details
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.65rem' }}>
            <div>
              <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
                INSPECTION DATE
              </label>
              <input
                type="date"
                value={activeSession.inspection_date || ''}
                onChange={(e) => setActiveSession((prev: any) => ({ ...prev, inspection_date: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '0.35rem 0.45rem',
                  fontSize: '0.74rem',
                  border: '2px solid rgba(15, 23, 42, 0.16)',
                  borderRadius: '8px',
                  outline: 'none',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
                INSPECTED BY
              </label>
              <input
                type="text"
                placeholder="Inspector name..."
                value={activeSession.inspector || ''}
                onChange={(e) => setActiveSession((prev: any) => ({ ...prev, inspector: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '0.35rem 0.45rem',
                  fontSize: '0.74rem',
                  border: '2px solid rgba(15, 23, 42, 0.16)',
                  borderRadius: '8px',
                  outline: 'none',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
                CONFIRMED BY
              </label>
              <input
                type="text"
                placeholder="Rep name..."
                value={activeSession.factory_representative || ''}
                onChange={(e) => setActiveSession((prev: any) => ({ ...prev, factory_representative: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '0.35rem 0.45rem',
                  fontSize: '0.74rem',
                  border: '2px solid rgba(15, 23, 42, 0.16)',
                  borderRadius: '8px',
                  outline: 'none',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
                QTY AVAILABLE
              </label>
              <input
                type="number"
                value={activeSession.qty_available === 0 ? '' : activeSession.qty_available ?? ''}
                placeholder="0"
                onFocus={(e) => e.target.select()}
                onWheel={(e) => e.currentTarget.blur()}
                onChange={(e) => {
                  const cleanVal = e.target.value.replace(/^0+(?=\d)/, '');
                  e.target.value = cleanVal;
                  setActiveSession((prev: any) => ({ ...prev, qty_available: cleanVal === '' ? '' : parseInt(cleanVal, 10) || 0 }));
                }}
                className="qms-num-input"
                style={{
                  width: '100%',
                  padding: '0.35rem 0.45rem',
                  fontSize: '0.74rem',
                  border: '2px solid rgba(15, 23, 42, 0.16)',
                  borderRadius: '8px',
                  outline: 'none',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>TOTAL STORE</label>
              <input
                type="number"
                value={activeSession.total_store === 0 ? '' : activeSession.total_store ?? ''}
                placeholder="0"
                onFocus={(e) => e.target.select()}
                onWheel={(e) => e.currentTarget.blur()}
                onChange={(e) => {
                  const cleanVal = e.target.value.replace(/^0+(?=\d)/, '');
                  e.target.value = cleanVal;
                  setActiveSession((prev: any) => ({ ...prev, total_store: cleanVal === '' ? '' : parseInt(cleanVal, 10) || 0 }));
                }}
                className="qms-num-input"
                style={{
                  width: '100%',
                  padding: '0.35rem 0.45rem',
                  fontSize: '0.74rem',
                  border: '2px solid rgba(15, 23, 42, 0.16)',
                  borderRadius: '8px',
                  outline: 'none',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
                STORE INSPECTED
              </label>
              <input
                type="number"
                value={activeSession.store_inspected === 0 ? '' : activeSession.store_inspected ?? ''}
                placeholder="0"
                onFocus={(e) => e.target.select()}
                onWheel={(e) => e.currentTarget.blur()}
                onChange={(e) => {
                  const cleanVal = e.target.value.replace(/^0+(?=\d)/, '');
                  e.target.value = cleanVal;
                  setActiveSession((prev: any) => ({ ...prev, store_inspected: cleanVal === '' ? '' : parseInt(cleanVal, 10) || 0 }));
                }}
                className="qms-num-input"
                style={{
                  width: '100%',
                  padding: '0.35rem 0.45rem',
                  fontSize: '0.74rem',
                  border: '2px solid rgba(15, 23, 42, 0.16)',
                  borderRadius: '8px',
                  outline: 'none',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>AQL VALUE</label>
              <input
                type="number"
                step="0.1"
                value={activeSession.aql === 0 ? '' : activeSession.aql ?? ''}
                placeholder="0"
                onFocus={(e) => e.target.select()}
                onWheel={(e) => e.currentTarget.blur()}
                onChange={(e) => {
                  const cleanVal = e.target.value.replace(/^0+(?=\d)/, '');
                  e.target.value = cleanVal;
                  setActiveSession((prev: any) => ({ ...prev, aql: cleanVal === '' ? '' : parseFloat(cleanVal) || 0.0 }));
                }}
                className="qms-num-input"
                style={{
                  width: '100%',
                  padding: '0.35rem 0.45rem',
                  fontSize: '0.74rem',
                  border: '2px solid rgba(15, 23, 42, 0.16)',
                  borderRadius: '8px',
                  outline: 'none',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>LEVEL VALUE</label>
              <input
                type="number"
                step="0.1"
                value={activeSession.level_val === 0 ? '' : activeSession.level_val ?? ''}
                placeholder="0"
                onFocus={(e) => e.target.select()}
                onWheel={(e) => e.currentTarget.blur()}
                onChange={(e) => {
                  const cleanVal = e.target.value.replace(/^0+(?=\d)/, '');
                  e.target.value = cleanVal;
                  setActiveSession((prev: any) => ({ ...prev, level_val: cleanVal === '' ? '' : parseFloat(cleanVal) || 0.0 }));
                }}
                className="qms-num-input"
                style={{
                  width: '100%',
                  padding: '0.35rem 0.45rem',
                  fontSize: '0.74rem',
                  border: '2px solid rgba(15, 23, 42, 0.16)',
                  borderRadius: '8px',
                  outline: 'none',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
                SAMPLING PCS
              </label>
              <input
                type="number"
                value={activeSession.sampling_pcs === 0 ? '' : activeSession.sampling_pcs ?? ''}
                placeholder="0"
                onFocus={(e) => e.target.select()}
                onWheel={(e) => e.currentTarget.blur()}
                onChange={(e) => {
                  const cleanVal = e.target.value.replace(/^0+(?=\d)/, '');
                  e.target.value = cleanVal;
                  setActiveSession((prev: any) => ({ ...prev, sampling_pcs: cleanVal === '' ? '' : parseInt(cleanVal, 10) || 0 }));
                }}
                className="qms-num-input"
                style={{
                  width: '100%',
                  padding: '0.35rem 0.45rem',
                  fontSize: '0.74rem',
                  border: '2px solid rgba(15, 23, 42, 0.16)',
                  borderRadius: '8px',
                  outline: 'none',
                }}
              />
            </div>
          </div>
        </div>

        {/* CARD 2: Checklist (Middle) */}
        <div className="bento-card" style={cardStyle}>
          <h4
            style={{
              fontSize: '0.76rem',
              fontWeight: 900,
              color: 'var(--royal-blue)',
              textTransform: 'uppercase',
              marginBottom: '0.5rem',
              borderBottom: '1px solid rgba(37,99,235,0.06)',
              paddingBottom: '0.35rem',
            }}
          >
            2. Garment Checklist
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
            {[
              { field: 'check_wash', label: 'Wash' },
              { field: 'check_style_as_sample', label: 'Style as Sample' },
              { field: 'check_main_label', label: 'Main Label' },
              { field: 'check_flag_fit_label', label: 'Flag/Fit Label' },
              { field: 'check_print_embro_artwork', label: 'Print/Embro' },
              { field: 'check_hangtag', label: 'Hangtag' },
              { field: 'check_waist_tag', label: 'Waist Tag' },
              { field: 'check_barcode', label: 'Barcode' },
              { field: 'check_packing_list', label: 'Packing List' },
              { field: 'check_shipping_mark', label: 'Shipping Mark' },
            ].map((chk) => {
              const checked = activeSession[chk.field];
              return (
                <div
                  key={chk.field}
                  onClick={() => setActiveSession((prev: any) => ({ ...prev, [chk.field]: !checked }))}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.45rem 0.65rem',
                    borderRadius: '8px',
                    background: checked ? 'rgba(37,99,235,0.05)' : '#F8FAFC',
                    border: checked ? '2px solid var(--royal-blue)' : '2px solid rgba(15, 23, 42, 0.12)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    fontSize: '0.72rem',
                    fontWeight: checked ? 800 : 500,
                    color: checked ? 'var(--royal-blue)' : 'var(--deep-ocean)',
                  }}
                >
                  <span style={{ fontSize: '0.9rem', color: checked ? 'var(--royal-blue)' : 'var(--text-muted)' }}>{checked ? '☑' : '☐'}</span>
                  {chk.label}
                </div>
              );
            })}
            {[
              { field: 'check_other_1', labelField: 'check_other_1_label', placeholder: 'Other 1 (e.g. Lining)' },
              { field: 'check_other_2', labelField: 'check_other_2_label', placeholder: 'Other 2 (e.g. Button)' },
            ].map((chk) => {
              const checked = activeSession[chk.field];
              const labelText = activeSession[chk.labelField] || '';
              return (
                <div
                  key={chk.field}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.45rem 0.65rem',
                    borderRadius: '8px',
                    background: checked ? 'rgba(37,99,235,0.05)' : '#F8FAFC',
                    border: checked ? '2px solid var(--royal-blue)' : '2px solid rgba(15, 23, 42, 0.12)',
                    transition: 'all 0.15s ease',
                    fontSize: '0.72rem',
                    fontWeight: checked ? 800 : 500,
                    color: checked ? 'var(--royal-blue)' : 'var(--deep-ocean)',
                  }}
                >
                  <span
                    onClick={() => setActiveSession((prev: any) => ({ ...prev, [chk.field]: !checked }))}
                    style={{ fontSize: '0.9rem', color: checked ? 'var(--royal-blue)' : 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}
                  >
                    {checked ? '☑' : '☐'}
                  </span>
                  <input
                    type="text"
                    value={labelText}
                    onChange={(e) => setActiveSession((prev: any) => ({ ...prev, [chk.labelField]: e.target.value }))}
                    placeholder={chk.placeholder}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      outline: 'none',
                      fontSize: '0.72rem',
                      fontWeight: checked ? 800 : 500,
                      color: checked ? 'var(--royal-blue)' : 'var(--deep-ocean)',
                      width: '100%',
                      padding: 0,
                      margin: 0
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* CARD 3: Production Status (Bottom) */}
        <div className="bento-card" style={cardStyle}>
          <h4
            style={{
              fontSize: '0.76rem',
              fontWeight: 900,
              color: 'var(--royal-blue)',
              textTransform: 'uppercase',
              marginBottom: '0.5rem',
              borderBottom: '1px solid rgba(37,99,235,0.06)',
              paddingBottom: '0.35rem',
            }}
          >
            3. Production Status
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.5rem' }}>
            <div>
              <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
                CUTTING PCS
              </label>
              <input
                type="number"
                value={activeSession.cutting_pcs ?? ''}
                placeholder="0"
                onFocus={(e) => e.target.select()}
                onWheel={(e) => e.currentTarget.blur()}
                onChange={(e) => setActiveSession((prev: any) => ({ ...prev, cutting_pcs: e.target.value === '' ? '' : parseInt(e.target.value) || 0 }))}
                className="qms-num-input"
                style={{ width: '100%', padding: '0.35rem 0.45rem', fontSize: '0.74rem', border: '2px solid rgba(15, 23, 42, 0.16)', borderRadius: '8px', outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
                SEWING PCS
              </label>
              <input
                type="number"
                value={activeSession.sewing_pcs ?? ''}
                placeholder="0"
                onFocus={(e) => e.target.select()}
                onWheel={(e) => e.currentTarget.blur()}
                onChange={(e) => setActiveSession((prev: any) => ({ ...prev, sewing_pcs: e.target.value === '' ? '' : parseInt(e.target.value) || 0 }))}
                className="qms-num-input"
                style={{ width: '100%', padding: '0.35rem 0.45rem', fontSize: '0.74rem', border: '2px solid rgba(15, 23, 42, 0.16)', borderRadius: '8px', outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
                FINISHING PCS
              </label>
              <input
                type="number"
                value={activeSession.finishing_pcs ?? ''}
                placeholder="0"
                onFocus={(e) => e.target.select()}
                onWheel={(e) => e.currentTarget.blur()}
                onChange={(e) => setActiveSession((prev: any) => ({ ...prev, finishing_pcs: e.target.value === '' ? '' : parseInt(e.target.value) || 0 }))}
                className="qms-num-input"
                style={{ width: '100%', padding: '0.35rem 0.45rem', fontSize: '0.74rem', border: '2px solid rgba(15, 23, 42, 0.16)', borderRadius: '8px', outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
                PACKING PCS
              </label>
              <input
                type="number"
                value={activeSession.packing_pcs ?? ''}
                placeholder="0"
                onFocus={(e) => e.target.select()}
                onWheel={(e) => e.currentTarget.blur()}
                onChange={(e) => setActiveSession((prev: any) => ({ ...prev, packing_pcs: e.target.value === '' ? '' : parseInt(e.target.value) || 0 }))}
                className="qms-num-input"
                style={{ width: '100%', padding: '0.35rem 0.45rem', fontSize: '0.74rem', border: '2px solid rgba(15, 23, 42, 0.16)', borderRadius: '8px', outline: 'none' }}
              />
            </div>
          </div>
        </div>

        {/* CARD 4: CMT-Pak Details Grid per Size */}
        <div className="bento-card" style={cardStyle}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.5rem',
              borderBottom: '1px solid rgba(37,99,235,0.06)',
              paddingBottom: '0.35rem',
            }}
          >
            <h4
              style={{
                fontSize: '0.76rem',
                fontWeight: 900,
                color: 'var(--royal-blue)',
                textTransform: 'uppercase',
                margin: 0,
              }}
            >
              4. Production Details Report
            </h4>
            <button
              type="button"
              onClick={handleRefetchReportLines}
              title="Refresh baseline cutting quantities from Dynamics 365"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                border: 'none',
                background: 'rgba(37, 99, 235, 0.08)',
                color: 'var(--royal-blue)',
                padding: '0.25rem 0.55rem',
                borderRadius: '6px',
                fontSize: '0.62rem',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'background 0.2s ease',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(37, 99, 235, 0.16)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(37, 99, 235, 0.08)'}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle' }}>
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              Sync D365
            </button>
          </div>
          {renderSizeDetailsGrid(true)}
        </div>
      </>
    );
  }

  // Read-only Mode
  return (
    <>
      {/* CARD 1: Inspection Details (Top) */}
      <div className="bento-card" style={cardStyle}>
        <h4
          style={{
            fontSize: '0.76rem',
            fontWeight: 900,
            color: 'var(--royal-blue)',
            textTransform: 'uppercase',
            marginBottom: '0.5rem',
            borderBottom: '1px solid rgba(37,99,235,0.06)',
            paddingBottom: '0.35rem',
          }}
        >
          1. Inspection Details
        </h4>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '0.65rem',
            background: '#F8FAFC',
            padding: '0.85rem',
            borderRadius: '12px',
            border: '2px solid rgba(15, 23, 42, 0.12)',
          }}
        >
          <div>
            <span style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>INSPECTION DATE</span>
            <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--deep-ocean)' }}>{activeSession.inspection_date || 'N/A'}</div>
          </div>
          <div>
            <span style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>INSPECTED BY</span>
            <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--deep-ocean)' }}>{activeSession.inspector || 'N/A'}</div>
          </div>
          <div>
            <span style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
              CONFIRMED BY
            </span>
            <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--deep-ocean)' }}>{activeSession.factory_representative || 'N/A'}</div>
          </div>
          <div>
            <span style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>QTY AVAILABLE</span>
            <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--deep-ocean)' }}>{activeSession.qty_available}</div>
          </div>
          <div>
            <span style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>TOTAL STORE</span>
            <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--deep-ocean)' }}>{activeSession.total_store}</div>
          </div>
          <div>
            <span style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>STORE INSPECTED</span>
            <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--deep-ocean)' }}>{activeSession.store_inspected}</div>
          </div>
          <div>
            <span style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>AQL VALUE</span>
            <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--deep-ocean)' }}>{activeSession.aql}</div>
          </div>
          <div>
            <span style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>LEVEL VALUE</span>
            <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--deep-ocean)' }}>{activeSession.level_val}</div>
          </div>
          <div>
            <span style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>SAMPLING PCS</span>
            <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--deep-ocean)' }}>{activeSession.sampling_pcs}</div>
          </div>
        </div>
      </div>

      {/* CARD 2: Checklist (Middle) */}
      <div className="bento-card" style={cardStyle}>
        <h4
          style={{
            fontSize: '0.76rem',
            fontWeight: 900,
            color: 'var(--royal-blue)',
            textTransform: 'uppercase',
            marginBottom: '0.5rem',
            borderBottom: '1px solid rgba(37,99,235,0.06)',
            paddingBottom: '0.35rem',
          }}
        >
          2. Garment Checklist
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
          {[
            { field: 'check_wash', label: 'Wash' },
            { field: 'check_style_as_sample', label: 'Style as Sample' },
            { field: 'check_main_label', label: 'Main Label' },
            { field: 'check_flag_fit_label', label: 'Flag/Fit Label' },
            { field: 'check_print_embro_artwork', label: 'Print/Embro' },
            { field: 'check_hangtag', label: 'Hangtag' },
            { field: 'check_waist_tag', label: 'Waist Tag' },
            { field: 'check_barcode', label: 'Barcode' },
            { field: 'check_packing_list', label: 'Packing List' },
            { field: 'check_shipping_mark', label: 'Shipping Mark' },
            ...(activeSession.check_other_1_label?.trim() ? [{ field: 'check_other_1', label: activeSession.check_other_1_label.trim() }] : []),
            ...(activeSession.check_other_2_label?.trim() ? [{ field: 'check_other_2', label: activeSession.check_other_2_label.trim() }] : []),
          ].map((chk) => {
            const checked = activeSession[chk.field];
            return (
              <div
                key={chk.field}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.45rem 0.65rem',
                  borderRadius: '8px',
                  background: checked ? 'rgba(16,185,129,0.04)' : '#F8FAFC',
                  border: checked ? '2px solid rgba(16, 185, 129, 0.3)' : '2px solid rgba(15, 23, 42, 0.1)',
                  fontSize: '0.72rem',
                  fontWeight: checked ? 800 : 500,
                  color: checked ? '#10B981' : 'var(--text-muted)',
                }}
              >
                <span style={{ fontSize: '0.9rem', color: checked ? '#10B981' : 'var(--text-muted)' }}>{checked ? '✓' : '☐'}</span>
                {chk.label}
              </div>
            );
          })}
        </div>
      </div>

      {/* CARD 3: Production Status (Bottom) */}
      <div className="bento-card" style={cardStyle}>
        <h4
          style={{
            fontSize: '0.76rem',
            fontWeight: 900,
            color: 'var(--royal-blue)',
            textTransform: 'uppercase',
            marginBottom: '0.5rem',
            borderBottom: '1px solid rgba(37,99,235,0.06)',
            paddingBottom: '0.35rem',
          }}
        >
          3. Production Status
        </h4>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr 1fr',
            gap: '0.5rem',
            background: '#F8FAFC',
            padding: '0.85rem',
            borderRadius: '12px',
            border: '2px solid rgba(15, 23, 42, 0.12)',
          }}
        >
          <div>
            <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>CUTTING PCS</span>
            <strong style={{ fontSize: '0.76rem', color: 'var(--deep-ocean)' }}>{activeSession.cutting_pcs}</strong>
          </div>
          <div>
            <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>SEWING PCS</span>
            <strong style={{ fontSize: '0.76rem', color: 'var(--deep-ocean)' }}>{activeSession.sewing_pcs}</strong>
          </div>
          <div>
            <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>FINISHING PCS</span>
            <strong style={{ fontSize: '0.76rem', color: 'var(--deep-ocean)' }}>{activeSession.finishing_pcs}</strong>
          </div>
          <div>
            <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>PACKING PCS</span>
            <strong style={{ fontSize: '0.76rem', color: 'var(--deep-ocean)' }}>{activeSession.packing_pcs}</strong>
          </div>
        </div>
      </div>

      {/* CARD 4: CMT-Pak Details Grid per Size */}
      <div className="bento-card" style={cardStyle}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.5rem',
            borderBottom: '1px solid rgba(37,99,235,0.06)',
            paddingBottom: '0.35rem',
          }}
        >
          <h4
            style={{
              fontSize: '0.76rem',
              fontWeight: 900,
              color: 'var(--royal-blue)',
              textTransform: 'uppercase',
              margin: 0,
            }}
          >
            4. Production Details Report
          </h4>
          <button
            type="button"
            onClick={handleRefetchReportLines}
            title="Refresh baseline cutting quantities from Dynamics 365"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              border: 'none',
              background: 'rgba(37, 99, 235, 0.08)',
              color: 'var(--royal-blue)',
              padding: '0.25rem 0.55rem',
              borderRadius: '6px',
              fontSize: '0.62rem',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'background 0.2s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(37, 99, 235, 0.16)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(37, 99, 235, 0.08)'}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle' }}>
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            Sync D365
          </button>
        </div>
        {renderSizeDetailsGrid(false)}
      </div>
    </>
  );
};
