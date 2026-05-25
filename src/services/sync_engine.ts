import { DatabaseService } from './database_service';

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

  public getPendingCount(): number {
    return this.dbService.getPendingReports().length;
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
      const pending = this.dbService.getPendingReports();
      for (const report of pending) {
        // Simulate background REST/GraphQL server latency
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Transition state from Pending -> Synced
        report.markSynced();
        this.dbService.saveReport(report);
        this.notifyListeners();
      }
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }
  }

  /**
   * Simulates importing new templates from a remote server
   */
  public async fetchRemoteTemplates(): Promise<void> {
    // Simulate remote network latency
    await new Promise(resolve => setTimeout(resolve, 1200));
    // Core templates are re-asserted in local database
    this.dbService.initDefaultTemplates();
  }
}
