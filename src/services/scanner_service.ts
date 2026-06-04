export type ScanPhase = 'idle' | 'reading' | 'success';

export class ScannerService {
  private static instance: ScannerService | null = null;

  private constructor() {}

  public static getInstance(): ScannerService {
    if (!ScannerService.instance) {
      ScannerService.instance = new ScannerService();
    }
    return ScannerService.instance;
  }

  /**
   * Performs an async mock scan, calling onPhaseChange for UI updates.
   * Returns the scanned code string on completion.
   */
  public async performScan(
    templateId: string,
    onPhaseChange: (phase: ScanPhase) => void
  ): Promise<string> {
    onPhaseChange('reading');

    await new Promise(resolve => setTimeout(resolve, 2200));

    const mockCode = templateId === 'fabric_v0' ? 'BTC-7782-RAW' : 'PKG-2190-FIN';
    onPhaseChange('success');

    await new Promise(resolve => setTimeout(resolve, 1200));

    onPhaseChange('idle');
    return mockCode;
  }
}
