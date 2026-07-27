import { invoke } from '@tauri-apps/api/core';

export class PackagingService {
  private static instance: PackagingService | null = null;
  private STORAGE_KEY_REMOVALS = 'packaging_offline_removals';
  private cachedProjects: any[] = [];
  // Only this project's verified_doc (its multi-MB base64 PDF) is allowed to
  // survive a cache write — see saveStoredProjects(). Every other cached
  // project keeps its lightweight summary fields only.
  private activeProjectId: string | null = null;

  private constructor() {}

  public setActiveProjectId(id: string | null): void {
    this.activeProjectId = id;
  }

  public static getInstance(): PackagingService {
    if (!PackagingService.instance) {
      PackagingService.instance = new PackagingService();
    }
    return PackagingService.instance;
  }

  // --- PAYLOAD SANITIZATION HELPERS ---

  public sanitizeProject(project: any): any {
    if (!project) return project;
    const p = { ...project };
    if (p.brand === undefined || p.brand === null) {
      p.brand = 'N/A';
    }
    if (p.season === undefined || p.season === null) {
      p.season = 'N/A';
    }
    if (p.article_name === undefined || p.article_name === null) {
      p.article_name = 'N/A';
    }
    if (p.production_group === undefined || p.production_group === null) {
      p.production_group = 'N/A';
    }
    if (p.po_qty === '' || p.po_qty === null || p.po_qty === undefined) {
      p.po_qty = null;
    } else if (typeof p.po_qty === 'string') {
      const trimmed = p.po_qty.trim();
      p.po_qty = trimmed === '' ? null : parseFloat(trimmed) || null;
    }
    if (p.sales_price === '' || p.sales_price === null || p.sales_price === undefined) {
      p.sales_price = null;
    } else if (typeof p.sales_price === 'string') {
      const trimmed = p.sales_price.trim();
      p.sales_price = trimmed === '' ? null : parseFloat(trimmed) || null;
    }
    if (p.has_deduction === undefined || p.has_deduction === null) {
      p.has_deduction = false;
    }
    if (p.deduction_amount === '' || p.deduction_amount === null || p.deduction_amount === undefined) {
      p.deduction_amount = 0.0;
    } else if (typeof p.deduction_amount === 'string') {
      const trimmed = p.deduction_amount.trim();
      p.deduction_amount = trimmed === '' ? 0.0 : parseFloat(trimmed) || 0.0;
    }
    return p;
  }

  public sanitizeSession(session: any): any {
    if (!session) return session;
    const s = { ...session };
    const intFields = [
      'cycle_number', 'qty_available', 'total_store', 'store_inspected',
      'cutting_pcs', 'sewing_pcs', 'finishing_pcs', 'packing_pcs', 'sampling_pcs'
    ];
    const floatFields = ['aql', 'level_val'];

    // retur_kain stays nullable: empty/unset means "not entered" (null), which the
    // portal treats as "keep the vendor value" — so it must NOT be coerced to 0.
    {
      let rk = s.retur_kain;
      if (typeof rk === 'string') rk = rk.trim();
      s.retur_kain = (rk === '' || rk === null || rk === undefined) ? null : (Number(rk) || 0);
    }

    intFields.forEach(f => {
      let val = s[f];
      if (typeof val === 'string') {
        val = val.trim();
      }
      if (val === '' || val === null || val === undefined) {
        s[f] = 0;
      } else if (typeof val === 'string') {
        s[f] = parseInt(val, 10) || 0;
      } else {
        s[f] = Number(val) || 0;
      }
    });

    floatFields.forEach(f => {
      let val = s[f];
      if (typeof val === 'string') {
        val = val.trim();
      }
      if (val === '' || val === null || val === undefined) {
        s[f] = 0.0;
      } else if (typeof val === 'string') {
        s[f] = parseFloat(val) || 0.0;
      } else {
        s[f] = Number(val) || 0.0;
      }
    });

    if (s.check_other_1 === undefined || s.check_other_1 === null) {
      s.check_other_1 = false;
    }
    if (s.check_other_2 === undefined || s.check_other_2 === null) {
      s.check_other_2 = false;
    }
    if (s.check_other_1_label === undefined) {
      s.check_other_1_label = '';
    }
    if (s.check_other_2_label === undefined) {
      s.check_other_2_label = '';
    }

    if (s.report_lines && Array.isArray(s.report_lines)) {
      s.report_lines = s.report_lines.map((line: any) => this.sanitizeReportLine(line));
    }

    return s;
  }

  public sanitizeReportLine(line: any): any {
    if (!line) return line;
    const l = { ...line };
    const intFields = [
      'line_no', 'global_display_order', 'reject_produksi', 'reject_finishing',
      'reject_embro', 'qty_order', 'total_qty_sample', 'barang_hilang',
      'reject_cutting', 'total_reject_qty', 'reject_printing', 'total_good_qty',
      'reject_sewing', 'reject_washing', 'btj', 'reject_bahan'
    ];
    const floatFields = ['session_qty', 'gramasi'];

    intFields.forEach(f => {
      let val = l[f];
      if (typeof val === 'string') {
        val = val.trim();
      }
      if (val === '' || val === null || val === undefined) {
        l[f] = null;
      } else if (typeof val === 'string') {
        l[f] = parseInt(val, 10) || 0;
      } else {
        l[f] = Number(val) || 0;
      }
    });

    floatFields.forEach(f => {
      let val = l[f];
      if (typeof val === 'string') {
        val = val.trim();
      }
      if (val === '' || val === null || val === undefined) {
        l[f] = 0.0;
      } else if (typeof val === 'string') {
        l[f] = parseFloat(val) || 0.0;
      } else {
        l[f] = Number(val) || 0.0;
      }
    });

    return l;
  }

  public sanitizeDefectImage(image: any): any {
    if (!image) return image;
    const img = { ...image };
    const intFields = ['major', 'minor'];
    intFields.forEach(f => {
      let val = img[f];
      if (typeof val === 'string') {
        val = val.trim();
      }
      if (val === '' || val === null || val === undefined) {
        img[f] = 0;
      } else if (typeof val === 'string') {
        img[f] = parseInt(val, 10) || 0;
      } else {
        img[f] = Number(val) || 0;
      }
    });
    return img;
  }

  // --- DISK CACHE GETTERS/SETTERS ---

  public async loadCacheFromDisk(): Promise<any[]> {
    try {
      const stored = await invoke<any[]>('read_offline_projects_cache');
      this.cachedProjects = stored || [];
      return this.cachedProjects;
    } catch (e) {
      console.error('Failed to load cache from disk:', e);
      return [];
    }
  }

  public getStoredProjects(): any[] {
    return this.cachedProjects;
  }

  public async saveStoredProjects(projects: any[]): Promise<void> {
    // Strip verified_doc (the multi-MB base64 PDF) from every project except
    // whichever one is currently open. Without this, the offline cache would
    // accumulate a full PDF for every project ever opened and re-load all of
    // them into memory on every app launch — the PDF should only ever be
    // resident for the project you actually have open right now.
    const pruned = projects.map((p: any) => {
      if (p && p.project_id !== this.activeProjectId && Object.prototype.hasOwnProperty.call(p, 'verified_doc')) {
        const { verified_doc, ...rest } = p;
        return rest;
      }
      return p;
    });
    this.cachedProjects = pruned;
    try {
      await invoke('write_offline_projects_cache', { data: pruned });
    } catch (e) {
      console.error('Failed to write projects cache to disk:', e);
    }
  }

  public getStoredRemovals(): string[] {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(this.STORAGE_KEY_REMOVALS);
    return stored ? JSON.parse(stored) : [];
  }

  public saveStoredRemovals(removals: string[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.STORAGE_KEY_REMOVALS, JSON.stringify(removals));
  }

  // --- CACHE MUTATIONS ---

  public async updateCacheMutation(cmd: string, args: Record<string, any>, synced: boolean): Promise<void> {
    if (cmd === 'save_packaging_project' && args.project) {
      const projects = this.getStoredProjects();
      const p = args.project;
      const index = projects.findIndex(item => item.project_id === p.project_id);
      const newProj = {
        ...p,
        synced,
        base_report: p.base_report !== undefined ? p.base_report : (index >= 0 ? (projects[index].base_report || null) : null),
        base_lines: p.base_lines !== undefined ? p.base_lines : (index >= 0 ? (projects[index].base_lines || []) : []),
        sessions: p.sessions !== undefined ? p.sessions : (index >= 0 ? (projects[index].sessions || []) : []),
        defect_images: p.defect_images !== undefined ? p.defect_images : (index >= 0 ? (projects[index].defect_images || []) : [])
      };
      if (index >= 0) {
        projects[index] = { ...projects[index], ...newProj };
      } else {
        projects.push(newProj);
      }
      await this.saveStoredProjects(projects);
    }

    if (cmd === 'save_packaging_session' && args.session) {
      const projects = this.getStoredProjects();
      const ses = args.session;
      const index = projects.findIndex(item => item.project_id === ses.project_id);
      if (index >= 0) {
        const sIndex = (projects[index].sessions || []).findIndex((s: any) => s.session_id === ses.session_id);
        const newSession = { ...ses, synced };
        if (sIndex >= 0) {
          projects[index].sessions[sIndex] = { ...projects[index].sessions[sIndex], ...newSession };
        } else {
          if (!projects[index].sessions) projects[index].sessions = [];
          projects[index].sessions.push(newSession);
        }
        projects[index].synced = synced;
        await this.saveStoredProjects(projects);
      }
    }

    if (cmd === 'save_packaging_defect_image' && args.image) {
      const projects = this.getStoredProjects();
      const img = args.image;
      const index = projects.findIndex(item => item.project_id === img.project_id);
      if (index >= 0) {
        if (!projects[index].defect_images) projects[index].defect_images = [];
        const imgIndex = projects[index].defect_images.findIndex((d: any) => d.image_id === img.image_id);
        const newImage = { ...img, synced };
        if (imgIndex >= 0) {
          projects[index].defect_images[imgIndex] = newImage;
        } else {
          projects[index].defect_images.push(newImage);
        }
        projects[index].synced = synced;
        await this.saveStoredProjects(projects);
      }
    }

    if (cmd === 'save_packaging_project_reports' && args.reports) {
      const projects = this.getStoredProjects();
      const lines = args.reports;
      if (lines.length > 0) {
        const firstLine = lines[0];
        const index = projects.findIndex(item => item.project_id === firstLine.project_id);
        if (index >= 0) {
          const sid = firstLine.session_id;
          if (sid && sid !== 'INITIAL_PAK') {
            const sIndex = (projects[index].sessions || []).findIndex((s: any) => s.session_id === sid);
            if (sIndex >= 0) {
              projects[index].sessions[sIndex].report_lines = lines.map((l: any) => ({ ...l, synced }));
            }
          } else {
            projects[index].base_lines = lines.map((l: any) => ({ ...l, synced }));
          }
          projects[index].synced = synced;
          await this.saveStoredProjects(projects);
        }
      }
    }

    if (cmd === 'delete_packaging_project') {
      const projects = this.getStoredProjects();
      const pid = args.project_id || args.projectId;
      const targetProj = projects.find(item => item.project_id === pid);
      const filtered = projects.filter(item => item.project_id !== pid);
      await this.saveStoredProjects(filtered);
      
      // Clean up cached initial size report variations to free up storage space
      localStorage.removeItem(`packaging_initial_reports_${pid}`);

      // If the deleted project was already synced to the server and we are offline, track it for future sync
      if (!synced && targetProj && targetProj.synced !== false) {
        const removals = this.getStoredRemovals();
        if (!removals.includes(pid)) {
          removals.push(pid);
          this.saveStoredRemovals(removals);
        }
      }
    }
  }

  // --- OFFLINE-RESILIENT TAURI WRAPPER ---

  public async invokeSafe<T>(cmd: string, args: Record<string, any> = {}, fallback: T): Promise<T> {
    // 1. Sanitize payload arguments before invocation to prevent Serde type errors on empty strings
    const sanitizedArgs = { ...args };
    if (sanitizedArgs.project) {
      sanitizedArgs.project = this.sanitizeProject(sanitizedArgs.project);
    }
    if (sanitizedArgs.session) {
      sanitizedArgs.session = this.sanitizeSession(sanitizedArgs.session);
    }
    if (sanitizedArgs.reports && Array.isArray(sanitizedArgs.reports)) {
      sanitizedArgs.reports = sanitizedArgs.reports.map(r => this.sanitizeReportLine(r));
    }
    if (sanitizedArgs.image) {
      sanitizedArgs.image = this.sanitizeDefectImage(sanitizedArgs.image);
    }

    try {
      const res = await invoke<T>(cmd, sanitizedArgs);
      // Cache successful queries
      if (cmd === 'get_packaging_projects' || cmd === 'get_packaging_projects_summary') {
        // Merge summary into existing detail cache.
        // Block-list detail-only arrays so a future schema change on the Rust side
        // can never silently wipe session/line data with a null from a summary row.
        const DETAIL_ONLY_KEYS = new Set(['sessions', 'base_lines', 'report_lines', 'defect_images']);
        const summaryList = res as unknown as any[];
        const existing = this.getStoredProjects();
        const merged = summaryList.map((s: any) => {
          const prev = existing.find((e: any) => e.project_id === s.project_id);
          if (!prev) return s;
          const safeSummaryFields = Object.fromEntries(
            Object.entries(s).filter(([k]) => !DETAIL_ONLY_KEYS.has(k))
          );
          return { ...prev, ...safeSummaryFields };
        });
        await this.saveStoredProjects(merged);
      } else if (cmd === 'get_packaging_project_details') {
        const detailProj = res as any;
        // This is the one project allowed to keep its verified_doc in the cache —
        // set it before saveStoredProjects() so its own PDF isn't pruned out.
        this.activeProjectId = detailProj.project_id;
        const projects = this.getStoredProjects();
        const index = projects.findIndex(item => item.project_id === detailProj.project_id);
        if (index >= 0) {
          projects[index] = { ...projects[index], ...detailProj };
        } else {
          projects.push(detailProj);
        }
        await this.saveStoredProjects(projects);
      } else if (cmd === 'get_packaging_project_reports' && (sanitizedArgs.session_id === 'INITIAL_PAK' || sanitizedArgs.sessionId === 'INITIAL_PAK')) {
        const pid = sanitizedArgs.project_id || sanitizedArgs.projectId;
        localStorage.setItem(`packaging_initial_reports_${pid}`, JSON.stringify(res));
      } else {
        await this.updateCacheMutation(cmd, sanitizedArgs, true);
      }
      return res;
    } catch (e: any) {
      const errStr = String(e || '');
      const isConnectionError = errStr.includes('Failed to connect') || errStr.includes('timeout') || errStr.includes('connection');
      if (!isConnectionError && cmd !== 'get_packaging_projects' && cmd !== 'get_packaging_projects_summary' && cmd !== 'get_packaging_project_details' && cmd !== 'get_packaging_project_reports') {
        console.error(`Tauri invoke '${cmd}' database execution error:`, e);
        throw e;
      }

      console.warn(`Tauri invoke '${cmd}' failed or offline. Using local safety store fallback:`, e);

      if (cmd === 'get_packaging_projects' || cmd === 'get_packaging_projects_summary') {
        return this.getStoredProjects() as unknown as T;
      }

      if (cmd === 'get_packaging_project_details') {
        const pid = sanitizedArgs.project_id || sanitizedArgs.projectId;
        const localDetails = this.getStoredProjects().find(p => p.project_id === pid);
        return (localDetails || fallback) as unknown as T;
      }

      if (cmd === 'get_packaging_project_reports' && (sanitizedArgs.session_id === 'INITIAL_PAK' || sanitizedArgs.sessionId === 'INITIAL_PAK')) {
        const pid = sanitizedArgs.project_id || sanitizedArgs.projectId;
        const stored = localStorage.getItem(`packaging_initial_reports_${pid}`);
        return (stored ? JSON.parse(stored) : fallback) as unknown as T;
      }

      await this.updateCacheMutation(cmd, sanitizedArgs, false);
      return fallback;
    }
  }
}
