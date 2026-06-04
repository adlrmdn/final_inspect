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
  const cardStyle: React.CSSProperties = {
    padding: '1.25rem',
    background: 'rgba(255, 255, 255, 0.98)',
    backdropFilter: 'blur(20px)',
    border: '1.5px solid rgba(37, 99, 235, 0.12)',
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
            border: '1.5px dashed rgba(37,99,235,0.15)',
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
              background: 'rgba(37,99,235,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1rem',
            }}
          >
            📦
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
              border: '1px solid rgba(37,99,235,0.06)',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '0.65rem', color: 'var(--deep-ocean)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
              🔍 Data Diagnostic
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

    const sizes = activeSession.report_lines.map((line: any) => line.size_val).filter(Boolean);
    const currentSize = selectedSizeTab || sizes[0];
    const lineIndex = activeSession.report_lines.findIndex((l: any) => l.size_val === currentSize);
    const activeLine = activeSession.report_lines[lineIndex];

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
    const totalReject = rBahan + rejectProduksi + btjVal + bHilang;
    const totalGood = (activeLine.session_qty || 0) - totalReject;

    const updateLineField = (field: string, val: number) => {
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
        const newTotalReject = rb + newRejectProduksi + bt + bh;
        const newTotalGood = (updatedLine.session_qty || 0) - newTotalReject;

        updatedLine.reject_produksi = newRejectProduksi;
        updatedLine.total_reject_qty = newTotalReject;
        updatedLine.total_good_qty = newTotalGood;

        nextLines[lineIndex] = updatedLine;
        return { ...prev, report_lines: nextLines };
      });
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', textAlign: 'left' }}>
        {/* Horizontal Size Tabs */}
        <div style={{ display: 'flex', gap: '0.45rem', borderBottom: '1px solid rgba(37,99,235,0.08)', paddingBottom: '0.45rem', flexWrap: 'wrap' }}>
          {sizes.map((s: string) => {
            const isTabSelected = currentSize === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSelectedSizeTab(s)}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.72rem',
                  fontWeight: isTabSelected ? 800 : 600,
                  borderRadius: '6px',
                  border: isTabSelected ? 'none' : '1px solid rgba(37,99,235,0.12)',
                  background: isTabSelected ? 'rgba(37,99,235,0.12)' : 'transparent',
                  color: isTabSelected ? 'var(--royal-blue)' : 'var(--deep-ocean)',
                  cursor: 'pointer',
                }}
              >
                {s}
              </button>
            );
          })}
        </div>

        {/* 3-Column Fields Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '0.85rem',
            background: '#F8FAFC',
            padding: '1rem',
            borderRadius: '12px',
            border: '1px solid rgba(37,99,235,0.05)',
          }}
        >
          {/* Row 1 */}
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
            <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--royal-blue)', display: 'block', marginBottom: '0.15rem' }}>VERSION QTY</label>
            {isEdit ? (
              <input
                type="number"
                value={activeLine.session_qty || 0}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0.0;
                  setActiveSession((prev: any) => {
                    const nextLines = [...prev.report_lines];
                    const updatedLine = { ...nextLines[lineIndex], session_qty: val };
                    const totRej = updatedLine.total_reject_qty || 0;
                    updatedLine.total_good_qty = val - totRej;
                    nextLines[lineIndex] = updatedLine;
                    return { ...prev, report_lines: nextLines };
                  });
                }}
                style={{
                  width: '100%',
                  padding: '0.35rem 0.45rem',
                  fontSize: '0.74rem',
                  border: '1.5px solid rgba(37,99,235,0.15)',
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

          {/* Row 2 */}
          <div>
            <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>REJECT BAHAN</label>
            {isEdit ? (
              <input
                type="number"
                value={rBahan}
                onChange={(e) => updateLineField('reject_bahan', parseInt(e.target.value) || 0)}
                style={{
                  width: '100%',
                  padding: '0.35rem 0.45rem',
                  fontSize: '0.74rem',
                  border: '1.5px solid rgba(37,99,235,0.15)',
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
            <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
              REJECT CUTTING
            </label>
            {isEdit ? (
              <input
                type="number"
                value={rCutting}
                onChange={(e) => updateLineField('reject_cutting', parseInt(e.target.value) || 0)}
                style={{
                  width: '100%',
                  padding: '0.35rem 0.45rem',
                  fontSize: '0.74rem',
                  border: '1.5px solid rgba(37,99,235,0.15)',
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
                value={rSewing}
                onChange={(e) => updateLineField('reject_sewing', parseInt(e.target.value) || 0)}
                style={{
                  width: '100%',
                  padding: '0.35rem 0.45rem',
                  fontSize: '0.74rem',
                  border: '1.5px solid rgba(37,99,235,0.15)',
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

          {/* Row 3 */}
          <div>
            <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
              REJECT FINISHING
            </label>
            {isEdit ? (
              <input
                type="number"
                value={rFinishing}
                onChange={(e) => updateLineField('reject_finishing', parseInt(e.target.value) || 0)}
                style={{
                  width: '100%',
                  padding: '0.35rem 0.45rem',
                  fontSize: '0.74rem',
                  border: '1.5px solid rgba(37,99,235,0.15)',
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
            <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>REJECT PRINTING</label>
            {isEdit ? (
              <input
                type="number"
                value={rPrinting}
                onChange={(e) => updateLineField('reject_printing', parseInt(e.target.value) || 0)}
                style={{
                  width: '100%',
                  padding: '0.35rem 0.45rem',
                  fontSize: '0.74rem',
                  border: '1.5px solid rgba(37,99,235,0.15)',
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
                value={rEmbro}
                onChange={(e) => updateLineField('reject_embro', parseInt(e.target.value) || 0)}
                style={{
                  width: '100%',
                  padding: '0.35rem 0.45rem',
                  fontSize: '0.74rem',
                  border: '1.5px solid rgba(37,99,235,0.15)',
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

          {/* Row 4 */}
          <div>
            <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>REJECT WASHING</label>
            {isEdit ? (
              <input
                type="number"
                value={rWashing}
                onChange={(e) => updateLineField('reject_washing', parseInt(e.target.value) || 0)}
                style={{
                  width: '100%',
                  padding: '0.35rem 0.45rem',
                  fontSize: '0.74rem',
                  border: '1.5px solid rgba(37,99,235,0.15)',
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
            <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
              REJECT PRODUKSI
            </label>
            <div
              style={{
                padding: '0.35rem 0.5rem',
                fontSize: '0.74rem',
                fontWeight: 800,
                background: '#E2E8F0',
                border: '1px solid rgba(0,0,0,0.05)',
                borderRadius: '6px',
                color: 'var(--deep-ocean)',
              }}
            >
              {rejectProduksi}
            </div>
          </div>
          <div>
            <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>BTJ</label>
            {isEdit ? (
              <input
                type="number"
                value={btjVal}
                onChange={(e) => updateLineField('btj', parseInt(e.target.value) || 0)}
                style={{
                  width: '100%',
                  padding: '0.35rem 0.45rem',
                  fontSize: '0.74rem',
                  border: '1.5px solid rgba(37,99,235,0.15)',
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

          {/* Row 5 */}
          <div>
            <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
              BARANG HILANG
            </label>
            {isEdit ? (
              <input
                type="number"
                value={bHilang}
                onChange={(e) => updateLineField('barang_hilang', parseInt(e.target.value) || 0)}
                style={{
                  width: '100%',
                  padding: '0.35rem 0.45rem',
                  fontSize: '0.74rem',
                  border: '1.5px solid rgba(37,99,235,0.15)',
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
          <div>
            <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
              TOTAL REJECT QTY
            </label>
            <div
              style={{
                padding: '0.35rem 0.5rem',
                fontSize: '0.74rem',
                fontWeight: 800,
                background: '#E2E8F0',
                border: '1px solid rgba(0,0,0,0.05)',
                borderRadius: '6px',
                color: '#EF4444',
              }}
            >
              {totalReject}
            </div>
          </div>
          <div>
            <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
              TOTAL GOOD QTY
            </label>
            <div
              style={{
                padding: '0.35rem 0.5rem',
                fontSize: '0.74rem',
                fontWeight: 900,
                background: '#D1FAE5',
                border: '1px solid rgba(16,185,129,0.12)',
                borderRadius: '6px',
                color: '#10B981',
              }}
            >
              {totalGood}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (sessionEditMode) {
    return (
      <>
        {/* CARD 1: Inspection Details & Metrics (Top) */}
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
            1. Inspection Details & General Metrics
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
                  border: '1.5px solid rgba(37,99,235,0.12)',
                  borderRadius: '8px',
                  outline: 'none',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
                INSPECTOR NAME
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
                  border: '1.5px solid rgba(37,99,235,0.12)',
                  borderRadius: '8px',
                  outline: 'none',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
                FACTORY REPRESENTATIVE
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
                  border: '1.5px solid rgba(37,99,235,0.12)',
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
                value={activeSession.qty_available || 0}
                onChange={(e) => setActiveSession((prev: any) => ({ ...prev, qty_available: parseInt(e.target.value) || 0 }))}
                style={{
                  width: '100%',
                  padding: '0.35rem 0.45rem',
                  fontSize: '0.74rem',
                  border: '1.5px solid rgba(37,99,235,0.12)',
                  borderRadius: '8px',
                  outline: 'none',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>TOTAL STORE</label>
              <input
                type="number"
                value={activeSession.total_store || 0}
                onChange={(e) => setActiveSession((prev: any) => ({ ...prev, total_store: parseInt(e.target.value) || 0 }))}
                style={{
                  width: '100%',
                  padding: '0.35rem 0.45rem',
                  fontSize: '0.74rem',
                  border: '1.5px solid rgba(37,99,235,0.12)',
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
                value={activeSession.store_inspected || 0}
                onChange={(e) => setActiveSession((prev: any) => ({ ...prev, store_inspected: parseInt(e.target.value) || 0 }))}
                style={{
                  width: '100%',
                  padding: '0.35rem 0.45rem',
                  fontSize: '0.74rem',
                  border: '1.5px solid rgba(37,99,235,0.12)',
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
                value={activeSession.aql || 0.0}
                onChange={(e) => setActiveSession((prev: any) => ({ ...prev, aql: parseFloat(e.target.value) || 0.0 }))}
                style={{
                  width: '100%',
                  padding: '0.35rem 0.45rem',
                  fontSize: '0.74rem',
                  border: '1.5px solid rgba(37,99,235,0.12)',
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
                value={activeSession.level_val || 0.0}
                onChange={(e) => setActiveSession((prev: any) => ({ ...prev, level_val: parseFloat(e.target.value) || 0.0 }))}
                style={{
                  width: '100%',
                  padding: '0.35rem 0.45rem',
                  fontSize: '0.74rem',
                  border: '1.5px solid rgba(37,99,235,0.12)',
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
                value={activeSession.sampling_pcs || 0}
                onChange={(e) => setActiveSession((prev: any) => ({ ...prev, sampling_pcs: parseInt(e.target.value) || 0 }))}
                style={{
                  width: '100%',
                  padding: '0.35rem 0.45rem',
                  fontSize: '0.74rem',
                  border: '1.5px solid rgba(37,99,235,0.12)',
                  borderRadius: '8px',
                  outline: 'none',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
                VERDICT RESULT
              </label>
              <select
                value={activeSession.result || 'Pending'}
                onChange={(e) => setActiveSession((prev: any) => ({ ...prev, result: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '0.35rem 0.45rem',
                  fontSize: '0.74rem',
                  border: '1.5px solid rgba(37,99,235,0.12)',
                  borderRadius: '8px',
                  outline: 'none',
                  background: 'white',
                }}
              >
                <option value="Pending">Pending</option>
                <option value="Passed">Passed</option>
                <option value="Failed">Failed</option>
              </select>
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
            2. Garment Checklist verification
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
            {[
              { field: 'check_wash', label: 'Wash approved' },
              { field: 'check_style_as_sample', label: 'Style as sample' },
              { field: 'check_main_label', label: 'Main Label correct' },
              { field: 'check_flag_fit_label', label: 'Flag/Fit Label correct' },
              { field: 'check_print_embro_artwork', label: 'Print/Embro Artwork' },
              { field: 'check_hangtag', label: 'Hangtag applied' },
              { field: 'check_waist_tag', label: 'Waist Tag applied' },
              { field: 'check_barcode', label: 'Barcode scanned correct' },
              { field: 'check_packing_list', label: 'Packing List matches' },
              { field: 'check_shipping_mark', label: 'Shipping Mark verified' },
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
                    border: checked ? '1.5px solid rgba(37,99,235,0.22)' : '1.5px solid rgba(37,99,235,0.05)',
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
                value={activeSession.cutting_pcs || 0}
                onChange={(e) => setActiveSession((prev: any) => ({ ...prev, cutting_pcs: parseInt(e.target.value) || 0 }))}
                style={{ width: '100%', padding: '0.35rem 0.45rem', fontSize: '0.74rem', border: '1.5px solid rgba(37,99,235,0.12)', borderRadius: '8px', outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
                SEWING PCS
              </label>
              <input
                type="number"
                value={activeSession.sewing_pcs || 0}
                onChange={(e) => setActiveSession((prev: any) => ({ ...prev, sewing_pcs: parseInt(e.target.value) || 0 }))}
                style={{ width: '100%', padding: '0.35rem 0.45rem', fontSize: '0.74rem', border: '1.5px solid rgba(37,99,235,0.12)', borderRadius: '8px', outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
                FINISHING PCS
              </label>
              <input
                type="number"
                value={activeSession.finishing_pcs || 0}
                onChange={(e) => setActiveSession((prev: any) => ({ ...prev, finishing_pcs: parseInt(e.target.value) || 0 }))}
                style={{ width: '100%', padding: '0.35rem 0.45rem', fontSize: '0.74rem', border: '1.5px solid rgba(37,99,235,0.12)', borderRadius: '8px', outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
                PACKING PCS
              </label>
              <input
                type="number"
                value={activeSession.packing_pcs || 0}
                onChange={(e) => setActiveSession((prev: any) => ({ ...prev, packing_pcs: parseInt(e.target.value) || 0 }))}
                style={{ width: '100%', padding: '0.35rem 0.45rem', fontSize: '0.74rem', border: '1.5px solid rgba(37,99,235,0.12)', borderRadius: '8px', outline: 'none' }}
              />
            </div>
          </div>
        </div>

        {/* CARD 4: CMT-Pak Details Grid per Size */}
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
            4. Production Details Report per Size
          </h4>
          {renderSizeDetailsGrid(true)}
        </div>
      </>
    );
  }

  // Read-only Mode
  return (
    <>
      {/* CARD 1: Inspection Details & Metrics (Top) */}
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
          1. Inspection Details & General Metrics
        </h4>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '0.65rem',
            background: '#F8FAFC',
            padding: '0.85rem',
            borderRadius: '12px',
            border: '1px solid rgba(37,99,235,0.05)',
          }}
        >
          <div>
            <span style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>INSPECTION DATE</span>
            <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--deep-ocean)' }}>{activeSession.inspection_date || 'N/A'}</div>
          </div>
          <div>
            <span style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>INSPECTOR NAME</span>
            <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--deep-ocean)' }}>{activeSession.inspector || 'N/A'}</div>
          </div>
          <div>
            <span style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
              FACTORY REPRESENTATIVE
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
          2. Garment Checklist Verification
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
          {[
            { field: 'check_wash', label: 'Wash approved' },
            { field: 'check_style_as_sample', label: 'Style as sample' },
            { field: 'check_main_label', label: 'Main Label correct' },
            { field: 'check_flag_fit_label', label: 'Flag/Fit Label correct' },
            { field: 'check_print_embro_artwork', label: 'Print/Embro Artwork' },
            { field: 'check_hangtag', label: 'Hangtag applied' },
            { field: 'check_waist_tag', label: 'Waist Tag applied' },
            { field: 'check_barcode', label: 'Barcode scanned correct' },
            { field: 'check_packing_list', label: 'Packing List matches' },
            { field: 'check_shipping_mark', label: 'Shipping Mark verified' },
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
                  border: checked ? '1.5px solid rgba(16,185,129,0.15)' : '1.5px solid rgba(0,0,0,0.03)',
                  fontSize: '0.72rem',
                  fontWeight: checked ? 800 : 500,
                  color: checked ? '#10B981' : 'var(--text-muted)',
                }}
              >
                <span style={{ fontSize: '0.9rem', color: checked ? '#10B981' : 'var(--text-muted)' }}>{checked ? '✓' : '✗'}</span>
                {chk.label}
              </div>
            );
          })}
        </div>
      </div>

      {/* CARD 3: Production Status Group (Bottom) */}
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
          3. Production Status Group
        </h4>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr 1fr',
            gap: '0.5rem',
            background: '#F8FAFC',
            padding: '0.85rem',
            borderRadius: '12px',
            border: '1px solid rgba(37,99,235,0.05)',
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
          4. Production Details Report per Size
        </h4>
        {renderSizeDetailsGrid(false)}
      </div>
    </>
  );
};
