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
    this.getPendingCount().then(count => listener(count, this.isSyncing));
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.getPendingCount().then(count => {
      this.listeners.forEach(listener => listener(count, this.isSyncing));
    });
  }

  // The pending-operations queue lives on disk (see PackagingService), so counting it is async —
  // unlike the old in-memory tree walk this replaces.
  public async getPendingCount(): Promise<number> {
    const queue = typeof window === 'undefined' ? [] : await PackagingService.getInstance().getPendingOperations();
    return this.dbService.getPendingReports().length + queue.length;
  }

  public getOnlineStatus(): boolean {
    return this.isOnline;
  }

  /**
   * Triggers an automatic sync if the client is online and reports are pending.
   */
  public async autoSync(): Promise<void> {
    if (this.isOnline && (await this.getPendingCount()) > 0) {
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

      // 2. Drain the pending-operations queue: the precise record of every packaging write made
      // while offline (project header saves, session saves, report lines, defect images,
      // deletions — see PackagingService.enqueueOperation), replayed in the order they happened.
      // Each entry already carries its exact original, sanitized invoke() args, so this is a
      // faithful replay rather than a reconstruction from whatever the cache looks like now.
      // Draining goes through PackagingService's own lock so a write that fails and gets queued
      // mid-drain can never be clobbered by the drain's own final write-back.
      await PackagingService.getInstance().drainPendingOperations(async (op) => {
        await invoke(op.cmd, op.args);
        if (op.cmd === 'save_packaging_project') {
          // Best-effort: flip the summary-level synced flag if this project happens to be
          // resident in memory right now, purely for the chat assistant's status label.
          const pid = op.args?.project?.project_id;
          const cached = PackagingService.getInstance().getStoredProjects().find((p: any) => p.project_id === pid);
          if (cached) cached.synced = true;
        }
        this.notifyListeners();
      });
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
