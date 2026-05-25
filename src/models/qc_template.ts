export interface TemplateSchemaField {
  name: string;
  type: 'text' | 'select' | 'boolean' | 'number';
  label: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
}

export class QCInspectionTemplate {
  public id: string;
  public title: string;
  public version: string;
  public description: string;
  public fields: TemplateSchemaField[];

  constructor(id: string, title: string, version: string, description: string, fields: TemplateSchemaField[]) {
    this.id = id;
    this.title = title;
    this.version = version;
    this.description = description;
    this.fields = fields;
  }

  /**
   * Validates a given payload against the template's schema definitions
   */
  public validate(payload: Record<string, any>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const field of this.fields) {
      const value = payload[field.name];

      if (field.required && (value === undefined || value === null || value === '')) {
        errors.push(`Field "${field.label}" is required.`);
        continue;
      }

      if (value !== undefined && value !== null && value !== '') {
        if (field.type === 'number' && typeof value !== 'number') {
          errors.push(`Field "${field.label}" must be a number.`);
        }
        if (field.type === 'boolean' && typeof value !== 'boolean') {
          errors.push(`Field "${field.label}" must be a boolean.`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
