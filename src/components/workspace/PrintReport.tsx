import { LOGO_BASE64 } from './logo_base64';
import React from 'react';
import { calculateDeductions } from '../../utils/calculations';

export const convertToUTC7 = (dateInput: string | Date | null | undefined): string => {
  if (!dateInput) return '—';
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(date).replace(/\//g, '-').replace(',', '');
  } catch (e) {
    return '—';
  }
};

export const parseSignature = (sigStr: string | null | undefined) => {
  if (!sigStr) return { isSigned: false, isRejected: false, name: '', email: '', date: '' };

  // Signature contract: '<Prefix>: <who> [UTC+07:00: <ts>]' where <who> is
  // either a role label ('MPG HO - MD Production'), a bare email, or the
  // attributed 'Name <email>' the portal writes for identified approvers.
  const parseBody = (prefix: string) => {
    const match = sigStr.match(new RegExp(prefix + String.raw`:\s*([^\[]+?)\s*(?:\[UTC\+07:00:\s*([^\]]+)\])?\s*$`));
    let name = match ? match[1].trim() : sigStr;
    let email = '';
    const em = name.match(/^(.*?)\s*<([^>]+)>$/);
    if (em) {
      email = em[2].trim();
      name = em[1].trim() || email;
    }
    return { name, email, date: match?.[2]?.trim() || '' };
  };

  if (sigStr.includes('Digitally Signed:')) {
    return { isSigned: true, isRejected: false, ...parseBody('Digitally Signed') };
  }
  if (sigStr.includes('Rejected:')) {
    return { isSigned: false, isRejected: true, ...parseBody('Rejected') };
  }

  return { isSigned: false, isRejected: false, name: sigStr, email: '', date: '' };
};

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

  // Include all defect images up to the current version cycle (matches cumulative count table logic)
  const savedSessionImages = (activePackagingProject.defect_images || []).filter(
    (img: any) => {
      if (img.project_id !== activePackagingProject.project_id) return false;
      if (!img.session_id) return true;
      const imgSession = (activePackagingProject.sessions || []).find((s: any) => s.session_id === img.session_id);
      if (!imgSession) return false;
      return imgSession.cycle_number <= activeSession.cycle_number;
    }
  );
  const sessionImages = [...tempDefectImages, ...savedSessionImages];

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

  // Helper to calculate cumulative reject qty for a specific category across all cycles up to current
  const getCumulativeRejectByCategory = (categoryField: string, sizeVal: string): number => {
    return (activePackagingProject.sessions || [])
      .filter((s: any) => s.cycle_number <= activeSession.cycle_number)
      .reduce((sum: number, s: any) => {
        const line = (s.report_lines || []).find((l: any) => l.size_val === sizeVal);
        if (!line) return sum;
        return sum + (line[categoryField] || 0);
      }, 0);
  };

  // Sizing matrix data mapping
  const compareSizes = (aStr: string, bStr: string): number => {
    const cleanA = (aStr || '').trim().toUpperCase();
    const cleanB = (bStr || '').trim().toUpperCase();

    const numA = parseFloat(cleanA);
    const numB = parseFloat(cleanB);

    const isNumA = !isNaN(numA);
    const isNumB = !isNaN(numB);

    if (isNumA && isNumB) {
      if (numA !== numB) return numA - numB;
      return cleanA.localeCompare(cleanB);
    }
    if (isNumA && !isNumB) return -1;
    if (!isNumA && isNumB) return 1;

    const sizeOrder = [
      '5XS', '4XS', '3XS', '2XS', 'XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', 'XXL', '3XL', 'XXXL', '4XL', '5XL', '6XL'
    ];

    const idxA = sizeOrder.indexOf(cleanA);
    const idxB = sizeOrder.indexOf(cleanB);

    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1 && idxB === -1) return -1;
    if (idxA === -1 && idxB !== -1) return 1;

    return cleanA.localeCompare(cleanB);
  };

  const reportLines = [...(activeSession.report_lines || [])].sort((a: any, b: any) => compareSizes(a.size_val, b.size_val));
  
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
  let sumGoodsReceiveDelivery = 0;

  const rowData = reportLines.map((line: any) => {
    const baseLine = (activePackagingProject.base_lines || []).find((bl: any) => bl.size_val === line.size_val);
    const cuttingQty = baseLine ? baseLine.total_good_qty || 0 : 0;

    // Reject categories cumulative across all cycles up to current session
    const rBahan = getCumulativeRejectByCategory('reject_bahan', line.size_val);
    const rCutting = getCumulativeRejectByCategory('reject_cutting', line.size_val);
    const rSewing = getCumulativeRejectByCategory('reject_sewing', line.size_val);
    const rFinishing = getCumulativeRejectByCategory('reject_finishing', line.size_val);
    const rPrinting = getCumulativeRejectByCategory('reject_printing', line.size_val);
    const rEmbro = getCumulativeRejectByCategory('reject_embro', line.size_val);
    const rWashing = getCumulativeRejectByCategory('reject_washing', line.size_val);
    const btjVal = getCumulativeRejectByCategory('btj', line.size_val);
    const bHilang = getCumulativeRejectByCategory('barang_hilang', line.size_val);

    const rejectProduksi = rCutting + rSewing + rFinishing + rPrinting + rEmbro + rWashing;

    // Cumulative rejects across all cycles up to current session
    const totalReject = rBahan + rejectProduksi + btjVal + bHilang;

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

    // Goods Receive Delivery = total qty good + total qty reject except btj and barang hilang
    const goodsReceiveDelivery = goodGarments + rBahan + rejectProduksi;

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
    sumGoodsReceiveDelivery += goodsReceiveDelivery;

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
      goodsReceiveDelivery,
    };
  });

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
            <img src={LOGO_BASE64} alt="Mega Perintis Logo" style={{ height: '110px', objectFit: 'contain' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px' }}>
            <h1 style={{ margin: 0, fontWeight: 800, color: '#0F172A', fontFamily: "'Outfit', sans-serif", textAlign: 'right', lineHeight: 1.25 }}>
              <span style={{ fontSize: '1.05rem', display: 'block', textTransform: 'none', letterSpacing: 'normal' }}>
                {`${getCycleName(activeSession.cycle_number)} Inspection`}
              </span>
              <span style={{ fontSize: '0.6rem', fontWeight: 500, display: 'block', color: '#64748B', letterSpacing: 'normal', textTransform: 'none' }}>and</span>
              <span style={{ fontSize: '1.05rem', display: 'block', textTransform: 'none', letterSpacing: 'normal' }}>Official Report (Berita Acara)</span>
            </h1>
            <span style={{ fontSize: '0.62rem', color: '#64748B', fontWeight: 600 }}>
              QUALITY CONTROL SYSTEM
            </span>
          </div>
        </div>

        {/* Sections 1–4: scaled smaller in both print and PDF attachment (header/sigs remain full size) */}
        <div className="print-content-zone">
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
      {(() => {
        // Defects scoped to the active session only
        const defectGroups: Record<string, { type: string; desc: string; major: number; minor: number }> = {};
        sessionImages.forEach((img: any) => {
          const type = img.defect_type || 'General';
          const desc = (img.description && img.description.trim()) ? img.description.trim() : 'No description';
          const key = `${type}_${desc}`;
          if (!defectGroups[key]) defectGroups[key] = { type, desc, major: 0, minor: 0 };
          defectGroups[key].major += img.major || 0;
          defectGroups[key].minor += img.minor || 0;
        });
        const defectsList = Object.values(defectGroups);
        const totMajor = sessionImages.reduce((s: number, i: any) => s + (i.major || 0), 0);
        const totMinor = sessionImages.reduce((s: number, i: any) => s + (i.minor || 0), 0);

        return (
          <div style={{ display: 'flex', gap: '10px', width: '100%', marginBottom: '8px', alignItems: 'flex-start' }}>
            {/* Left: Garment Checklist */}
            {checkedChecklistFields.length > 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ border: '1px solid #E2E8F0', borderRadius: '6px', padding: '7px', background: '#F8FAFC', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.62rem', color: '#0F172A', marginBottom: '5px', textTransform: 'uppercase', borderBottom: '1px solid rgba(15,23,42,0.1)', paddingBottom: '3px' }}>
                    Garment Checklist
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', flex: 1 }}>
                    {checkedChecklistFields.map((chk) => (
                      <div key={chk.field} className="print-checklist-item checked">
                        <span className="checklist-icon">☑</span>
                        <span>{chk.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {/* Right: Sampling bar + defect table for this session only */}
            <div style={{ flex: checkedChecklistFields.length > 0 ? 1.5 : 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div className="print-status-bar" style={{ margin: 0, padding: '3px 7px', fontSize: '0.62rem', border: '1px solid #E2E8F0', borderRadius: '6px', background: '#F8FAFC', display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                <span>SAMPLING: <strong>{activeSession.sampling_pcs || 0}</strong></span>
                <span>AQL: <strong>{activeSession.aql || '—'}</strong></span>
                <span>LEVEL: <strong>{activeSession.level_val || '—'}</strong></span>
              </div>
              <table className="print-table" style={{ margin: 0 }}>
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
                        <td className="print-defect-text">[{activeSession.cycle_number >= 2 ? `${getCycleName(activeSession.cycle_number)}|${defect.type}` : defect.type}] {defect.desc}</td>
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
                    <td style={{ textAlign: 'center', color: totMajor > 0 ? '#DC2626' : '#0F172A' }}>{totMajor}</td>
                    <td style={{ textAlign: 'center', color: totMinor > 0 ? '#D97706' : '#0F172A' }}>{totMinor}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

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
            <th rowSpan={3} style={{ verticalAlign: 'middle', lineHeight: 1.1 }}>Good<br/>Qty</th>
            <th colSpan={10}>Reject Category</th>
            <th rowSpan={3} style={{ verticalAlign: 'middle', lineHeight: 1.1 }}>Total<br/>Reject</th>
            <th rowSpan={3} style={{ verticalAlign: 'middle' }}>WIP</th>
            <th colSpan={3}>Partial Delivery</th>
            <th rowSpan={3} style={{ verticalAlign: 'middle', lineHeight: 1.1 }}>Total Delivery<br/>FG</th>
            <th rowSpan={3} style={{ verticalAlign: 'middle', lineHeight: 1.1 }}>Goods Receive<br/>Delivery</th>
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
            <th className="produksi-sub">Cutting</th>
            <th className="produksi-sub">Sewing</th>
            <th className="produksi-sub">Printing</th>
            <th className="produksi-sub">Embro</th>
            <th className="produksi-sub">Washing</th>
            <th className="produksi-sub">Finishing</th>
            <th className="produksi-sub" style={{ fontWeight: 'bold', backgroundColor: '#F1F5F9' }}>Total</th>
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
              <td style={{ fontWeight: 'bold', color: 'var(--royal-blue)' }}>{row.goodsReceiveDelivery.toLocaleString()}</td>
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
              <div>{sumWip.toLocaleString()}</div>
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
            <td style={{ color: 'var(--royal-blue)' }}>{sumGoodsReceiveDelivery.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      {/* Fabric summary — compact key:value line(s) beneath yield matrix */}
      {(() => {
        const fabricLines: any[] = activePackagingProject.fabric_lines || [];
        if (fabricLines.length === 0) return null;
        const fmt = (v: any) => (v != null ? Number(v).toLocaleString('id-ID') : '');
        const fmtCons = (v: any) => (v != null ? Number(v).toLocaleString('id-ID', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : '—');
        const fmtPercent = (v: any) => (v != null ? (v * 100).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' : '—');
        const shortLabel = (s: string) => !s || s.length <= 42 ? s : `${s.slice(0, 28).trimEnd()} ... ${s.slice(-13).trimStart()}`;
        return (
          <div style={{ marginTop: '5px', marginBottom: '3px', fontSize: '0.57rem', color: '#334155', lineHeight: 1.8 }}>
            {fabricLines.map((f: any, idx: number) => {
              const unitMatch = f.label?.match(/\(([A-Za-z0-9]+)\)\s*$/);
              const unit = unitMatch ? ` ${unitMatch[1]}` : '';

              const fabricPairs: [string, string][] = [
                ['Fabric Sent', fmt(f.fabric_sent)],
                ['Short Roll', fmt(f.short_roll)],
                ['Sisa Kain (utuh)', fmt(f.sisa_kain)],
                ['Kepala Kain', fmt(f.kepala_kain)],
                ['Retur Kain', fmt(f.return_kain)],
              ];

              const consPairs: [string, string][] = [
                ['Cutt Plan', f.cutt_plan != null ? `${Number(f.cutt_plan).toLocaleString('id-ID')} Pcs` : '—'],
                ['Plan Cons', fmtCons(f.consumption_plan) + unit],
                ['Actual Cons', fmtCons(f.actual_consumption) + unit],
                ['Budget Cap (3%)', f.consumption_plan != null ? fmtCons(f.consumption_plan * 1.03) + unit : '—'],
                ['Overconsumption', fmtPercent(f.overconsumption)],
              ];

              return (
                <div key={f.id || idx} style={{ display: 'flex', flexDirection: 'column', borderTop: idx === 0 ? '1px solid #E2E8F0' : 'none', paddingTop: '3.5px', paddingBottom: '3.5px' }}>
                  {/* First row: Label & Fabric tracking data */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: '20px', paddingLeft: '2px' }}>
                    {f.label && <span style={{ whiteSpace: 'nowrap', fontWeight: 700, color: '#334155' }} title={f.label}>{shortLabel(f.label)}</span>}
                    {fabricPairs.map(([k, v]) => (
                      <span key={k} style={{ whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 600, color: '#64748B' }}>{k}:</span>{v !== '' ? ` ${v}` : ''}
                      </span>
                    ))}
                  </div>
                  {/* Second row: Consumption data beneath it */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: '20px', paddingLeft: '2px', marginTop: '1px' }}>
                    <span style={{ whiteSpace: 'nowrap', color: '#94A3B8', fontWeight: 600, marginRight: '4px', paddingLeft: '8px' }}>↳</span>
                    {consPairs.map(([k, v]) => (
                      <span key={k} style={{ whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 600, color: '#64748B' }}>{k}:</span>{v !== '' ? ` ${v}` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Section 4: Deductions & Remarks */}
      <div className="print-section-title">4. Deductions & Remarks</div>
      {(() => {
        const deductions = calculateDeductions(activePackagingProject, activeSession);
        const {
          penaltyPrice,
          exceedingRejectQty,
          sumBarangHilang: totalBarangHilang,
          rejectProduksiPenalty,
          barangHilangPenalty,
          totalDeduction
        } = deductions;

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
              {(() => {
                const manualLines: any[] = activeSession.deduction_lines || [];
                const fabricLines: any[] = activePackagingProject.fabric_lines || [];
                const fabricDeductionLines = fabricLines.filter((f: any) => f.deduction != null && f.deduction > 0);
                const manualTotal = manualLines.reduce((sum: number, l: any) => sum + (l.amount || 0), 0);
                const fabricDeductionTotal = fabricDeductionLines.reduce((sum: number, f: any) => sum + (f.deduction || 0), 0);
                const grandTotal = totalDeduction + manualTotal + fabricDeductionTotal;
                const hasAny = exceedingRejectQty > 0 || totalBarangHilang > 0 || manualLines.length > 0 || fabricDeductionLines.length > 0;
                if (!hasAny) return (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: '#94A3B8', padding: '8px' }}>
                      No deductions & remarks logged for this session.
                    </td>
                  </tr>
                );
                return (
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
                    {fabricDeductionLines.map((f: any) => (
                      <tr key={f.id}>
                        <td title={f.label || ''}>Fabric Overconsumption{f.label ? ` — ${(() => { const s = f.label; return !s || s.length <= 42 ? s : `${s.slice(0, 28).trimEnd()} ... ${s.slice(-13).trimStart()}`; })()}` : ''}</td>
                        <td style={{ textAlign: 'center' }}>
                          {f.fabric_price != null ? `Rp ${Math.round(f.fabric_price).toLocaleString('id-ID')} /${(f.label?.match(/\(([A-Z]+)\)\s*$/)?.[1] ?? 'unit').toLowerCase()}` : '—'}
                        </td>
                        <td>
                          {f.overconsumption != null ? `${(f.overconsumption * 100).toFixed(2)}% overconsumption` : '—'}
                        </td>
                        <td style={{ textAlign: 'center' }}>—</td>
                        <td style={{ textAlign: 'center' }}>Rp {Math.round(f.deduction).toLocaleString('id-ID')}</td>
                      </tr>
                    ))}
                    {manualLines.map((line: any) => (
                      <tr key={line.id}>
                        <td>{line.description}</td>
                        <td style={{ textAlign: 'center' }}>—</td>
                        <td>{line.created_by ? `Added by ${line.created_by}` : '—'}</td>
                        <td style={{ textAlign: 'center' }}>—</td>
                        <td style={{ textAlign: 'center' }}>Rp {Math.round(line.amount).toLocaleString('id-ID')}</td>
                      </tr>
                    ))}
                    <tr style={{ fontWeight: 'bold', backgroundColor: '#F8FAFC' }}>
                      <td colSpan={4} style={{ textAlign: 'right', paddingRight: '15px' }}>Total Deductions</td>
                      <td style={{ textAlign: 'center' }}>Rp {Math.round(grandTotal).toLocaleString('id-ID')}</td>
                    </tr>
                  </>
                );
              })()}
            </tbody>
          </table>
        );
      })()}

      {/* Remarks row — below deductions table */}
      <div style={{ fontSize: '0.6rem', color: '#334155', marginBottom: '6px', paddingLeft: '2px' }}>
        <span style={{ fontWeight: 700 }}>Remarks: </span>
        <span style={{ color: activePackagingProject.remarks ? '#0F172A' : '#94A3B8', fontStyle: activePackagingProject.remarks ? 'normal' : 'italic' }}>
          {activePackagingProject.remarks || 'none'}
        </span>
      </div>

        </div>{/* end print-content-zone */}

      {/* Section 5: Conclusions */}
      <div className="print-section-title">5. Conclusions</div>
      <div className="print-signatures-container" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1fr', gap: '8px', width: 'calc(100% - 4px)', boxSizing: 'border-box' }}>
        <div className={`print-result-block ${(activeSession.result || 'pending').toLowerCase()}`}>
          <span className="print-result-title">∴ Overall Inspection Result</span>
          <span className={`print-result-value ${(activeSession.result || 'pending').toLowerCase()}`}>
            {activeSession.result ? activeSession.result.toUpperCase() : 'PENDING'}
          </span>
        </div>
        
        {/* Box 1: Inspected By */}
        <div className="print-signature-box">
          <span className="print-signature-label">Inspected By</span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, margin: '2px 0' }}>
            <div style={{
              border: '1px solid #10B981',
              borderRadius: '4px',
              padding: '1px 3.5px',
              fontSize: '0.38rem',
              fontWeight: 800,
              color: '#10B981',
              background: 'rgba(16, 185, 129, 0.05)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2px',
              marginBottom: '1px',
              lineHeight: '1'
            }}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '2px', display: 'inline-block', verticalAlign: 'middle' }}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Digitally Signed
            </div>
            {activeSession.inspector_email && (
              <span style={{ fontSize: '0.35rem', color: '#64748B', fontWeight: 600, maxWidth: '75px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }} title={activeSession.inspector_email}>
                {activeSession.inspector_email}
              </span>
            )}
            <span style={{ fontSize: '0.35rem', color: '#64748B', fontWeight: 600 }}>
              {convertToUTC7(activeSession.ended_at || activeSession.started_at)}
            </span>
          </div>
          <div className="print-signature-name" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', borderTop: '1px dashed #CBD5E1', paddingTop: '3px', marginTop: 'auto', width: '100%', boxSizing: 'border-box' }}>
            {activeSession.inspector && (
              <span style={{ fontSize: '0.52rem', fontWeight: 700, color: '#0F172A', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                {activeSession.inspector}
              </span>
            )}
            <span style={{ fontSize: '0.4rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em', marginTop: '1px', lineHeight: 1 }}>
              Inspector
            </span>
          </div>
        </div>

        {/* Box 2: Confirmed By */}
        {(() => {
          const sig = (() => {
            if (activeSession.approval_status === 'approved') {
              return {
                isSigned: true,
                isRejected: false,
                name: activeSession.approved_by || activeSession.approval_email || 'Representative',
                email: activeSession.approval_email || '',
                date: activeSession.approved_at ? convertToUTC7(activeSession.approved_at) : ''
              };
            } else if (activeSession.approval_status === 'rejected') {
              return {
                isSigned: false,
                isRejected: true,
                name: activeSession.approved_by || activeSession.approval_email || 'Representative',
                email: activeSession.approval_email || '',
                date: activeSession.approved_at ? convertToUTC7(activeSession.approved_at) : ''
              };
            }
            return parseSignature(activeSession.approval_signature);
          })();
          // Footer shows the PERSON (the name the inspector typed in the console);
          // the stamp shows the approval email the decision came from.
          const factoryName = activeSession.factory_representative || sig.name;
          const hasFactoryName = !!factoryName;
          return (
            <div className="print-signature-box">
              <span className="print-signature-label">Confirmed By</span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, margin: '2px 0' }}>
                {sig.isSigned ? (
                  <>
                    <div style={{
                      border: '1px solid #10B981',
                      borderRadius: '4px',
                      padding: '1px 3.5px',
                      fontSize: '0.38rem',
                      fontWeight: 800,
                      color: '#10B981',
                      background: 'rgba(16, 185, 129, 0.05)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '2px',
                      marginBottom: '1px',
                      lineHeight: '1'
                    }}>
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '2px', display: 'inline-block', verticalAlign: 'middle' }}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Digitally Signed
                    </div>
                    <span style={{ fontSize: '0.35rem', color: '#64748B', fontWeight: 600, maxWidth: '75px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }} title={sig.email || sig.name}>
                      {sig.email || sig.name}
                    </span>
                    <span style={{ fontSize: '0.32rem', color: '#64748B' }}>
                      {sig.date}
                    </span>
                  </>
                ) : sig.isRejected ? (
                  <>
                    <div style={{
                      border: '1px solid #EF4444',
                      borderRadius: '4px',
                      padding: '1px 3.5px',
                      fontSize: '0.38rem',
                      fontWeight: 800,
                      color: '#EF4444',
                      background: 'rgba(239, 68, 68, 0.05)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '2px',
                      marginBottom: '1px',
                      lineHeight: '1'
                    }}>
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '2px', display: 'inline-block', verticalAlign: 'middle' }}>
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                      Rejected
                    </div>
                    <span style={{ fontSize: '0.35rem', color: '#64748B', maxWidth: '75px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }} title={sig.email || sig.name}>
                      {sig.email || sig.name}
                    </span>
                    <span style={{ fontSize: '0.32rem', color: '#64748B' }}>
                      {sig.date}
                    </span>
                  </>
                ) : (
                  <span style={{ fontSize: '0.38rem', color: '#94A3B8', fontStyle: 'italic', fontWeight: 500, textAlign: 'center' }}>
                    Awaiting Approval
                  </span>
                )}
              </div>
              <div className="print-signature-name" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', borderTop: '1px dashed #CBD5E1', paddingTop: '3px', marginTop: 'auto', width: '100%', boxSizing: 'border-box' }}>
                {hasFactoryName && (
                  <span style={{ fontSize: '0.52rem', fontWeight: 700, color: '#0F172A', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                    {factoryName}
                  </span>
                )}
                <span style={{ fontSize: '0.4rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em', marginTop: '1px', lineHeight: 1 }}>
                  Factory Representative
                </span>
              </div>
            </div>
          );
        })()}

        {/* Box 3: Approved By (MPG HO - MD Production) */}
        {(() => {
          const hoSigStr = activeSession.ho_approval_signature || '';
          const hoParsed = parseSignature(hoSigStr);
          const hoIsSigned = hoParsed.isSigned;
          const hoIsRejected = hoParsed.isRejected;
          const hoDate = (() => {
            if (!hoParsed.date) return '';
            try { return convertToUTC7(new Date(hoParsed.date.replace(' ', 'T') + '+07:00')); } catch { return hoParsed.date; }
          })();
          const hoName = (hoIsSigned || hoIsRejected) ? hoParsed.name : '';
          return (
            <div className="print-signature-box">
              <span className="print-signature-label">Approved By</span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, margin: '2px 0' }}>
                {(hoIsSigned || hoIsRejected) ? (
                  <>
                    <div style={{ border: `1px solid ${hoIsSigned ? '#10B981' : '#EF4444'}`, borderRadius: '4px', padding: '1px 3.5px', fontSize: '0.38rem', fontWeight: 800, color: hoIsSigned ? '#10B981' : '#EF4444', background: hoIsSigned ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.06)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'inline-flex', alignItems: 'center', gap: '2px', marginBottom: '1px', lineHeight: '1' }}>
                      {hoIsSigned ? (
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '2px', display: 'inline-block', verticalAlign: 'middle' }}><polyline points="20 6 9 17 4 12" /></svg>
                      ) : (
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '2px', display: 'inline-block', verticalAlign: 'middle' }}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      )}
                      {hoIsSigned ? 'Digitally Signed' : 'Rejected'}
                    </div>
                    <span style={{ fontSize: '0.35rem', color: '#64748B', fontWeight: 600, maxWidth: '75px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }} title={hoParsed.email || hoName}>
                      {hoParsed.email || hoName || 'MPG HO - MD Production'}
                    </span>
                    {hoDate && <span style={{ fontSize: '0.32rem', color: '#64748B' }}>{hoDate}</span>}
                  </>
                ) : (
                  <span style={{ fontSize: '0.38rem', color: '#94A3B8', fontStyle: 'italic', fontWeight: 500, textAlign: 'center' }}>
                    Awaiting Approval
                  </span>
                )}
              </div>
              <div className="print-signature-name" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', borderTop: '1px dashed #CBD5E1', paddingTop: '3px', marginTop: 'auto', width: '100%', boxSizing: 'border-box' }}>
                {hoName && (
                  <span style={{ fontSize: '0.52rem', fontWeight: 700, color: '#0F172A', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                    {hoName}
                  </span>
                )}
                <span style={{ fontSize: '0.4rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em', marginTop: '1px', lineHeight: 1 }}>
                  MPG HO - MD Production
                </span>
              </div>
            </div>
          );
        })()}

        {/* Box 4: Authorized By (Director) — populated from director_approval_signature
            (same 'Digitally Signed:'/'Rejected:' prefix contract as the HO column) */}
        {(() => {
          const dirSigStr = activeSession.director_approval_signature || '';
          const dirParsed = parseSignature(dirSigStr);
          const dirIsSigned = dirParsed.isSigned;
          const dirIsRejected = dirParsed.isRejected;
          const dirDate = (() => {
            if (!dirParsed.date) return '';
            try { return convertToUTC7(new Date(dirParsed.date.replace(' ', 'T') + '+07:00')); } catch { return dirParsed.date; }
          })();
          const dirName = (dirIsSigned || dirIsRejected) ? dirParsed.name : '';
          return (
            <div className="print-signature-box">
              <span className="print-signature-label">Authorized By</span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, margin: '2px 0' }}>
                {(dirIsSigned || dirIsRejected) ? (
                  <>
                    <div style={{ border: `1px solid ${dirIsSigned ? '#10B981' : '#EF4444'}`, borderRadius: '4px', padding: '1px 3.5px', fontSize: '0.38rem', fontWeight: 800, color: dirIsSigned ? '#10B981' : '#EF4444', background: dirIsSigned ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.06)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'inline-flex', alignItems: 'center', gap: '2px', marginBottom: '1px', lineHeight: '1' }}>
                      {dirIsSigned ? (
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '2px', display: 'inline-block', verticalAlign: 'middle' }}><polyline points="20 6 9 17 4 12" /></svg>
                      ) : (
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '2px', display: 'inline-block', verticalAlign: 'middle' }}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      )}
                      {dirIsSigned ? 'Digitally Signed' : 'Rejected'}
                    </div>
                    <span style={{ fontSize: '0.35rem', color: '#64748B', fontWeight: 600, maxWidth: '75px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }} title={dirParsed.email || dirName}>
                      {dirParsed.email || dirName}
                    </span>
                    {dirDate && <span style={{ fontSize: '0.32rem', color: '#64748B' }}>{dirDate}</span>}
                  </>
                ) : (
                  <span style={{ fontSize: '0.38rem', color: '#94A3B8', fontStyle: 'italic', fontWeight: 500, textAlign: 'center' }}>
                    Awaiting Authorization
                  </span>
                )}
              </div>
              <div className="print-signature-name" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', borderTop: '1px dashed #CBD5E1', paddingTop: '3px', marginTop: 'auto', width: '100%', boxSizing: 'border-box' }}>
                {dirName && (
                  <span style={{ fontSize: '0.52rem', fontWeight: 700, color: '#0F172A', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                    {dirName}
                  </span>
                )}
                <span style={{ fontSize: '0.4rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em', marginTop: '1px', lineHeight: 1 }}>
                  Director
                </span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Print Footer Info */}
      <div className="print-footer-info">
        <span>Distribution by email: 1. Factory  2. MD Prod  3. PPIC/Finance  4. QA MP</span>
        <span>☞ This is an auto-generated document. Final Inspection QC [{convertToUTC7(new Date())} WIB]</span>
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
