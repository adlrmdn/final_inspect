import React, { useState, useEffect } from 'react';
import { DatabaseService } from '../services/database_service';
import { QCInspectionTemplate } from '../models/qc_template';
import { QCInspectionReport } from '../models/qc_report';

interface FormViewProps {
  templateId: string;
  onBack: () => void;
  aiFillData?: Record<string, any> | null;
  clearAiFill?: () => void;
  aiCalculateDefects?: number | null;
  clearAiCalculate?: () => void;
}

export default function FormView({ 
  templateId, 
  onBack, 
  aiFillData, 
  clearAiFill,
  aiCalculateDefects,
  clearAiCalculate
}: FormViewProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [template, setTemplate] = useState<QCInspectionTemplate | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // AR Scanner Mock State
  const [isScanning, setIsScanning] = useState(false);
  const [scannerStatus, setScannerStatus] = useState<'idle' | 'scanning' | 'success'>('idle');

  // Yield Calculation Metrics
  const totalQty: number = 1000;
  const [defectsCount, setDefectsCount] = useState(0);
  const [scrapQty, setScrapQty] = useState(0);
  const [passQty, setPassQty] = useState(1000);

  const dbService = DatabaseService.getInstance();

  useEffect(() => {
    const templates = dbService.getTemplates();
    const found = templates.find(t => t.id === templateId);
    if (found) {
      setTemplate(found);
      const initialData: Record<string, any> = {};
      found.fields.forEach(field => {
        initialData[field.name] = field.type === 'boolean' ? false : '';
      });
      setFormData(initialData);
    }
  }, [templateId]);

  // Hook to handle AI Fill Events
  useEffect(() => {
    if (aiFillData && template) {
      setFormData(prev => {
        const next = { ...prev };
        template.fields.forEach(field => {
          if (aiFillData[field.name] !== undefined) {
            next[field.name] = aiFillData[field.name];
          }
        });
        return next;
      });
      
      // If AI set status, update defects approximation
      if (aiFillData.status) {
        handleStatusDefectEstimation(aiFillData.status);
      }

      if (clearAiFill) clearAiFill();
    }
  }, [aiFillData, template]);

  // Hook to handle AI Calculation Events
  useEffect(() => {
    if (aiCalculateDefects !== null && aiCalculateDefects !== undefined) {
      setDefectsCount(aiCalculateDefects);
      const scrap = aiCalculateDefects * 12; // 12 units scrap per defect approximation
      setScrapQty(scrap);
      setPassQty(Math.max(0, totalQty - scrap));
      if (clearAiCalculate) clearAiCalculate();
    }
  }, [aiCalculateDefects]);

  const handleInputChange = (fieldName: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));

    if (fieldName === 'status') {
      handleStatusDefectEstimation(value);
    }
  };

  const handleStatusDefectEstimation = (status: string) => {
    let count = 0;
    if (status === 'degraded') count = 3;
    if (status === 'defect') count = 18;
    setDefectsCount(count);

    const scrap = count * 12;
    setScrapQty(scrap);
    setPassQty(Math.max(0, totalQty - scrap));
  };

  // Simulated Holographic AR Scanner Action
  const triggerCameraScan = () => {
    if (isScanning) return;
    setIsScanning(true);
    setScannerStatus('scanning');

    setTimeout(() => {
      // Generate a mock scanned code based on template
      const mockCode = templateId === 'fabric_v1' ? 'BTC-7782-RAW' : 'PKG-2190-FIN';
      handleInputChange('batch_id', mockCode);
      setScannerStatus('success');

      setTimeout(() => {
        setIsScanning(false);
        setScannerStatus('idle');
      }, 1000);
    }, 2000);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!template) return;

    const { valid, errors } = template.validate(formData);
    if (!valid) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors([]);
    setIsSaving(true);

    const reportId = `rep-${Math.random().toString(36).substr(2, 9)}`;
    const report = new QCInspectionReport(
      reportId,
      template.id,
      'operator-1',
      { ...formData, qty_output: passQty, scrap_output: scrapQty, total_defects: defectsCount },
      'pending_sync'
    );

    setTimeout(() => {
      dbService.saveReport(report);
      setIsSaving(false);
      onBack();
    }, 800);
  };

  const getYieldPercentage = () => {
    if (totalQty === 0) return 0;
    return Math.round((passQty / totalQty) * 100);
  };

  if (!template) {
    return <div className="bento-card">Loading inspection schema...</div>;
  }

  return (
    <div className="form-container" style={{ display: 'flex', flexDirection: 'column' }}>
      
      {/* Top Controls */}
      <div className="flex-between mb-4" style={{ marginBottom: '1.25rem' }}>
        <button 
          className="btn-electric-outline" 
          style={{ width: 'auto', padding: '0.4rem 1.25rem', borderRadius: '10px', fontSize: '0.85rem' }} 
          onClick={onBack}
        >
          &larr; Return to Core Console
        </button>
        <span className="electric-badge teal">Offline Validation Mode</span>
      </div>

      {/* Grid of Dynamic Form & high-tech Widgets */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        
        {/* Left Side: Standard Form Fields */}
        <div className="bento-card" style={{ flex: 1 }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--royal-blue)' }}>Dynamic Context Form</span>
            <h1 style={{ fontSize: '1.6rem', margin: '0.1rem 0' }}>{template.title}</h1>
            <p style={{ fontSize: '0.85rem' }}>Variables are cached locally as you inspect.</p>
          </div>

          {validationErrors.length > 0 && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', borderLeft: '3px solid #EF4444', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', color: '#B91C1C', fontSize: '0.85rem' }}>
              <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Validation:</strong>
              <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
                {validationErrors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <form onSubmit={handleSave}>
            {template.fields.map(field => (
              <div className="form-group" key={field.name}>
                <label className="form-label">{field.label} {field.required && <span style={{ color: '#EF4444' }}>*</span>}</label>
                
                {field.type === 'select' ? (
                  <select 
                    className="form-input" 
                    required={field.required}
                    value={formData[field.name] || ''}
                    onChange={e => handleInputChange(field.name, e.target.value)}
                    style={{ appearance: 'none', background: 'white' }}
                  >
                    <option value="">Choose option...</option>
                    {field.options?.map(opt => (
                      <option key={opt} value={opt}>{opt.toUpperCase()}</option>
                    ))}
                  </select>
                ) : field.type === 'boolean' ? (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={!!formData[field.name]}
                      onChange={e => handleInputChange(field.name, e.target.checked)}
                    />
                    <span>Pass diagnostic validation</span>
                  </label>
                ) : (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input 
                      type={field.type === 'number' ? 'number' : 'text'} 
                      className="form-input" 
                      placeholder={field.placeholder || ''} 
                      required={field.required}
                      value={formData[field.name] || ''}
                      onChange={e => handleInputChange(field.name, field.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
                    />
                    {field.name === 'batch_id' && (
                      <button 
                        type="button"
                        className="btn-electric-outline"
                        style={{ width: 'auto', padding: '0 0.75rem', borderRadius: '12px', whiteSpace: 'nowrap' }}
                        onClick={triggerCameraScan}
                      >
                        📷 Scan
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}

            <button type="submit" className="btn-electric" disabled={isSaving}>
              {isSaving ? 'Committing Report...' : 'Commit Report Offline'}
            </button>
          </form>
        </div>

        {/* Right Side: Holographic Scanner Viewport & Yield HUD Widgets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Holographic AR Scanner Container */}
          <div className="bento-card holographic-scanner-card" style={{ padding: '1rem', position: 'relative', overflow: 'hidden' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.75)' }}>Camera / Laser HUD Scanner</span>
            
            <div className="scanner-viewport">
              {scannerStatus === 'scanning' && (
                <>
                  <div className="scanner-laser"></div>
                  <div className="scanner-aim-ring"></div>
                  <div className="scanner-readout">SCANNING AR TAG... [OCR: ACTIVE]</div>
                </>
              )}
              {scannerStatus === 'success' && (
                <div className="scanner-readout success">✓ AR MATCH FOUND [ID CAPTURED]</div>
              )}
              {scannerStatus === 'idle' && (
                <div className="scanner-readout idle">CAMERA HUD SYSTEM READY</div>
              )}
            </div>
            
            <button 
              className="btn-electric" 
              style={{ padding: '0.6rem 1rem', fontSize: '0.8rem', borderRadius: '12px', marginTop: '0.75rem' }}
              onClick={triggerCameraScan}
              disabled={isScanning}
            >
              {isScanning ? 'Reading traveler code...' : 'Simulate Camera QR Scan'}
            </button>
          </div>

          {/* AI Yield & Output Quantitative Dashboard */}
          <div className="bento-card yield-calculator-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--royal-blue)' }}>AI Yield Predictor</span>
              <h2>Product Yield Forecasting</h2>
              <p style={{ fontSize: '0.82rem', marginBottom: '1rem' }}>Estimating output based on active defect coefficients.</p>
              
              {/* Glowing Yield progress metrics */}
              <div className="yield-visual-block">
                <div className="yield-gauge-radial">
                  <div className="yield-inner-circle">
                    <span className="yield-percent">{getYieldPercentage()}%</span>
                    <span className="yield-label">EST. YIELD</span>
                  </div>
                </div>

                <div className="yield-data-labels" style={{ flex: 1 }}>
                  <div className="yield-data-row">
                    <span>Target Volume:</span>
                    <strong>{totalQty} units</strong>
                  </div>
                  <div className="yield-data-row">
                    <span>Passable Output:</span>
                    <span style={{ color: 'var(--teal-blue)', fontWeight: 700 }}>{passQty} units</span>
                  </div>
                  <div className="yield-data-row">
                    <span>Scrapped Margin:</span>
                    <span style={{ color: '#EF4444', fontWeight: 700 }}>{scrapQty} units</span>
                  </div>
                  <div className="yield-data-row">
                    <span>Active Defects:</span>
                    <span style={{ color: 'var(--royal-blue)', fontWeight: 700 }}>{defectsCount} units</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ background: 'rgba(59, 130, 246, 0.04)', borderRadius: '12px', padding: '0.65rem', border: '1px solid rgba(59, 130, 246, 0.08)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              🤖 <strong>Local AI Estimation:</strong> Each defect registers a scrap coefficient of <strong>12 units</strong> for this product type.
            </div>
          </div>

        </div>

      </div>

      {/* Copyright Branding Footer */}
      <footer className="footer-branding">
        QC Offline Core // Industrial Core // copyright © 2026
      </footer>

    </div>
  );
}
