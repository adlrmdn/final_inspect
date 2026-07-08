export interface PackagingProjectSummary {
  project_id: string;
  plm_id: string;
  brand: string;
  season: string;
  article_name: string;
  production_group: string;
  po_info: string | null;
  po_qty: number | null;
  po_plan_date: string | null;
  po_vendor: string | null;
  status: 'downloaded' | 'completed' | 'removed';
  cmt_cut_job_id: string | null;
  cmt_pak_job_id: string | null;
  sales_price: number | null;
  has_deduction: boolean;
  deduction_amount: number;
  created_at: string;
  updated_at: string;
  sessions: PackagingSessionSummary[];
}

export interface PackagingSessionSummary {
  session_id: string;
  project_id: string;
  cycle_number: number;
  status: string;
  started_at: string;
  inspection_date: string | null;
  version: string | null;
  result: string | null;
}
