import { invoke } from '@tauri-apps/api/core';

// Heavy fields only meaningful for a project that's actually open right now: base_lines/
// base_report/defect_images (defect photos average ~230KB each as base64 and routinely add up to
// hundreds of MB across a company's full project history), plus each session's report_lines and
// deduction_lines. The top-level `sessions` array itself is NOT in this list — its lightweight
// summary shape (cycle_number/status/result/signatures, no line items) is what get_packaging_
// projects_summary already returns for every project cheaply, and features like the AI
// assistant's project list rely on it being present even for projects that aren't open.
const TOP_LEVEL_HEAVY_KEYS = ['base_lines', 'base_report', 'defect_images'] as const;
const SESSION_HEAVY_KEYS = ['report_lines', 'deduction_lines'] as const;

// Commands whose failures (while offline) represent a real write still owed to the server —
// these get recorded in the pending-operations queue so SyncEngine can replay them later.
const WRITE_COMMANDS = new Set([
  'save_packaging_project',
  'save_packaging_session',
  'save_packaging_project_reports',
  'save_packaging_defect_image',
  'delete_packaging_project',
]);

export class PackagingService {
  private static instance: PackagingService | null = null;
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

  private stripDetail(p: any): any {
    if (!p) return p;
    const rest = { ...p };
    if (Object.prototype.hasOwnProperty.call(rest, 'verified_doc')) delete rest.verified_doc;
    for (const key of TOP_LEVEL_HEAVY_KEYS) {
      if (Object.prototype.hasOwnProperty.call(rest, key)) delete rest[key];
    }
    // Keep the sessions array itself (cheap, needed for project-list/status features) but drop
    // each session's heavy nested line-item arrays.
    if (Array.isArray(rest.sessions)) {
      rest.sessions = rest.sessions.map((s: any) => {
        if (!s) return s;
        const hasHeavyKey = SESSION_HEAVY_KEYS.some(key => Object.prototype.hasOwnProperty.call(s, key));
        if (!hasHeavyKey) return s;
        const sessionRest = { ...s };
        for (const key of SESSION_HEAVY_KEYS) delete sessionRest[key];
        return sessionRest;
      });
    }
    return rest;
  }

  public async loadCacheFromDisk(): Promise<any[]> {
    try {
      const stored = await invoke<any[]>('read_offline_projects_cache');
      // Nothing is "active" yet at launch, and a user only ever has one project open at a time —
      // so nothing needs full detail resident yet. Pending offline writes are tracked separately
      // in the operations queue (see getPendingOperations), not by keeping whole project trees
      // around, so this stays a plain strip regardless of sync state. Without this, every project
      // this device has ever downloaded would get its full sessions + base64 defect images loaded
      // into memory on every single app launch, whether or not it's still relevant.
      this.cachedProjects = (stored || []).map((p: any) => this.stripDetail(p));
      return this.cachedProjects;
    } catch (e) {
      console.error('Failed to load cache from disk:', e);
      return [];
    }
  }

  public getStoredProjects(): any[] {
    return this.cachedProjects;
  }

  // Load one project's full offline record on demand from disk — used when reopening a
  // previously-downloaded, fully-synced project while offline, since its in-memory copy is
  // intentionally summary-only (see loadCacheFromDisk/saveStoredProjects).
  public async loadProjectDetailFromDisk(projectId: string): Promise<any | null> {
    try {
      const detail = await invoke<any>('read_offline_project_detail', { projectId });
      return detail || null;
    } catch (e) {
      console.error('Failed to read project detail from disk:', e);
      return null;
    }
  }

  public async saveStoredProjects(projects: any[]): Promise<void> {
    // Disk keeps full detail (sessions/report lines/defect images/verified_doc) for the active
    // project and anything this device actually downloaded for offline work — that's what makes
    // offline reopen possible at all. Everything else (projects merely summary-listed from
    // get_packaging_projects_summary, or briefly viewed once) is pruned to lightweight summary
    // fields before it ever touches disk.
    let deviceProjectIds: string[] = [];
    if (typeof window !== 'undefined') {
      try {
        deviceProjectIds = JSON.parse(localStorage.getItem('packaging_device_downloaded_projects') || '[]');
      } catch { /* corrupt/missing — treat as empty */ }
    }

    const diskPruned = projects.map((p: any) => {
      if (!p) return p;
      const keepOnDisk = p.project_id === this.activeProjectId || deviceProjectIds.includes(p.project_id);
      return keepOnDisk ? p : this.stripDetail(p);
    });
    try {
      await invoke('write_offline_projects_cache', { data: diskPruned });
    } catch (e) {
      console.error('Failed to write projects cache to disk:', e);
    }

    // In-memory residency is stricter than the disk copy: ONLY the currently open project stays
    // full-detail resident — a user only ever has one project open at a time, so RAM is bounded
    // to exactly that, regardless of how many other projects this device has downloaded or how
    // many of them have pending offline edits. Pending edits themselves are never lost: they live
    // in the operations queue (see getPendingOperations), a compact list of the actual writes
    // still owed to the server, decoupled from these bulky project trees. A project that's fully
    // synced or not currently open has no reason to keep its images pinned in RAM — it'll be
    // re-hydrated from disk (or the server) if reopened.
    this.cachedProjects = diskPruned.map((p: any) => {
      if (!p || p.project_id === this.activeProjectId) return p;
      return this.stripDetail(p);
    });
  }

  // --- OFFLINE OPERATIONS QUEUE ---
  // The authoritative record of writes still owed to the server. Populated by invokeSafe()
  // whenever a mutating command fails while offline; drained in order by SyncEngine once back
  // online. Kept as its own small file (not derived from the project cache) specifically so
  // tracking "what's unsynced" never requires keeping full project trees resident in memory.

  public async getPendingOperations(): Promise<Array<{ id: string; cmd: string; args: Record<string, any>; queuedAt: string }>> {
    try {
      const queue = await invoke<any[]>('read_offline_operations_queue');
      return queue || [];
    } catch (e) {
      console.error('Failed to read pending operations queue:', e);
      return [];
    }
  }

  public async savePendingOperations(queue: Array<{ id: string; cmd: string; args: Record<string, any>; queuedAt: string }>): Promise<void> {
    try {
      await invoke('write_offline_operations_queue', { data: queue });
    } catch (e) {
      console.error('Failed to write pending operations queue:', e);
    }
  }

  // Serializes read-modify-write access to the queue file. Several offline writes can be
  // in-flight at once — e.g. handleUpdateSavedDefect fires save_packaging_defect_image without
  // awaiting it — so two enqueueOperation calls (or an enqueue racing a drain) could otherwise
  // both read the queue before either writes, and the second write silently clobbers the first,
  // dropping a queued edit. Chaining every queue mutation through this one promise makes them
  // run strictly one at a time regardless of call order.
  private queueLock: Promise<void> = Promise.resolve();

  private withQueueLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queueLock.then(fn, fn);
    this.queueLock = run.then(() => undefined, () => undefined);
    return run;
  }

  public enqueueOperation(cmd: string, args: Record<string, any>): Promise<void> {
    return this.withQueueLock(async () => {
      const queue = await this.getPendingOperations();
      queue.push({
        id: `${cmd}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        cmd,
        args,
        queuedAt: new Date().toISOString(),
      });
      await this.savePendingOperations(queue);
    });
  }

  // Drains the queue under the same lock as enqueueOperation, so nothing enqueued mid-drain can
  // be overwritten by the drain's own final write. `replay` is called once per queued op, in
  // order; ops it throws on stay queued for the next sync attempt, everything else is removed.
  public drainPendingOperations(replay: (op: { id: string; cmd: string; args: Record<string, any>; queuedAt: string }) => Promise<void>): Promise<void> {
    return this.withQueueLock(async () => {
      const queue = await this.getPendingOperations();
      const remaining: typeof queue = [];
      for (const op of queue) {
        try {
          await replay(op);
        } catch (e) {
          console.error(`Failed to sync queued operation ${op.cmd} (${op.id}):`, e);
          remaining.push(op);
        }
      }
      await this.savePendingOperations(remaining);
    });
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
      const filtered = projects.filter(item => item.project_id !== pid);
      await this.saveStoredProjects(filtered);

      // Clean up cached initial size report variations to free up storage space
      localStorage.removeItem(`packaging_initial_reports_${pid}`);

      // Whether this needs to be replayed against the server while offline is tracked by the
      // pending-operations queue (see invokeSafe's catch block), not here.
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
        // The in-memory copy may be summary-only (see loadCacheFromDisk/saveStoredProjects) if
        // this project is fully synced and isn't the one currently open — re-hydrate its full
        // detail straight from disk rather than returning a partial object.
        const diskDetails = await this.loadProjectDetailFromDisk(pid);
        const localDetails = diskDetails || this.getStoredProjects().find(p => p.project_id === pid);
        if (localDetails) this.activeProjectId = pid;
        return (localDetails || fallback) as unknown as T;
      }

      if (cmd === 'get_packaging_project_reports' && (sanitizedArgs.session_id === 'INITIAL_PAK' || sanitizedArgs.sessionId === 'INITIAL_PAK')) {
        const pid = sanitizedArgs.project_id || sanitizedArgs.projectId;
        const stored = localStorage.getItem(`packaging_initial_reports_${pid}`);
        return (stored ? JSON.parse(stored) : fallback) as unknown as T;
      }

      await this.updateCacheMutation(cmd, sanitizedArgs, false);
      if (WRITE_COMMANDS.has(cmd)) {
        // Record the actual write that still needs to reach the server. updateCacheMutation
        // above already updated the local view cache so the UI reflects the edit immediately —
        // this queue entry is the separate, compact record SyncEngine drains once back online.
        await this.enqueueOperation(cmd, sanitizedArgs);
      }
      return fallback;
    }
  }
}
