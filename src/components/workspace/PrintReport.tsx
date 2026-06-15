import React from 'react';

interface PrintReportProps {
  activePackagingProject: any;
  activeSession: any;
  getCycleName: (cycleNum: number) => string;
  tempDefectImages?: any[];
}

export const PrintReport: React.FC<PrintReportProps> = ({
  activePackagingProject,
  activeSession,
  getCycleName,
  tempDefectImages = [],
}) => {
  if (!activePackagingProject || !activeSession) return null;

  // Filter project defect images for this specific project to ensure all logged defects are included
  const savedSessionImages = (activePackagingProject.defect_images || []).filter(
    (img: any) => img.project_id === activePackagingProject.project_id
  );
  // Combine local draft defect images with database saved images
  const sessionImages = [...tempDefectImages, ...savedSessionImages];

  // Group defects by type and description for the defect details table
  const defectGroups: Record<string, { type: string; desc: string; major: number; minor: number }> = {};
  sessionImages.forEach((img: any) => {
    const type = img.defect_type || 'General';
    const desc = (img.description && img.description.trim()) ? img.description.trim() : 'No description';
    const key = `${type}_${desc}`;
    if (!defectGroups[key]) {
      defectGroups[key] = {
        type,
        desc,
        major: 0,
        minor: 0,
      };
    }
    defectGroups[key].major += img.major || 0;
    defectGroups[key].minor += img.minor || 0;
  });
  const defectsList = Object.values(defectGroups);

  // Sum total majors and minors
  const totalMajor = sessionImages.reduce((sum: number, img: any) => sum + (img.major || 0), 0);
  const totalMinor = sessionImages.reduce((sum: number, img: any) => sum + (img.minor || 0), 0);

  // Checklist configuration
  const checklistFields = [
    { field: 'check_wash', label: 'Washing' },
    { field: 'check_style_as_sample', label: 'Style as Sample' },
    { field: 'check_main_label', label: 'Main Label' },
    { field: 'check_flag_fit_label', label: 'Flag/Fit Label' },
    { field: 'check_print_embro_artwork', label: 'Print/Embro Artwork' },
    { field: 'check_hangtag', label: 'Hangtag' },
    { field: 'check_waist_tag', label: 'Waist Tag' },
    { field: 'check_barcode', label: 'Barcode' },
    { field: 'check_packing_list', label: 'Packing List' },
    { field: 'check_shipping_mark', label: 'Shipping Mark' },
  ];

  // Helper to fetch session_qty for a specific cycle and size
  const getSessionQtyByCycle = (cycleNum: number, sizeVal: string) => {
    if (activeSession.cycle_number === cycleNum) {
      const activeLine = (activeSession.report_lines || []).find((rl: any) => rl.size_val === sizeVal);
      return activeLine ? activeLine.session_qty || 0 : 0;
    }
    const targetSession = (activePackagingProject.sessions || []).find((s: any) => s.cycle_number === cycleNum);
    if (!targetSession) return 0;
    const targetLine = (targetSession.report_lines || []).find((rl: any) => rl.size_val === sizeVal);
    return targetLine ? targetLine.session_qty || 0 : 0;
  };

  // Helper to calculate other sessions' reject qty
  const getOtherSessionsRejectQty = (sizeVal: string) => {
    return (activePackagingProject.sessions || [])
      .filter((s: any) => s.cycle_number <= activeSession.cycle_number && s.session_id !== activeSession.session_id)
      .reduce((sum: number, s: any) => {
        const line = (s.report_lines || []).find((l: any) => l.size_val === sizeVal);
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
  };

  // Sizing matrix data mapping
  const reportLines = activeSession.report_lines || [];
  
  // Calculate Totals for the Sizing Matrix Table
  let sumOrderQty = 0;
  let sumCuttingQty = 0;
  let sumGoodGarments = 0;
  let sumRejectProduksi = 0;
  let sumRejectBahan = 0;
  let sumRejectCutting = 0;
  let sumRejectSewing = 0;
  let sumRejectPrinting = 0;
  let sumRejectEmbro = 0;
  let sumRejectWashing = 0;
  let sumRejectFinishing = 0;
  let sumRejectBtj = 0;
  let sumTotalReject = 0;
  let sumBarangHilang = 0;
  let sumWip = 0;
  let sumPartialI = 0;
  let sumPartialII = 0;
  let sumPartialIII = 0;
  let sumTotalDeliveryFG = 0;

  const rowData = reportLines.map((line: any) => {
    const baseLine = (activePackagingProject.base_lines || []).find((bl: any) => bl.size_val === line.size_val);
    const cuttingQty = baseLine ? baseLine.total_good_qty || 0 : 0;

    // Reject categories for current session
    const rBahan = line.reject_bahan || 0;
    const rCutting = line.reject_cutting || 0;
    const rSewing = line.reject_sewing || 0;
    const rFinishing = line.reject_finishing || 0;
    const rPrinting = line.reject_printing || 0;
    const rEmbro = line.reject_embro || 0;
    const rWashing = line.reject_washing || 0;
    const btjVal = line.btj || 0;
    const bHilang = line.barang_hilang || 0;

    const rejectProduksi = rCutting + rSewing + rFinishing + rPrinting + rEmbro + rWashing;

    // Cumulative rejects across previous sessions + current session
    const otherRejects = getOtherSessionsRejectQty(line.size_val);
    const totalReject = otherRejects + (rBahan + rejectProduksi + btjVal + bHilang);

    // Cumulative good inspected (includes pre-final if any)
    const otherGood = (activePackagingProject.sessions || [])
      .filter((s: any) => s.cycle_number <= activeSession.cycle_number && s.session_id !== activeSession.session_id)
      .reduce((sum: number, s: any) => {
        const rl = (s.report_lines || []).find((l: any) => l.size_val === line.size_val);
        return sum + (rl?.session_qty || 0);
      }, 0);
    const goodGarments = otherGood + (line.session_qty || 0);

    // Partial deliveries mapping (Cycle 2 = Partial I, Cycle 3 = Partial II, Cycle 4 = Partial III)
    const qtyI = getSessionQtyByCycle(2, line.size_val);
    const qtyII = getSessionQtyByCycle(3, line.size_val);
    const qtyIII = getSessionQtyByCycle(4, line.size_val);

    const totalDeliveryFG = goodGarments;

    // WIP = CuttingQty - Total Delivery FG - Total Reject
    const wip = Math.max(0, cuttingQty - totalDeliveryFG - totalReject);

    // Balance = Total Delivery FG / Cutting Qty (per user request)
    const balancePercent = cuttingQty > 0 ? (totalDeliveryFG / cuttingQty) * 100 : 0;
    const balance = `${balancePercent.toFixed(2)}%`;

    // Aggregate totals
    sumOrderQty += line.qty_order || 0;
    sumCuttingQty += cuttingQty;
    sumGoodGarments += goodGarments;
    sumRejectProduksi += rejectProduksi;
    sumRejectBahan += rBahan;
    sumRejectCutting += rCutting;
    sumRejectSewing += rSewing;
    sumRejectPrinting += rPrinting;
    sumRejectEmbro += rEmbro;
    sumRejectWashing += rWashing;
    sumRejectFinishing += rFinishing;
    sumRejectBtj += btjVal;
    sumTotalReject += totalReject;
    sumBarangHilang += bHilang;
    sumWip += wip;
    sumPartialI += qtyI;
    sumPartialII += qtyII;
    sumPartialIII += qtyIII;
    sumTotalDeliveryFG += totalDeliveryFG;

    return {
      size: line.size_val || '—',
      orderQty: line.qty_order || 0,
      cuttingQty,
      goodGarments,
      rejectProduksi,
      rejectBahan: rBahan,
      rejectCutting: rCutting,
      rejectSewing: rSewing,
      rejectPrinting: rPrinting,
      rejectEmbro: rEmbro,
      rejectWashing: rWashing,
      rejectFinishing: rFinishing,
      rejectBtj: btjVal,
      totalReject,
      barangHilang: bHilang,
      wip,
      qtyI,
      qtyII,
      qtyIII,
      totalDeliveryFG,
      balance,
    };
  });

  const totalBalancePercent = sumCuttingQty > 0 ? (sumTotalDeliveryFG / sumCuttingQty) * 100 : 0;
  const totalBalance = `${totalBalancePercent.toFixed(2)}%`;

  const checkedChecklistFields = [
    ...checklistFields.filter(chk => activeSession[chk.field]),
    ...(activeSession.check_other_1 && activeSession.check_other_1_label?.trim() ? [{ field: 'check_other_1', label: activeSession.check_other_1_label.trim() }] : []),
    ...(activeSession.check_other_2 && activeSession.check_other_2_label?.trim() ? [{ field: 'check_other_2', label: activeSession.check_other_2_label.trim() }] : []),
  ];

  const formatDate = (dateStr: any) => {
    if (!dateStr) return '—';
    const str = String(dateStr).trim();
    
    // Check DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
      return str;
    }
    
    // Check DD-MM-YYYY
    if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
      return str.replace(/-/g, '/');
    }
    
    // Check YYYY-MM-DD
    const ymdMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
    if (ymdMatch) {
      const [_, y, m, d] = ymdMatch;
      return `${d}/${m}/${y}`;
    }
    
    try {
      const dateObj = new Date(str);
      if (!isNaN(dateObj.getTime())) {
        const d = String(dateObj.getDate()).padStart(2, '0');
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const y = dateObj.getFullYear();
        return `${d}/${m}/${y}`;
      }
    } catch (e) {
      // Fallback
    }
    
    return str;
  };

  return (
    <div className="print-report-view">
      {/* PAGE 1: Main Report Sheet */}
      <div className="print-page-1">
        {/* Header Panel */}
        <div className="print-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', width: '100%', borderBottom: '1.5px solid #0F172A', paddingBottom: '2px', marginBottom: '4px' }}>
          {/* Logo container using negative vertical margins to offset its internal spacing and utilize top blank space */}
          <div style={{ display: 'flex', alignItems: 'center', marginTop: '-15px', marginBottom: '-12px' }}>
            <img src="/logo_pdf.png" alt="Mega Perintis Logo" style={{ height: '110px', objectFit: 'contain' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="report-version">
                {getCycleName(activeSession.cycle_number).toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
              </span>
              <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, textTransform: 'uppercase', color: '#0F172A', fontFamily: "'Outfit', sans-serif" }}>
                INSPECTION REPORT
              </h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.62rem', color: '#64748B', fontWeight: 600 }}>
                QUALITY CONTROL SYSTEM
              </span>
            </div>
          </div>
        </div>

        {/* Section 1: Overview */}
        <div className="print-section-title">1. Inspection Overview</div>
        <table className="print-table overview-table">
          <tbody>
            <tr>
              <th>Vendor</th>
              <td colSpan={5}>{activePackagingProject.po_vendor || '—'}</td>
              <th>PO Number</th>
              <td>{activePackagingProject.po_info || '—'}</td>
            </tr>
            <tr>
              <th>Article Name</th>
              <td colSpan={5}>{activePackagingProject.article_name || '—'}</td>
              <th>Qty Order</th>
              <td>{activePackagingProject.po_qty ? activePackagingProject.po_qty.toLocaleString() : '—'}</td>
            </tr>
            <tr>
              <th>Inspection Date</th>
              <td>{formatDate(activeSession.inspection_date)}</td>
              <th>Available Qty</th>
              <td>{activeSession.qty_available ? activeSession.qty_available.toLocaleString() : '—'}</td>
              <th>Total Store</th>
              <td>{activeSession.total_store || '—'}</td>
              <th>Store Inspected</th>
              <td>{activeSession.store_inspected || '—'}</td>
            </tr>
            <tr>
              <th>Delivery Plan</th>
              <td>{formatDate(activePackagingProject.po_plan_date)}</td>
              <th>Season</th>
              <td>{activePackagingProject.season || '—'}</td>
              <th>PLM ID</th>
              <td>{activePackagingProject.plm_id || '—'}</td>
              <th>Production Group</th>
              <td>{activePackagingProject.production_group || '—'}</td>
            </tr>
          </tbody>
        </table>

      {/* Section 2: Quality Control Status */}
      <div className="print-section-title">2. Quality Control Status</div>
      <div style={{ display: 'flex', gap: '15px', width: '100%', marginBottom: '12px', alignItems: 'flex-start' }}>
        {/* Left: Checklist + Sampling Status */}
        {checkedChecklistFields.length > 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div className="print-status-bar" style={{ margin: 0, padding: '4px 8px', fontSize: '0.62rem', border: '1px solid #E2E8F0', borderRadius: '6px', background: '#F8FAFC', display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
              <span>SAMPLING: <strong>{activeSession.sampling_pcs || 0}</strong></span>
              <span>AQL: <strong>{activeSession.aql || '—'}</strong></span>
              <span>LEVEL: <strong>{activeSession.level_val || '—'}</strong></span>
            </div>
            <div style={{ border: '1px solid #E2E8F0', borderRadius: '6px', padding: '10px', background: '#F8FAFC', display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '0.62rem', color: '#0F172A', marginBottom: '8px', textTransform: 'uppercase', borderBottom: '1px solid rgba(15,23,42,0.1)', paddingBottom: '3px' }}>
                Garment Checklist
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', flex: 1 }}>
                {checkedChecklistFields.map((chk) => {
                  return (
                    <div key={chk.field} className="print-checklist-item checked">
                      <span className="checklist-icon">☑</span>
                      <span>{chk.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        {/* Right: Defect Log */}
        <div style={{ flex: checkedChecklistFields.length > 0 ? 1.5 : 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {checkedChecklistFields.length === 0 && (
            <div className="print-status-bar" style={{ margin: 0, padding: '4px 8px', fontSize: '0.62rem', border: '1px solid #E2E8F0', borderRadius: '6px', background: '#F8FAFC', display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
              <span>SAMPLING: <strong>{activeSession.sampling_pcs || 0}</strong></span>
              <span>AQL: <strong>{activeSession.aql || '—'}</strong></span>
              <span>LEVEL: <strong>{activeSession.level_val || '—'}</strong></span>
            </div>
          )}
          <table className="print-table" style={{ margin: 0, flex: 1 }}>
            <thead>
              <tr>
                <th style={{ width: '80%', fontSize: '0.62rem', fontWeight: 600, color: '#0F172A', textTransform: 'uppercase' }}>Defect Type & Description</th>
                <th style={{ width: '10%', textAlign: 'center', fontSize: '0.62rem', fontWeight: 600, color: '#0F172A', textTransform: 'uppercase' }}>Major</th>
                <th style={{ width: '10%', textAlign: 'center', fontSize: '0.62rem', fontWeight: 600, color: '#0F172A', textTransform: 'uppercase' }}>Minor</th>
              </tr>
            </thead>
            <tbody>
              {defectsList.length > 0 ? (
                defectsList.map((defect, idx) => (
                  <tr key={idx}>
                    <td className="print-defect-text">
                      [{defect.type}] {defect.desc}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: defect.major > 0 ? 600 : 400 }}>{defect.major}</td>
                    <td style={{ textAlign: 'center', fontWeight: defect.minor > 0 ? 600 : 400 }}>{defect.minor}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', color: '#94A3B8', padding: '10px' }}>
                    No defects logged in this session.
                  </td>
                </tr>
              )}
              <tr style={{ fontWeight: 'bold', backgroundColor: '#F8FAFC' }}>
                <td>TOTAL</td>
                <td style={{ textAlign: 'center', color: totalMajor > 0 ? '#DC2626' : '#0F172A' }}>{totalMajor}</td>
                <td style={{ textAlign: 'center', color: totalMinor > 0 ? '#D97706' : '#0F172A' }}>{totalMinor}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3: Sizing & Production Status Matrix */}
      <div className="print-section-title">3. Sizing & Production Yield Matrix</div>
      <div className="print-status-bar" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#0F172A' }}>
        <span>CUTTING: <strong>{activeSession.cutting_pcs ? activeSession.cutting_pcs.toLocaleString() : '0'} PCS</strong></span>
        <span>SEWING: <strong>{activeSession.sewing_pcs ? activeSession.sewing_pcs.toLocaleString() : '0'} PCS</strong></span>
        <span>FINISHING: <strong>{activeSession.finishing_pcs ? activeSession.finishing_pcs.toLocaleString() : '0'} PCS</strong></span>
        <span>PACKING: <strong>{activeSession.packing_pcs ? activeSession.packing_pcs.toLocaleString() : '0'} PCS</strong></span>
      </div>

      <table className="print-table matrix-table">
        <thead>
          <tr>
            <th rowSpan={3} style={{ verticalAlign: 'middle' }}>SIZE</th>
            <th rowSpan={3} style={{ verticalAlign: 'middle', lineHeight: 1.1 }}>Order<br/>Qty</th>
            <th rowSpan={3} style={{ verticalAlign: 'middle', lineHeight: 1.1 }}>Cutting<br/>Qty</th>
            <th rowSpan={3} style={{ verticalAlign: 'middle', lineHeight: 1.1 }}>Good<br/>Garments</th>
            <th colSpan={10}>Reject Category</th>
            <th rowSpan={3} style={{ verticalAlign: 'middle', lineHeight: 1.1 }}>Total<br/>Reject</th>
            <th rowSpan={3} style={{ verticalAlign: 'middle' }}>WIP</th>
            <th colSpan={3}>Partial Delivery</th>
            <th rowSpan={3} style={{ verticalAlign: 'middle', lineHeight: 1.1 }}>Total Delivery<br/>FG</th>
            <th rowSpan={3} style={{ verticalAlign: 'middle' }}>Balance</th>
          </tr>
          <tr>
            <th colSpan={7}>Produksi</th>
            <th rowSpan={2} style={{ verticalAlign: 'middle' }}>Bahan</th>
            <th rowSpan={2} style={{ verticalAlign: 'middle' }}>BTJ</th>
            <th rowSpan={2} style={{ verticalAlign: 'middle', lineHeight: 1.1 }}>Barang<br/>Hilang</th>
            <th rowSpan={2} style={{ verticalAlign: 'middle' }}>I</th>
            <th rowSpan={2} style={{ verticalAlign: 'middle' }}>II</th>
            <th rowSpan={2} style={{ verticalAlign: 'middle' }}>III</th>
          </tr>
          <tr>
            <th>Cutting</th>
            <th>Sewing</th>
            <th>Printing</th>
            <th>Embro</th>
            <th>Washing</th>
            <th>Finishing</th>
            <th style={{ fontWeight: 'bold', backgroundColor: '#F1F5F9' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {rowData.map((row: any, idx: number) => (
            <tr key={idx}>
              <td className="print-matrix-size-cell">{row.size}</td>
              <td>{row.orderQty.toLocaleString()}</td>
              <td>{row.cuttingQty.toLocaleString()}</td>
              <td>{row.goodGarments.toLocaleString()}</td>
              <td>{row.rejectCutting}</td>
              <td>{row.rejectSewing}</td>
              <td>{row.rejectPrinting}</td>
              <td>{row.rejectEmbro}</td>
              <td>{row.rejectWashing}</td>
              <td>{row.rejectFinishing}</td>
              <td style={{ fontWeight: 'bold', backgroundColor: '#F8FAFC' }}>{row.rejectProduksi.toLocaleString()}</td>
              <td>{row.rejectBahan}</td>
              <td>{row.rejectBtj}</td>
              <td>{row.barangHilang}</td>
              <td style={{ fontWeight: 'bold', color: row.totalReject > 0 ? '#DC2626' : '#0F172A' }}>{row.totalReject.toLocaleString()}</td>
              <td>{row.wip.toLocaleString()}</td>
              <td>{row.qtyI > 0 ? row.qtyI.toLocaleString() : '—'}</td>
              <td>{row.qtyII > 0 ? row.qtyII.toLocaleString() : '—'}</td>
              <td>{row.qtyIII > 0 ? row.qtyIII.toLocaleString() : '—'}</td>
              <td style={{ fontWeight: 'bold', color: '#059669' }}>{row.totalDeliveryFG.toLocaleString()}</td>
              <td style={{ fontWeight: 'bold' }}>{row.balance}</td>
            </tr>
          ))}
          <tr className="total-row" style={{ fontWeight: 'bold', backgroundColor: '#F8FAFC' }}>
            <td>TOTAL</td>
            <td>{sumOrderQty.toLocaleString()}</td>
            <td>{sumCuttingQty.toLocaleString()}</td>
            <td>
              <div style={{ marginBottom: '2px' }}>{sumGoodGarments.toLocaleString()}</div>
              <div style={{ fontSize: '0.45rem', color: '#64748B', fontWeight: 600 }}>
                ({sumCuttingQty > 0 ? ((sumGoodGarments / sumCuttingQty) * 100).toFixed(2) : '0.00'}%)
              </div>
            </td>
            <td>{sumRejectCutting}</td>
            <td>{sumRejectSewing}</td>
            <td>{sumRejectPrinting}</td>
            <td>{sumRejectEmbro}</td>
            <td>{sumRejectWashing}</td>
            <td>{sumRejectFinishing}</td>
            <td style={{ backgroundColor: '#F1F5F9' }}>
              <div style={{ marginBottom: '2px' }}>{sumRejectProduksi.toLocaleString()}</div>
              <div style={{ fontSize: '0.45rem', color: '#64748B', fontWeight: 600 }}>
                ({sumCuttingQty > 0 ? ((sumRejectProduksi / sumCuttingQty) * 100).toFixed(2) : '0.00'}%)
              </div>
            </td>
            <td>{sumRejectBahan}</td>
            <td>{sumRejectBtj}</td>
            <td>
              <div>{sumBarangHilang}</div>
            </td>
            <td style={{ color: sumTotalReject > 0 ? '#DC2626' : '#0F172A' }}>
              <div style={{ marginBottom: '2px' }}>{sumTotalReject.toLocaleString()}</div>
              <div style={{ fontSize: '0.45rem', color: '#64748B', fontWeight: 600 }}>
                ({sumCuttingQty > 0 ? ((sumTotalReject / sumCuttingQty) * 100).toFixed(2) : '0.00'}%)
              </div>
            </td>
            <td>
              <div style={{ marginBottom: '2px' }}>{sumWip.toLocaleString()}</div>
              <div style={{ fontSize: '0.5rem', color: '#64748B', fontWeight: 600 }}>
                ({sumCuttingQty > 0 ? ((sumWip / sumCuttingQty) * 100).toFixed(2) : '0.00'}%)
              </div>
            </td>
            <td>{sumPartialI > 0 ? sumPartialI.toLocaleString() : '—'}</td>
            <td>{sumPartialII > 0 ? sumPartialII.toLocaleString() : '—'}</td>
            <td>{sumPartialIII > 0 ? sumPartialIII.toLocaleString() : '—'}</td>
            <td style={{ color: '#059669' }}>
              <div style={{ marginBottom: '2px' }}>{sumTotalDeliveryFG.toLocaleString()}</div>
              <div style={{ fontSize: '0.5rem', color: '#059669', fontWeight: 600 }}>
                ({sumCuttingQty > 0 ? ((sumTotalDeliveryFG / sumCuttingQty) * 100).toFixed(2) : '0.00'}%)
              </div>
            </td>
            <td>{totalBalance}</td>
          </tr>
        </tbody>
      </table>

      {/* Section 4: Deductions */}
      <div className="print-section-title">4. Deductions</div>
      {(() => {
        const salesPrice = activePackagingProject.sales_price || 0;
        const penaltyPrice = salesPrice * 0.70;
        const allowedLimit = Math.floor(sumCuttingQty * 0.01);
        const exceedingRejectQty = Math.max(0, sumRejectProduksi - allowedLimit);
        const totalBarangHilang = sumBarangHilang;

        const rejectProduksiPenalty = exceedingRejectQty * penaltyPrice;
        const barangHilangPenalty = totalBarangHilang * penaltyPrice;
        const totalDeduction = rejectProduksiPenalty + barangHilangPenalty;

        return (
          <table className="print-table" style={{ marginBottom: '10px' }}>
            <thead>
              <tr>
                <th style={{ width: '30%' }}>Description</th>
                <th style={{ width: '15%', textAlign: 'center' }}>Price/Pcs</th>
                <th style={{ width: '25%' }}>Reason</th>
                <th style={{ width: '15%', textAlign: 'center' }}>Qty</th>
                <th style={{ width: '15%', textAlign: 'center' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {exceedingRejectQty === 0 && totalBarangHilang === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: '#94A3B8', padding: '8px' }}>
                    No deductions logged for this session.
                  </td>
                </tr>
              ) : (
                <>
                  {exceedingRejectQty > 0 && (
                    <tr>
                      <td>Production Reject Penalty (Exceeding 1% Limit)</td>
                      <td style={{ textAlign: 'center' }}>Rp {Math.round(penaltyPrice).toLocaleString('id-ID')}</td>
                      <td>Total reject {sumRejectProduksi} exceeds 1% of cutting qty ({sumCuttingQty}) by {exceedingRejectQty} pcs</td>
                      <td style={{ textAlign: 'center' }}>{exceedingRejectQty}</td>
                      <td style={{ textAlign: 'center' }}>Rp {Math.round(rejectProduksiPenalty).toLocaleString('id-ID')}</td>
                    </tr>
                  )}
                  {totalBarangHilang > 0 && (
                    <tr>
                      <td>Lost Items Penalty (Barang Hilang)</td>
                      <td style={{ textAlign: 'center' }}>Rp {Math.round(penaltyPrice).toLocaleString('id-ID')}</td>
                      <td>Lost {totalBarangHilang} pcs during production</td>
                      <td style={{ textAlign: 'center' }}>{totalBarangHilang}</td>
                      <td style={{ textAlign: 'center' }}>Rp {Math.round(barangHilangPenalty).toLocaleString('id-ID')}</td>
                    </tr>
                  )}
                  <tr style={{ fontWeight: 'bold', backgroundColor: '#F8FAFC' }}>
                    <td colSpan={4} style={{ textAlign: 'right', paddingRight: '15px' }}>Total Deductions</td>
                    <td style={{ textAlign: 'center' }}>Rp {Math.round(totalDeduction).toLocaleString('id-ID')}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        );
      })()}

      {/* Section 5: Conclusions */}
      <div className="print-section-title">5. Conclusions</div>
      <div className="print-signatures-container">
        <div className={`print-result-block ${(activeSession.result || 'pending').toLowerCase()}`}>
          <span className="print-result-title">∴ Overall Inspection Result</span>
          <span className={`print-result-value ${(activeSession.result || 'pending').toLowerCase()}`}>
            {activeSession.result ? activeSession.result.toUpperCase() : 'PENDING'}
          </span>
        </div>
        <div className="print-signature-box">
          <span className="print-signature-label">Inspected By</span>
          <span className="print-signature-name">{activeSession.inspector || 'Inspector'}</span>
        </div>
        <div className="print-signature-box">
          <span className="print-signature-label">Confirmed By</span>
          <span className="print-signature-name">{activeSession.factory_representative || 'Confirmed By'}</span>
        </div>
      </div>

      {/* Print Footer Info */}
      <div className="print-footer-info">
        <span>Distribution by email: 1. Factory  2. MD Prod  3. PPIC/Finance  4. QA MP</span>
        <span>☞ This is an auto-generated document. Chimera QC Console [{new Date().toLocaleString()}]</span>
      </div>
    </div>

      {/* PAGE 2: Defect Photos Attachments */}
      {sessionImages.length > 0 && (
        <div className="print-page-2">
          <div className="print-section-title" style={{ marginTop: 0, marginBottom: '10px' }}>
            6. Defect Photos Attachments
          </div>
          <div className="print-image-grid">
            {sessionImages.map((img: any, idx: number) => (
              <div key={img.image_id || idx} className="print-image-card">
                <div className="print-image-container">
                  <img src={img.image_path} alt={`Defect ${idx + 1}`} />
                </div>
                <div className="print-image-type">Defect #{idx + 1} - {img.defect_type || 'General'}</div>
                <div className="print-image-desc" title={(img.description && img.description.trim()) ? img.description.trim() : ''}>
                  {(img.description && img.description.trim()) ? img.description.trim() : 'No description provided.'}
                </div>
                <div className="print-image-stats">
                  <span style={{ color: '#DC2626' }}>MAJ: {img.major || 0}</span>
                  <span style={{ color: '#D97706' }}>MIN: {img.minor || 0}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
