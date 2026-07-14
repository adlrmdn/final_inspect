import { DatabaseService } from './database_service';
import { PackagingService } from './packaging_service';

export type SyncListener = (pendingCount: number, isSyncing: boolean) => void;

export class SyncEngine {
  private static instance: SyncEngine | null = null;
  private dbService: DatabaseService;
  private listeners: Set<SyncListener> = new Set();
  
  private isSyncing = false;
  private isOnline = true;

  private constructor() {
    this.dbService = DatabaseService.getInstance();
    this.setupNetworkMonitoring();
  }

  public static getInstance(): SyncEngine {
    if (!SyncEngine.instance) {
      SyncEngine.instance = new SyncEngine();
    }
    return SyncEngine.instance;
  }

  private setupNetworkMonitoring(): void {
    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine;
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.notifyListeners();
        this.autoSync();
      });
      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.notifyListeners();
      });
    }
  }

  public registerListener(listener: SyncListener): () => void {
    this.listeners.add(listener);
    // Initial call
    listener(this.getPendingCount(), this.isSyncing);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const count = this.getPendingCount();
    this.listeners.forEach(listener => listener(count, this.isSyncing));
  }

  private getUnsyncedPackagingCount(): number {
    if (typeof window === 'undefined') return 0;
    
    let count = 0;

    // Count unsynced items from PackagingService memory cache (backed by local JSON cache)
    const projects = PackagingService.getInstance().getStoredProjects();
    for (const p of projects) {
      if (p.synced === false) count++;
      if (p.sessions) {
        for (const s of p.sessions) {
          if (s.synced === false) count++;
        }
      }
      if (p.defect_images) {
        for (const img of p.defect_images) {
          if (img.synced === false) count++;
        }
      }
    }

    // Count pending removals
    const removals = PackagingService.getInstance().getStoredRemovals();
    count += removals.length;

    return count;
  }

  public getPendingCount(): number {
    return this.dbService.getPendingReports().length + this.getUnsyncedPackagingCount();
  }

  public getOnlineStatus(): boolean {
    return this.isOnline;
  }

  /**
   * Triggers an automatic sync if the client is online and reports are pending.
   */
  public async autoSync(): Promise<void> {
    if (this.isOnline && this.getPendingCount() > 0) {
      await this.synchronize();
    }
  }

  /**
   * Main synchronization routine. Executes the sync sequence over pending records.
   */
  public async synchronize(): Promise<void> {
    if (this.isSyncing) return;
    if (!this.isOnline) {
      throw new Error('Sync failed: Client is currently offline.');
    }

    this.isSyncing = true;
    this.notifyListeners();

    try {
      // Import Tauri invoke dynamically
      const { invoke } = await import('@tauri-apps/api/core');

      // Confirm connection to PostgreSQL
      const pgOnline = await this.dbService.isPostgresOnline();
      if (!pgOnline) {
        throw new Error('Sync failed: Remote PostgreSQL database is unreachable.');
      }

      // 1. Sync standard QC reports
      const pending = this.dbService.getPendingReports();
      for (const report of pending) {
        // Save to central PostgreSQL DB
        await this.dbService.saveReportToPostgres(report);

        // Transition state from Pending -> Synced locally
        report.markSynced();
        this.dbService.saveReport(report);
        this.notifyListeners();
      }

      // 2. Sync offline packaging projects & sessions
      const projects = [...PackagingService.getInstance().getStoredProjects()];

      for (const p of projects) {
        let dirty = false;

        // Sync project header
        if (p.synced === false) {
          try {
            const { base_lines, sessions, defect_images, synced, ...rest } = p;
            await invoke('save_packaging_project', { project: rest });
            p.synced = true;
            dirty = true;
            this.notifyListeners();
          } catch (e) {
            console.error(`Failed to sync project ${p.project_id}:`, e);
          }
        }

        // Sync sessions
        if (p.sessions) {
          for (const s of p.sessions) {
            if (s.synced === false) {
              try {
                const { report_lines, synced, ...rest } = s;
                await invoke('save_packaging_session', { session: rest });
                if (report_lines && report_lines.length > 0) {
                  await invoke('save_packaging_project_reports', { reports: report_lines });
                }
                s.synced = true;
                dirty = true;
                this.notifyListeners();
              } catch (e) {
                console.error(`Failed to sync session ${s.session_id}:`, e);
              }
            }
          }
        }

        // Sync defect images
        if (p.defect_images) {
          for (const img of p.defect_images) {
            if (img.synced === false) {
              try {
                const { synced, ...rest } = img;
                await invoke('save_packaging_defect_image', { image: rest });
                img.synced = true;
                dirty = true;
                this.notifyListeners();
              } catch (e) {
                console.error(`Failed to sync defect image ${img.image_id}:`, e);
              }
            }
          }
        }

        // Persist sync flags once per project, not after every item
        if (dirty) {
          await PackagingService.getInstance().saveStoredProjects(projects);
        }
      }

      // 3. Sync offline packaging project removals
      const removals = PackagingService.getInstance().getStoredRemovals();
      if (removals.length > 0) {
        const remainingRemovals: string[] = [];
        for (const pid of removals) {
          try {
            await invoke('delete_packaging_project', { projectId: pid });
          } catch (e) {
            console.error(`Failed to sync offline deletion for project ${pid}:`, e);
            remainingRemovals.push(pid);
          }
        }
        PackagingService.getInstance().saveStoredRemovals(remainingRemovals);
        this.notifyListeners();
      }
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }
  }

  /**
   * Imports new templates from remote PostgreSQL server
   */
  public async fetchRemoteTemplates(): Promise<void> {
    // Re-assert defaults locally
    this.dbService.initDefaultTemplates();
  }
}
