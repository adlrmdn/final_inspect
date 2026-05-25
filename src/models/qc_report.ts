export type SyncStatus = 'draft' | 'pending_sync' | 'synced';

export class QCInspectionReport {
  public id: string;
  public templateId: string;
  public operatorId: string;
  public payload: Record<string, any>;
  public status: SyncStatus;
  public createdAt: Date;

  constructor(
    id: string,
    templateId: string,
    operatorId: string,
    payload: Record<string, any> = {},
    status: SyncStatus = 'draft',
    createdAt: Date = new Date()
  ) {
    this.id = id;
    this.templateId = templateId;
    this.operatorId = operatorId;
    this.payload = payload;
    this.status = status;
    this.createdAt = createdAt;
  }

  /**
   * Promotes the report from 'draft' to 'pending_sync', locking it from further editing.
   */
  public finalize(): void {
    if (this.status === 'draft') {
      this.status = 'pending_sync';
    }
  }

  /**
   * Marks the report as successfully synchronized with the central database.
   */
  public markSynced(): void {
    if (this.status === 'pending_sync') {
      this.status = 'synced';
    }
  }

  /**
   * Checks whether the report can still be edited.
   */
  public isEditable(): boolean {
    return this.status === 'draft';
  }

  /**
   * Serializes the report object to a standard JSON representation.
   */
  public toJSON() {
    return {
      id: this.id,
      template_id: this.templateId,
      operator_id: this.operatorId,
      payload: this.payload,
      status: this.status,
      created_at: this.createdAt.toISOString()
    };
  }

  /**
   * Deserializes a raw JSON object into a QCInspectionReport instance.
   */
  public static fromJSON(json: any): QCInspectionReport {
    return new QCInspectionReport(
      json.id,
      json.template_id,
      json.operator_id || 'operator-1',
      json.payload || {},
      json.status || 'draft',
      new Date(json.created_at || Date.now())
    );
  }
}
