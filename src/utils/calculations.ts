export interface DeductionResult {
  hasDeduction: boolean;
  deductionAmount: number;
  allowedLimit: number;
  exceedingRejectQty: number;
  rejectProduksiPenalty: number;
  barangHilangPenalty: number;
  totalDeduction: number;
  sumRejectProduksi: number;
  sumCuttingQty: number;
  sumBarangHilang: number;
  penaltyPrice: number;
}

export const calculateDeductions = (project: any, session: any): DeductionResult => {
  if (!project || !session) {
    return {
      hasDeduction: false,
      deductionAmount: 0,
      allowedLimit: 0,
      exceedingRejectQty: 0,
      rejectProduksiPenalty: 0,
      barangHilangPenalty: 0,
      totalDeduction: 0,
      sumRejectProduksi: 0,
      sumCuttingQty: 0,
      sumBarangHilang: 0,
      penaltyPrice: 0,
    };
  }

  const salesPrice = project.sales_price || 0;
  const penaltyPrice = salesPrice * 0.70;
  const reportLines = session.report_lines || [];
  
  let sumRejectProduksi = 0;
  let sumCuttingQty = 0;
  let sumBarangHilang = 0;

  for (const line of reportLines) {
    const rCutting = line.reject_cutting || 0;
    const rSewing = line.reject_sewing || 0;
    const rFinishing = line.reject_finishing || 0;
    const rPrinting = line.reject_printing || 0;
    const rEmbro = line.reject_embro || 0;
    const rWashing = line.reject_washing || 0;
    const rejectProduksi = rCutting + rSewing + rFinishing + rPrinting + rEmbro + rWashing;
    sumRejectProduksi += rejectProduksi;

    const baseLine = (project.base_lines || []).find((bl: any) => bl.size_val === line.size_val);
    const cuttingQty = baseLine ? (baseLine.total_good_qty || 0) : 0;
    sumCuttingQty += cuttingQty;

    sumBarangHilang += (line.barang_hilang || 0);
  }

  const allowedLimit = Math.floor(sumCuttingQty * 0.01);
  const exceedingRejectQty = Math.max(0, sumRejectProduksi - allowedLimit);
  const totalBarangHilang = sumBarangHilang;

  const rejectProduksiPenalty = exceedingRejectQty * penaltyPrice;
  const barangHilangPenalty = totalBarangHilang * penaltyPrice;
  const totalDeduction = rejectProduksiPenalty + barangHilangPenalty;

  return {
    hasDeduction: totalDeduction > 0,
    deductionAmount: totalDeduction,
    allowedLimit,
    exceedingRejectQty,
    rejectProduksiPenalty,
    barangHilangPenalty,
    totalDeduction,
    sumRejectProduksi,
    sumCuttingQty,
    sumBarangHilang,
    penaltyPrice,
  };
};
