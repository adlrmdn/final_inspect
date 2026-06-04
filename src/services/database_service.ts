import { QCInspectionTemplate } from '../models/qc_template';
import { QCInspectionReport } from '../models/qc_report';
import { invoke } from '@tauri-apps/api/core';

export class DatabaseService {
  private static instance: DatabaseService | null = null;
  private STORAGE_KEY_TEMPLATES = 'chimera_qc_templates';
  private STORAGE_KEY_REPORTS = 'chimera_qc_reports';

  private constructor() {
    this.initDefaultTemplates();
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  public initDefaultTemplates(): void {
    const existing = this.getTemplates();
    const defaults = [
      new QCInspectionTemplate(
        'fabric_v0',
        'Fabric Quality Control',
        'v0.1',
        'Scan fabric rolls to log defects, verify width variants, and calculate variance tolerances.',
        [
          { name: 'batch_id', type: 'text', label: 'Material / Batch Identifier', required: true, placeholder: 'e.g. BTC-9812-FLX' },
          { name: 'status', type: 'select', label: 'Physical Quality Core Status', required: true, options: ['nominal', 'degraded', 'defect'] },
          { name: 'notes', type: 'text', label: 'Core Observations / Technical Notes', required: false, placeholder: 'Input observations...' }
        ]
      ),
      new QCInspectionTemplate(
        'pack_v0',
        'Packaging Quality Control',
        'v0.1',
        'Audit and log structural integrity, box dimensional measurements, and labeling accuracy.',
        [
          { name: 'batch_id', type: 'text', label: 'Packaging Batch ID', required: true, placeholder: 'e.g. PKG-5501-A' },
          { name: 'status', type: 'select', label: 'Structure Integrity Status', required: true, options: ['nominal', 'degraded', 'defect'] },
          { name: 'notes', type: 'text', label: 'Log labeling accuracy or deviations...', required: false, placeholder: 'Input notes...' }
        ]
      )
    ];

    const needsUpdate = existing.length !== defaults.length || 
      existing.some((t, i) => t.id !== defaults[i].id || t.title !== defaults[i].title || t.version !== defaults[i].version);

    if (needsUpdate) {
      this.saveTemplates(defaults);
    }
  }

  // --- TEMPLATES ---
  public getTemplates(): QCInspectionTemplate[] {
    const raw = localStorage.getItem(this.STORAGE_KEY_TEMPLATES);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return parsed.map((t: any) => new QCInspectionTemplate(t.id, t.title, t.version, t.description, t.fields));
    } catch {
      return [];
    }
  }

  public saveTemplates(templates: QCInspectionTemplate[]): void {
    localStorage.setItem(this.STORAGE_KEY_TEMPLATES, JSON.stringify(templates));
  }

  // --- REPORTS ---
  public getReports(): QCInspectionReport[] {
    const raw = localStorage.getItem(this.STORAGE_KEY_REPORTS);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return parsed.map((r: any) => QCInspectionReport.fromJSON(r));
    } catch {
      return [];
    }
  }

  public getPendingReports(): QCInspectionReport[] {
    return this.getReports().filter(r => r.status === 'pending_sync');
  }

  public saveReport(report: QCInspectionReport): void {
    const reports = this.getReports();
    const index = reports.findIndex(r => r.id === report.id);
    if (index >= 0) {
      reports[index] = report;
    } else {
      reports.push(report);
    }
    localStorage.setItem(this.STORAGE_KEY_REPORTS, JSON.stringify(reports.map(r => r.toJSON())));
  }

  public saveReports(reports: QCInspectionReport[]): void {
    localStorage.setItem(this.STORAGE_KEY_REPORTS, JSON.stringify(reports.map(r => r.toJSON())));
  }

  // --- POSTGRES SYNC BRIDGE ---
  
  /**
   * Checks connection health to PostgreSQL database
   */
  public async isPostgresOnline(): Promise<boolean> {
    try {
      return await invoke<boolean>('pg_test_connection');
    } catch (e) {
      console.warn('PostgreSQL offline or unreachable:', e);
      return false;
    }
  }

  /**
   * Pushes a single template to PostgreSQL database
   */
  public async saveTemplateToPostgres(template: QCInspectionTemplate): Promise<void> {
    try {
      await invoke('pg_save_template', {
        template: {
          id: template.id,
          title: template.title,
          version: template.version,
          description: template.description,
          fields: template.fields
        }
      });
    } catch (e) {
      console.error('Failed to save template to PostgreSQL:', e);
      throw e;
    }
  }

  /**
   * Pushes a single report to PostgreSQL database
   */
  public async saveReportToPostgres(report: QCInspectionReport): Promise<void> {
    try {
      const serialized = report.toJSON();
      await invoke('pg_save_report', {
        report: {
          id: serialized.id,
          template_id: serialized.template_id,
          operator_id: serialized.operator_id,
          payload: serialized.payload,
          status: serialized.status,
          created_at: serialized.created_at
        }
      });
    } catch (e) {
      console.error('Failed to save report to PostgreSQL:', e);
      throw e;
    }
  }
}
