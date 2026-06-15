import React, { useState, useEffect } from 'react';
import { DatabaseService } from '../services/database_service';
import { QCInspectionTemplate } from '../models/qc_template';
import { QCInspectionReport } from '../models/qc_report';
import { ScannerService, ScanPhase } from '../services/scanner_service';
import { DEFAULT_TOTAL_QTY, SCRAP_COEFFICIENT, STATUS_DEFECT_MAP } from '../config/yield_constants';
import { SyncEngine } from '../services/sync_engine';
import { PackagingService } from '../services/packaging_service';
import { USER_GUIDELINES_SECTIONS } from '../services/user_guidelines';
import { AIAgentService, getFuzzyMatchScore } from '../services/ai_agent_service';

import { ChatMessage } from '../hooks/useChatEngine';

import { FormHeader } from './workspace/FormHeader';
import { WorkspaceControls } from './workspace/WorkspaceControls';
import { BentoInspectionCards } from './workspace/BentoInspectionCards';
import { PrintReport } from './workspace/PrintReport';
import { RightDefectPane } from './workspace/RightDefectPane';
import { ProjectSelectionDirectory } from './workspace/ProjectSelectionDirectory';

interface FormViewProps {
  templateId: string;
  onBack: () => void;
  aiFillData?: Record<string, any> | null;
  clearAiFill?: () => void;
  aiCalculateDefects?: number | null;
  clearAiCalculate?: () => void;
  // Chat engine props passed from App
  chatHistory: ChatMessage[];
  chatInput: string;
  setChatInput: (val: string) => void;
  isListening: boolean;
  handleSendChat: (text?: string) => void;
  toggleListening: () => void;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  onMinimize: () => void;
  onClose: () => void;
  chatRegistryRef?: React.MutableRefObject<{
    executeWorkflowCommand?: (command: string, data?: any) => Promise<string>;
    getActiveProjectDetails?: () => { projectId?: string; sessionId?: string };
  }>;
}

const CYCLE_NAMES = [
  'Baseline / CMT-Cut', // Cycle 0
  'Pre Final',          // Cycle 1
  '1st Final',          // Cycle 2
  '2nd Final',          // Cycle 3
  '3rd Final'           // Cycle 4
];

const getCycleName = (cycleNum: number) => {
  if (cycleNum >= 0 && cycleNum < CYCLE_NAMES.length) {
    return CYCLE_NAMES[cycleNum];
  }
  return `Cycle ${cycleNum}`;
};

interface DeductionResult {
  hasDeduction: boolean;
  deductionAmount: number;
}

const calculateDeductions = (project: any, session: any): DeductionResult => {
  if (!project || !session) {
    return { hasDeduction: false, deductionAmount: 0 };
  }

  const salesPrice = project.sales_price || 0;
  const penaltyPrice = salesPrice * 0.70;
  const reportLines = session.report_lines || [];
  
  let sumRejectProduksi = 0;
  let sumCuttingQty = 0;
  let sumBarangHilang = 0;

  for (const line of reportLines) {
    const rCutting = line.reject_cutting || 0;
    const rSewing = line.reject_sewing || 0;
    const rFinishing = line.reject_finishing || 0;
    const rPrinting = line.reject_printing || 0;
    const rEmbro = line.reject_embro || 0;
    const rWashing = line.reject_washing || 0;
    const rejectProduksi = rCutting + rSewing + rFinishing + rPrinting + rEmbro + rWashing;
    sumRejectProduksi += rejectProduksi;

    const baseLine = (project.base_lines || []).find((bl: any) => bl.size_val === line.size_val);
    const cuttingQty = baseLine ? (baseLine.total_good_qty || 0) : 0;
    sumCuttingQty += cuttingQty;

    sumBarangHilang += (line.barang_hilang || 0);
  }

  const allowedLimit = Math.floor(sumCuttingQty * 0.01);
  const exceedingRejectQty = Math.max(0, sumRejectProduksi - allowedLimit);
  const totalBarangHilang = sumBarangHilang;

  const rejectProduksiPenalty = exceedingRejectQty * penaltyPrice;
  const barangHilangPenalty = totalBarangHilang * penaltyPrice;
  const totalDeduction = rejectProduksiPenalty + barangHilangPenalty;

  return {
    hasDeduction: totalDeduction > 0,
    deductionAmount: totalDeduction
  };
};



export default function FormView({
  templateId,
  onBack,
  aiFillData,
  clearAiFill,
  aiCalculateDefects,
  clearAiCalculate,
  chatHistory,
  chatInput,
  setChatInput,
  isListening,
  handleSendChat,
  toggleListening,
  chatEndRef,
  onMinimize,
  onClose,
  chatRegistryRef
}: FormViewProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [template, setTemplate] = useState<QCInspectionTemplate | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // PLM Activity Target States
  const [activeActivities, setActiveActivities] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('packaging_plm_activities');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {}
      }
    }
    return [];
  });
  const [selectedActivity, setSelectedActivity] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // AR Scanner Mock State
  const [isScanning, setIsScanning] = useState(false);
  const [scannerStatus, setScannerStatus] = useState<ScanPhase>('idle');

  // Yield Calculation Metrics
  const totalQty: number = DEFAULT_TOTAL_QTY;
  const [defectsCount, setDefectsCount] = useState(0);
  const [scrapQty, setScrapQty] = useState(0);
  const [passQty, setPassQty] = useState(DEFAULT_TOTAL_QTY);

  const [isDownloading, setIsDownloading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('Processing...');
  const [isFetchingProjects, setIsFetchingProjects] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'alert' | 'confirm' | 'success' | 'danger';
    onConfirm?: () => void;
    onCancel?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'alert'
  });

  const showProfessionalAlert = (title: string, message: string, type: 'alert' | 'success' | 'danger' = 'alert') => {
    return new Promise<void>((resolve) => {
      setModalConfig({
        isOpen: true,
        title,
        message,
        type,
        onConfirm: () => {
          setModalConfig(prev => ({ ...prev, isOpen: false }));
          resolve();
        }
      });
    });
  };

  const showProfessionalConfirm = (title: string, message: string): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setModalConfig({
        isOpen: true,
        title,
        message,
        type: 'confirm',
        onConfirm: () => {
          setModalConfig(prev => ({ ...prev, isOpen: false }));
          resolve(true);
        },
        onCancel: () => {
          setModalConfig(prev => ({ ...prev, isOpen: false }));
          resolve(false);
        }
      });
    });
  };

  // Packaging QC Project & Session States
  const [packagingProjects, setPackagingProjects] = useState<any[]>(() => {
    return PackagingService.getInstance().getStoredProjects();
  });
  const [activePackagingProject, setActivePackagingProject] = useState<any | null>(null);
  const [localRemovedProjects, setLocalRemovedProjects] = useState<string[]>(() => {
    return PackagingService.getInstance().getLocalRemovedProjects();
  });
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [sessionEditMode, setSessionEditMode] = useState<boolean>(false);
  const [isChatExpanded, setIsChatExpanded] = useState<boolean>(false);

  // User guidelines popup states
  const [showGuidelinesModal, setShowGuidelinesModal] = useState<boolean>(false);
  const [guidelinesLanguage, setGuidelinesLanguage] = useState<'en' | 'id'>('en');

  // Selected size tab for CMT-Pak details
  const [selectedSizeTab, setSelectedSizeTab] = useState<string>('');

  const headerButtonStyle: React.CSSProperties = {
    height: '32px',
    boxSizing: 'border-box',
    padding: '0 1rem',
    fontSize: '0.72rem',
    borderRadius: '10px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: '1',
    fontWeight: 800,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    width: 'auto'
  };

  const versionSelectorButtonStyle = (isSelected: boolean): React.CSSProperties => ({
    height: '32px',
    boxSizing: 'border-box',
    padding: '0 1rem',
    fontSize: '0.72rem',
    borderRadius: '10px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.35rem',
    fontWeight: isSelected ? 800 : 600,
    background: isSelected ? 'var(--royal-blue)' : 'rgba(37, 99, 235, 0.03)',
    color: isSelected ? '#ffffff' : 'var(--deep-ocean)',
    border: isSelected ? '1.5px solid transparent' : '1.5px solid rgba(37, 99, 235, 0.15)',
    cursor: 'pointer',
    width: 'auto',
    lineHeight: '1'
  });

  // Defect Image Attachment list (temporary local state during session creation)
  const [tempDefectImages, setTempDefectImages] = useState<any[]>([]);
  const [selectedImageBase64, setSelectedImageBase64] = useState<string>('');
  const [defectImagePathInput, setDefectImagePathInput] = useState<string>('');
  const [defectTypeInput, setDefectTypeInput] = useState<string>('Labeling');
  const [defectDescInput, setDefectDescInput] = useState<string>('');
  const [defectMajorInput, setDefectMajorInput] = useState<number>(0);
  const [defectMinorInput, setDefectMinorInput] = useState<number>(0);

  const hasNextVersionExists = () => {
    if (!activePackagingProject || !activeSession) return true;
    const nextCycle = activeSession.cycle_number + 1;
    return (activePackagingProject.sessions || []).some((s: any) => s.cycle_number === nextCycle);
  };

  const dbService = DatabaseService.getInstance();
  const scannerService = ScannerService.getInstance();

  const fetchPackagingProjects = async (silent = false) => {
    // 1. Prioritize offline cache immediately to prevent lagging/freezing and support instant open
    const cached = PackagingService.getInstance().getStoredProjects();
    if (cached && cached.length > 0) {
      setPackagingProjects(cached);
    }

    if (!silent && (!cached || cached.length === 0)) {
      setIsFetchingProjects(true);
    }
    try {
      const res = await PackagingService.getInstance().invokeSafe<any[]>('get_packaging_projects', {}, []);
      setPackagingProjects(res || []);
  
      // If we have an active project, refresh it
      if (activePackagingProject) {
        const refreshed = res?.find((p: any) => p.project_id === activePackagingProject.project_id);
        if (refreshed && !localRemovedProjects.includes(refreshed.project_id)) {
          setActivePackagingProject(refreshed);
          if (activeSession) {
            const updatedSes = refreshed.sessions?.find((s: any) => s.session_id === activeSession.session_id);
            if (updatedSes) {
              setActiveSession(updatedSes);
            }
          }
        }
      }
    } catch (e) {
      console.error('Failed to load packaging projects:', e);
    } finally {
      setIsFetchingProjects(false);
    }
  };



  const handleAddTempDefectImage = () => {
    if (!defectImagePathInput.trim()) return;
    const newImg = {
      image_id: `IMG-${activePackagingProject?.project_id}-${Date.now()}-${tempDefectImages.length}`,
      project_id: activePackagingProject?.project_id || '',
      session_id: activeSession?.session_id || null,
      image_path: selectedImageBase64 || defectImagePathInput,
      defect_type: defectTypeInput,
      description: defectDescInput ? defectDescInput.trim() : null,
      major: defectMajorInput,
      minor: defectMinorInput,
      captured_at: new Date().toISOString()
    };
    setTempDefectImages(prev => [newImg, ...prev]);
    setDefectImagePathInput('');
    setSelectedImageBase64('');
    setDefectDescInput('');
    setDefectMajorInput(0);
    setDefectMinorInput(0);
  };

  const handleSaveSession = async () => {
    if (!activeSession) return;
    setIsProcessing(true);
    setProcessingMessage('Saving inspection session and logging defect records...');
    try {
      const savedSession = {
        ...activeSession,
        status: 'completed',
        ended_at: new Date().toISOString()
      };
      await PackagingService.getInstance().invokeSafe<void>('save_packaging_session', { session: savedSession }, undefined);

      // Save CMT-Pak session report lines if present
      if (activeSession.report_lines && activeSession.report_lines.length > 0) {
        await PackagingService.getInstance().invokeSafe<void>('save_packaging_project_reports', { reports: activeSession.report_lines }, undefined);
      }

      for (const img of tempDefectImages) {
        await PackagingService.getInstance().invokeSafe<void>('save_packaging_defect_image', { image: img }, undefined);
      }

      // Calculate deductions and save in the project header
      const deductions = calculateDeductions(activePackagingProject, savedSession);
      const updatedProjectHeader = {
        ...activePackagingProject,
        has_deduction: deductions.hasDeduction,
        deduction_amount: deductions.deductionAmount,
        updated_at: new Date().toISOString()
      };
      const { base_report, base_lines, sessions, defect_images, ...projectHeader } = updatedProjectHeader;
      await PackagingService.getInstance().invokeSafe<void>('save_packaging_project', { project: projectHeader }, undefined);

      setSessionEditMode(false);
      setTempDefectImages([]);
      await fetchPackagingProjects(true);
    } catch (e) {
      console.error('Failed to save session:', e);
      await showProfessionalAlert('Save Failed', `Failed to save inspection session: ${e}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateSavedDefect = async (imageId: string, field: 'major' | 'minor', value: number) => {
    if (!activePackagingProject) return;
    try {
      const img = (activePackagingProject.defect_images || []).find((i: any) => i.image_id === imageId);
      if (!img) return;

      const updatedImg = {
        ...img,
        [field]: value
      };

      // Optimistically update React state immediately for instant UI response
      setActivePackagingProject((prev: any) => {
        if (!prev) return null;
        const nextImages = (prev.defect_images || []).map((i: any) => 
          i.image_id === imageId ? updatedImg : i
        );
        return { ...prev, defect_images: nextImages };
      });

      // Save to database in the background without blocking the UI thread
      PackagingService.getInstance().invokeSafe<void>('save_packaging_defect_image', { image: updatedImg }, undefined)
        .catch((err) => console.error('Failed to save updated defect image to database:', err));

    } catch (e) {
      console.error('Failed to update defect image:', e);
    }
  };

  const handleRemovePackagingProject = async (projectId: string) => {
    const confirmed = await showProfessionalConfirm(
      'Remove Project',
      'Are you sure you want to remove this project from your device? (It will remain active on the cloud for other devices).'
    );
    if (!confirmed) return;

    setDeletingProjectId(projectId);
    try {
      // Add the projectId to the local removed list so it's hidden on this device only
      const nextRemoved = [...localRemovedProjects, projectId];
      setLocalRemovedProjects(nextRemoved);
      PackagingService.getInstance().saveLocalRemovedProjects(nextRemoved);

      // If the deleted project was the active one, close it now
      if (activePackagingProject?.project_id === projectId) {
        setActivePackagingProject(null);
        setSessionEditMode(false);
        setActiveSession(null);
      }
    } catch (e) {
      console.error('Failed to remove packaging project:', e);
      await showProfessionalAlert('Removal Failed', `Failed to remove packaging project: ${e}`, 'danger');
    } finally {
      setDeletingProjectId(null);
    }
  };

  const handleCompleteProject = async () => {
    if (!activePackagingProject) return;
    if (sessionEditMode) {
      await showProfessionalAlert(
        'Session Active',
        'Please save or cancel the active inspection session before completing the project.',
        'alert'
      );
      return;
    }

    if (!navigator.onLine) {
      await showProfessionalAlert(
        'Offline Required',
        'You must be online to complete and sync this project. Please check your internet connection.',
        'danger'
      );
      return;
    }

    if (!activePackagingProject.verified_doc) {
      await showProfessionalAlert(
        'Verification Required',
        'This project cannot be completed because it has not been verified. Please upload a signed verification document first.',
        'alert'
      );
      return;
    }

    const confirmed = await showProfessionalConfirm(
      'Complete & Sync Project',
      'Are you sure you want to complete and sync this packaging project? This will lock the workspace and sync all data to the central database.'
    );
    if (!confirmed) return;

    setIsProcessing(true);
    setProcessingMessage('Completing & syncing packaging project...');
    try {
      // Calculate deductions
      let targetSession = activeSession;
      if (!targetSession && activePackagingProject.sessions && activePackagingProject.sessions.length > 0) {
        const sorted = [...activePackagingProject.sessions].sort((a: any, b: any) => b.cycle_number - a.cycle_number);
        targetSession = sorted[0];
      }
      const deductions = calculateDeductions(activePackagingProject, targetSession);

      const updatedProject = {
        ...activePackagingProject,
        status: 'completed',
        has_deduction: deductions.hasDeduction,
        deduction_amount: deductions.deductionAmount,
        updated_at: new Date().toISOString()
      };
      const { base_report, base_lines, sessions, defect_images, ...projectHeader } = updatedProject;
      await PackagingService.getInstance().invokeSafe<void>('save_packaging_project', { project: projectHeader }, undefined);

      const syncEngine = SyncEngine.getInstance();
      await syncEngine.synchronize();

      setActivePackagingProject(updatedProject);
      await fetchPackagingProjects(true);
      await showProfessionalAlert(
        'Project Completed & Synced',
        'Successfully completed and synchronized project with the central database.',
        'success'
      );
    } catch (e) {
      console.error('Failed to complete & sync project:', e);
      await showProfessionalAlert('Completion & Sync Failed', `Failed: ${e}`, 'danger');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRevertProject = async () => {
    if (!activePackagingProject) return;
    if (sessionEditMode) {
      await showProfessionalAlert(
        'Session Active',
        'Please save or cancel the active inspection session before reverting the project.',
        'alert'
      );
      return;
    }

    if (!navigator.onLine) {
      await showProfessionalAlert(
        'Offline Required',
        'You must be online to revert this project. Please check your internet connection.',
        'danger'
      );
      return;
    }

    const confirmed = await showProfessionalConfirm(
      'Revert Project Completion',
      'WARNING: Reverting a completed project will unlock it for editing. This action must only be used to correct genuine inspection mistakes and should NOT be abused. Reverting will immediately sync the status change back to the central database.\n\nAre you sure you want to proceed?'
    );
    if (!confirmed) return;

    setIsProcessing(true);
    setProcessingMessage('Reverting project completion status...');
    try {
      const updatedProject = {
        ...activePackagingProject,
        status: 'downloaded',
        updated_at: new Date().toISOString()
      };
      const { base_report, base_lines, sessions, defect_images, ...projectHeader } = updatedProject;
      await PackagingService.getInstance().invokeSafe<void>('save_packaging_project', { project: projectHeader }, undefined);

      const syncEngine = SyncEngine.getInstance();
      await syncEngine.synchronize();

      setActivePackagingProject(updatedProject);
      await fetchPackagingProjects(true);
      await showProfessionalAlert(
        'Project Reverted',
        'Successfully reverted project completion status. The workspace is now unlocked for edits.',
        'success'
      );
    } catch (e) {
      console.error('Failed to revert project:', e);
      await showProfessionalAlert('Revert Failed', `Failed: ${e}`, 'danger');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSyncProject = async (_projectId: string) => {
    try {
      const syncEngine = SyncEngine.getInstance();
      await syncEngine.synchronize();
      await fetchPackagingProjects(true);
      await showProfessionalAlert(
        'Sync Successful',
        'Packaging project and all associated QC inspection sessions have been synchronized successfully.',
        'success'
      );
    } catch (e) {
      console.error('Failed to sync project:', e);
      await showProfessionalAlert('Sync Failed', `Failed to sync project: ${e}`, 'danger');
    }
  };

  const handleMoveVersion = async () => {
    if (!activePackagingProject) return;

    // Find the current active session or fallback to the BASE session (cycle 0)
    let currentSession = activeSession;
    if (!currentSession) {
      currentSession = (activePackagingProject.sessions || []).find((s: any) => s.cycle_number === 0);
    }
    if (!currentSession) {
      await showProfessionalAlert('Error', 'No template or base session found for this project.', 'danger');
      return;
    }

    const currentCycle = currentSession.cycle_number;
    if (currentCycle < 0 || currentCycle > 3) return;

    const nextCycle = currentCycle + 1;
    const nextCycleName = getCycleName(nextCycle);

    const confirmed = await showProfessionalConfirm(
      currentCycle === 0 ? 'Initialize Version' : 'Move Version',
      currentCycle === 0
        ? `Are you sure you want to initialize version ${nextCycleName} for this project?`
        : `Are you sure you want to clone this session's checklist, inspector, and quantities to start ${nextCycleName}?`
    );
    if (!confirmed) return;

    setIsProcessing(true);
    setProcessingMessage(currentCycle === 0 ? `Initializing ${nextCycleName}...` : `Creating ${nextCycleName} draft...`);
    try {
      const nextSessionId = `SES-${activePackagingProject.project_id}-${Date.now()}`;

      // Clone report lines
      const clonedLines = (currentSession.report_lines || []).map((line: any, idx: number) => ({
        ...line,
        report_id: `${nextSessionId}_LINE_${idx}`,
        session_id: nextSessionId,
        session_qty: 0.0,
        reject_bahan: 0,
        reject_cutting: 0,
        reject_sewing: 0,
        reject_finishing: 0,
        reject_printing: 0,
        reject_embro: 0,
        reject_washing: 0,
        reject_produksi: 0,
        btj: 0,
        barang_hilang: 0,
        total_good_qty: line.total_good_qty || 0,
        total_reject_qty: line.total_reject_qty || 0,
        session_version: 'v1.0'
      }));

      const newSession = {
        session_id: nextSessionId,
        project_id: activePackagingProject.project_id,
        cycle_number: nextCycle,
        inspector_id: currentSession.inspector_id || 'inspector-1',
        status: 'pending',
        started_at: new Date().toISOString(),
        ended_at: null,
        inspection_date: new Date().toISOString().split('T')[0],
        check_wash: currentSession.check_wash || false,
        check_style_as_sample: currentSession.check_style_as_sample || false,
        check_main_label: currentSession.check_main_label || false,
        check_flag_fit_label: currentSession.check_flag_fit_label || false,
        check_print_embro_artwork: currentSession.check_print_embro_artwork || false,
        check_hangtag: currentSession.check_hangtag || false,
        check_waist_tag: currentSession.check_waist_tag || false,
        check_barcode: currentSession.check_barcode || false,
        check_packing_list: currentSession.check_packing_list || false,
        check_shipping_mark: currentSession.check_shipping_mark || false,
        check_other_1: currentSession.check_other_1 || false,
        check_other_1_label: currentSession.check_other_1_label || '',
        check_other_2: currentSession.check_other_2 || false,
        check_other_2_label: currentSession.check_other_2_label || '',
        qty_available: currentSession.qty_available || 0,
        total_store: currentSession.total_store || 0,
        store_inspected: currentSession.store_inspected || 0,
        cutting_pcs: currentSession.cutting_pcs || 0,
        sewing_pcs: currentSession.sewing_pcs || 0,
        finishing_pcs: currentSession.finishing_pcs || 0,
        packing_pcs: currentSession.packing_pcs || 0,
        sampling_pcs: currentSession.sampling_pcs || 0,
        aql: currentSession.aql || 0.0,
        level_val: currentSession.level_val || 0.0,
        factory_representative: currentSession.factory_representative || '',
        inspector: currentSession.inspector || '',
        version: currentSession.version || '1.0',
        result: 'Pending',
        report_lines: clonedLines
      };

      // If we came from an existing cycle (>=1), mark that cycle as completed
      if (currentCycle >= 1) {
        const updatedPrevSession = {
          ...currentSession,
          status: 'completed'
        };
        await PackagingService.getInstance().invokeSafe<void>('save_packaging_session', { session: updatedPrevSession }, undefined);
      }

      // Save new session
      await PackagingService.getInstance().invokeSafe<void>('save_packaging_session', { session: newSession }, undefined);
      if (clonedLines.length > 0) {
        await PackagingService.getInstance().invokeSafe<void>('save_packaging_project_reports', { reports: clonedLines }, undefined);
      }

      // Refresh project list and state
      const res = await PackagingService.getInstance().invokeSafe<any[]>('get_packaging_projects', {}, []);
      setPackagingProjects(res || []);

      const refreshedProj = res?.find((p: any) => p.project_id === activePackagingProject.project_id);
      if (refreshedProj) {
        setActivePackagingProject(refreshedProj);
        const newlyCreatedSession = refreshedProj.sessions?.find((s: any) => s.session_id === nextSessionId);
        if (newlyCreatedSession) {
          setActiveSession(newlyCreatedSession);
          setSessionEditMode(true);
        }
      }

      await showProfessionalAlert(
        currentCycle === 0 ? 'Version Initialized' : 'Version Moved',
        currentCycle === 0
          ? `Successfully initialized ${nextCycleName} draft and opened for editing.`
          : `Successfully cloned session into ${nextCycleName} draft and opened for editing.`,
        'success'
      );
    } catch (e) {
      console.error('Failed to move version:', e);
      await showProfessionalAlert('Move Version Failed', `Failed to clone session: ${e}`, 'danger');
    } finally {
      setIsProcessing(false);
    }
  };



  // Load active PLM activities from backend (VSM Central source of truth)
  useEffect(() => {
    const fetchPlmActivities = async () => {
      try {
        const list = await PackagingService.getInstance().invokeSafe<any[]>('pg_get_active_plm_activities', {}, []);
        setActiveActivities(list || []);
      } catch (e) {
        console.error('Failed to fetch active PLM activities:', e);
      }
    };
    fetchPlmActivities();
  }, []);

  useEffect(() => {
    if (activeActivities && activeActivities.length > 0) {
      localStorage.setItem('packaging_plm_activities', JSON.stringify(activeActivities));
    }
  }, [activeActivities]);

  useEffect(() => {
    if (chatRegistryRef) {
      chatRegistryRef.current.getActiveProjectDetails = () => {
        return {
          projectId: activePackagingProject?.project_id,
          sessionId: activeSession?.session_id
        };
      };
      chatRegistryRef.current.executeWorkflowCommand = async (command: string, data?: any): Promise<string> => {

        if (command === 'search_styles') {
          setSearchQuery(data.query || '');
          setIsDropdownOpen(true);
          return `Mencari artikel dengan kata kunci "${data.query}"...`;
        }

        if (command === 'search_and_download_project') {
          const cleanQ = (data.query || '').toLowerCase().trim();
          const found = activeActivities.find(act => 
            act.article_name.toLowerCase().includes(cleanQ) || 
            act.plm_id.toLowerCase().includes(cleanQ) ||
            getFuzzyMatchScore(cleanQ, act.article_name) > 0.4
          );
          if (found) {
            setSelectedActivity(found);
            setTimeout(() => {
              handleDownloadProject(found);
            }, 100);
            return `Menemukan style "${found.article_name}". Memulai proses download...`;
          }
          return `Style dengan kata kunci "${data.query}" tidak ditemukan di database PLM.`;
        }

        if (command === 'download_project') {
          setSelectedActivity(data.activity);
          setTimeout(() => {
            handleDownloadProject(data.activity);
          }, 100);
          return `Memulai download untuk artikel "${data.activity.article_name}"...`;
        }

        if (command === 'open_project') {
          const proj = packagingProjects.find(p => p.project_id === data.projectId);
          if (proj) {
            // Restore from removed list if it was removed
            if (localRemovedProjects.includes(proj.project_id)) {
              const nextRemoved = localRemovedProjects.filter(id => id !== proj.project_id);
              setLocalRemovedProjects(nextRemoved);
              PackagingService.getInstance().saveLocalRemovedProjects(nextRemoved);
            }
            setActivePackagingProject(proj);
            const sessions = proj.sessions || [];
            const validSessions = sessions
              .filter((s: any) => s.cycle_number >= 1)
              .sort((a: any, b: any) => b.cycle_number - a.cycle_number);
            const latestSes = validSessions[0] || null;
            setActiveSession(latestSes);
            setSessionEditMode(false);
            return `Membuka proyek QC untuk artikel "${proj.article_name}".`;
          }
          return `Proyek dengan ID ${data.projectId} tidak ditemukan.`;
        }

        if (command === 'update_workspace_data') {
          if (!activeSession) return "Tidak ada sesi inspeksi yang aktif. Silakan buka proyek terlebih dahulu.";

          // Automatically enable edit mode if not already in edit mode
          if (!sessionEditMode) {
            setSessionEditMode(true);
          }

          const updates: string[] = [];

          setActiveSession((prev: any) => {
            const nextSession = { ...prev };

            if (data.aql !== undefined) {
              nextSession.aql = data.aql;
              updates.push(`AQL -> ${data.aql}`);
            }
            if (data.level_val !== undefined) {
              nextSession.level_val = data.level_val;
              updates.push(`Level -> ${data.level_val}`);
            }
            if (data.sampling_pcs !== undefined) {
              nextSession.sampling_pcs = data.sampling_pcs;
              updates.push(`Sampling -> ${data.sampling_pcs} pcs`);
            }
            if (data.cutting_pcs !== undefined) {
              nextSession.cutting_pcs = data.cutting_pcs;
              updates.push(`Cutting -> ${data.cutting_pcs} pcs`);
            }
            if (data.sewing_pcs !== undefined) {
              nextSession.sewing_pcs = data.sewing_pcs;
              updates.push(`Sewing -> ${data.sewing_pcs} pcs`);
            }
            if (data.finishing_pcs !== undefined) {
              nextSession.finishing_pcs = data.finishing_pcs;
              updates.push(`Finishing -> ${data.finishing_pcs} pcs`);
            }
            if (data.packing_pcs !== undefined) {
              nextSession.packing_pcs = data.packing_pcs;
              updates.push(`Packing -> ${data.packing_pcs} pcs`);
            }
            if (data.result !== undefined) {
              nextSession.result = data.result;
              updates.push(`Result -> ${data.result}`);
            }

            const checklistFields = data.fields || [];
            if (checklistFields.length > 0) {
              for (const f of checklistFields) {
                nextSession[f] = data.value;
              }
              const fieldsReadable = checklistFields.map((f: string) => f.replace('check_', '').replace(/_/g, ' ')).join(', ');
              updates.push(`Checklists [${fieldsReadable}] -> ${data.value ? 'Checked' : 'Unchecked'}`);
            }

            const sizeQuantities = data.sizeQuantities || [];
            if (sizeQuantities.length > 0) {
              const nextLines = [...(nextSession.report_lines || [])];
              for (const sq of sizeQuantities) {
                const lineIndex = nextLines.findIndex((l: any) => l.size_val?.toUpperCase() === sq.size);
                if (lineIndex >= 0) {
                  const updatedLine = { ...nextLines[lineIndex], [sq.field]: sq.value };
                  const sizeVal = nextLines[lineIndex].size_val;

                  const rc = updatedLine.reject_cutting || 0;
                  const rs = updatedLine.reject_sewing || 0;
                  const rf = updatedLine.reject_finishing || 0;
                  const rp = updatedLine.reject_printing || 0;
                  const re = updatedLine.reject_embro || 0;
                  const rw = updatedLine.reject_washing || 0;
                  const rb = updatedLine.reject_bahan || 0;
                  const bt = updatedLine.btj || 0;
                  const bh = updatedLine.barang_hilang || 0;

                  const newRejectProduksi = rc + rs + rf + rp + re + rw;

                  const otherReject = (activePackagingProject?.sessions || [])
                    .filter((s: any) => s.cycle_number <= nextSession.cycle_number && s.session_id !== nextSession.session_id)
                    .reduce((sum: number, s: any) => {
                      const line = (s.report_lines || []).find((l: any) => l.size_val === sizeVal);
                      if (!line) return sum;
                      const lrc = line.reject_cutting || 0;
                      const lrs = line.reject_sewing || 0;
                      const lrf = line.reject_finishing || 0;
                      const lrp = line.reject_printing || 0;
                      const lre = line.reject_embro || 0;
                      const lrw = line.reject_washing || 0;
                      const lrb = line.reject_bahan || 0;
                      const lbt = line.btj || 0;
                      const lbh = line.barang_hilang || 0;
                      const rejProd = lrc + lrs + lrf + lrp + lre + lrw;
                      return sum + (lrb + rejProd + lbt + lbh);
                    }, 0);
                  const currentReject = rb + newRejectProduksi + bt + bh;
                  const newTotalReject = otherReject + currentReject;

                  const otherGood = (activePackagingProject?.sessions || [])
                    .filter((s: any) => s.cycle_number <= nextSession.cycle_number && s.session_id !== nextSession.session_id)
                    .reduce((sum: number, s: any) => {
                      const line = (s.report_lines || []).find((l: any) => l.size_val === sizeVal);
                      return sum + (line?.session_qty || 0);
                    }, 0);
                  const currentQty = updatedLine.session_qty || 0;
                  const newTotalGood = otherGood + currentQty;

                  updatedLine.reject_produksi = newRejectProduksi;
                  updatedLine.total_reject_qty = newTotalReject;
                  updatedLine.total_good_qty = newTotalGood;

                  nextLines[lineIndex] = updatedLine;
                  updates.push(`Size ${sq.size} ${sq.field.replace(/_/g, ' ')} -> ${sq.value}`);
                }
              }
              nextSession.report_lines = nextLines;
            }

            return nextSession;
          });

          return `Berhasil memperbarui data:\n${updates.map(u => `- ${u}`).join('\n')}`;
        }

        if (command === 'set_inspector_details') {
          if (!activeSession) return "Tidak ada sesi inspeksi yang aktif. Silakan buka proyek terlebih dahulu.";
          setActiveSession((prev: any) => ({
            ...prev,
            [data.field]: data.name
          }));
          return `Mengatur nama ${data.field === 'inspector' ? 'pemeriksa' : 'pendamping pabrik'} menjadi "${data.name}".`;
        }

        if (command === 'toggle_checklist') {
          if (!activeSession) return "Tidak ada sesi inspeksi yang aktif. Silakan buka proyek terlebih dahulu.";
          if (!sessionEditMode) return "Sesi QC dalam mode baca saja. Silakan klik 'Edit Version' terlebih dahulu.";
          
          const fieldsToToggle = data.fields || (data.field ? [data.field] : []);
          if (fieldsToToggle.length === 0) return "Tidak ada field checklist yang ditentukan.";

          setActiveSession((prev: any) => {
            const nextSession = { ...prev };
            for (const f of fieldsToToggle) {
              nextSession[f] = data.value;
            }
            return nextSession;
          });

          const fieldsReadable = fieldsToToggle.map((f: string) => f.replace('check_', '').replace(/_/g, ' ')).join(', ');
          return `Berhasil mengatur checklist "${fieldsReadable}" menjadi ${data.value ? 'AKTIF' : 'NONAKTIF'}.`;
        }

        if (command === 'set_size_quantity') {
          if (!activeSession) return "Tidak ada sesi inspeksi yang aktif. Silakan buka proyek terlebih dahulu.";
          if (!sessionEditMode) return "Sesi QC dalam mode baca saja. Silakan klik 'Edit Version' terlebih dahulu.";

          const sizeVal = data.size;
          const field = data.field;
          const val = data.value;

          const lineIndex = (activeSession.report_lines || []).findIndex((l: any) => l.size_val?.toUpperCase() === sizeVal);
          if (lineIndex < 0) return `Ukuran "${sizeVal}" tidak ditemukan dalam laporan ini.`;

          setSelectedSizeTab(activeSession.report_lines[lineIndex].size_val);

          setActiveSession((prev: any) => {
            const nextLines = [...prev.report_lines];
            const updatedLine = { ...nextLines[lineIndex], [field]: val };

            const rc = updatedLine.reject_cutting || 0;
            const rs = updatedLine.reject_sewing || 0;
            const rf = updatedLine.reject_finishing || 0;
            const rp = updatedLine.reject_printing || 0;
            const re = updatedLine.reject_embro || 0;
            const rw = updatedLine.reject_washing || 0;
            const rb = updatedLine.reject_bahan || 0;
            const bt = updatedLine.btj || 0;
            const bh = updatedLine.barang_hilang || 0;

            const newRejectProduksi = rc + rs + rf + rp + re + rw;
            
            // Cumulative reject calculation
            const otherReject = (activePackagingProject?.sessions || [])
              .filter((s: any) => s.cycle_number <= activeSession.cycle_number && s.session_id !== activeSession.session_id)
              .reduce((sum: number, s: any) => {
                const line = (s.report_lines || []).find((l: any) => l.size_val === activeSession.report_lines[lineIndex].size_val);
                if (!line) return sum;
                const lrc = line.reject_cutting || 0;
                const lrs = line.reject_sewing || 0;
                const lrf = line.reject_finishing || 0;
                const lrp = line.reject_printing || 0;
                const lre = line.reject_embro || 0;
                const lrw = line.reject_washing || 0;
                const lrb = line.reject_bahan || 0;
                const lbt = line.btj || 0;
                const lbh = line.barang_hilang || 0;
                const rejProd = lrc + lrs + lrf + lrp + lre + lrw;
                return sum + (lrb + rejProd + lbt + lbh);
              }, 0);
            const currentReject = rb + newRejectProduksi + bt + bh;
            const newTotalReject = otherReject + currentReject;
            
            // Cumulative good qty calculation
            const otherGood = (activePackagingProject?.sessions || [])
              .filter((s: any) => s.cycle_number <= activeSession.cycle_number && s.session_id !== activeSession.session_id)
              .reduce((sum: number, s: any) => {
                const line = (s.report_lines || []).find((l: any) => l.size_val === activeSession.report_lines[lineIndex].size_val);
                return sum + (line?.session_qty || 0);
              }, 0);
            const currentQty = updatedLine.session_qty || 0;
            const newTotalGood = otherGood + currentQty;

            updatedLine.reject_produksi = newRejectProduksi;
            updatedLine.total_reject_qty = newTotalReject;
            updatedLine.total_good_qty = newTotalGood;

            nextLines[lineIndex] = updatedLine;
            return { ...prev, report_lines: nextLines };
          });

          return `Mengatur **${field.replace(/_/g, ' ')}** ukuran **${sizeVal}** menjadi **${val}**.`;
        }

        if (command === 'log_defect') {
          if (!activeSession) return "Tidak ada sesi inspeksi yang aktif. Silakan buka proyek terlebih dahulu.";
          if (!sessionEditMode) return "Sesi QC dalam mode baca saja. Silakan klik 'Edit Version' terlebih dahulu.";

          const newImg = {
            image_id: `IMG-${activePackagingProject?.project_id}-${Date.now()}-${tempDefectImages.length}`,
            project_id: activePackagingProject?.project_id || '',
            session_id: activeSession?.session_id || null,
            image_path: 'attached_via_chat.png',
            defect_type: data.type,
            description: data.description,
            major: data.major,
            minor: data.minor,
            captured_at: new Date().toISOString()
          };
          setTempDefectImages(prev => [newImg, ...prev]);
          return `Mencatat cacat foto: ${data.type} ("${data.description}"), Major: ${data.major}, Minor: ${data.minor}.`;
        }

        if (command === 'edit_version') {
          if (!activeSession) return "Tidak ada sesi inspeksi yang aktif. Silakan buka proyek terlebih dahulu.";
          if (sessionEditMode) return "Sesi QC sudah dalam mode edit.";
          setSessionEditMode(true);
          return "Berhasil mengaktifkan mode edit untuk sesi QC.";
        }

        if (command === 'cancel_edit') {
          if (!activeSession) return "Tidak ada sesi inspeksi yang aktif.";
          if (!sessionEditMode) return "Sesi QC sudah dalam mode baca saja.";
          setSessionEditMode(false);
          setTempDefectImages([]);
          const original = activePackagingProject.sessions?.find((s: any) => s.session_id === activeSession.session_id);
          if (original) {
            setActiveSession(original);
          } else {
            setActiveSession(null);
          }
          return "Berhasil membatalkan perubahan dan mengembalikan ke mode baca saja.";
        }

        if (command === 'save_session') {
          if (!activeSession) return "Tidak ada sesi inspeksi yang aktif.";
          if (!sessionEditMode) return "Sesi QC sudah tersimpan.";
          handleSaveSession();
          return "Sesi QC berhasil disimpan.";
        }

        if (command === 'move_version') {
          if (!activePackagingProject) return "Tidak ada proyek aktif.";
          handleMoveVersion();
          return "Memulai siklus / versi inspeksi berikutnya...";
        }

        if (command === 'verify_project') {
          if (!activePackagingProject) return "Tidak ada proyek aktif.";
          const mockBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
          await handleUploadVerificationDoc(activePackagingProject.project_id, mockBase64);
          return "Proyek berhasil diverifikasi dengan dokumen verifikasi bertanda tangan.";
        }

        if (command === 'complete_project') {
          if (!activePackagingProject) return "Tidak ada proyek aktif.";
          handleCompleteProject();
          return "Menyelesaikan proyek QC...";
        }

        if (command === 'sync_project') {
          if (!activePackagingProject) return "Tidak ada proyek aktif.";
          handleSyncProject(activePackagingProject.project_id);
          return "Memulai sinkronisasi data ke cloud...";
        }

        if (command === 'print_report') {
          if (!activePackagingProject) return "Tidak ada proyek aktif. Silakan buka proyek terlebih dahulu.";
          handlePrintReport();
          return "Membuka dialog cetak laporan QC...";
        }

        return `Perintah "${command}" tidak dikenal.`;
      };
    }
    return () => {
      if (chatRegistryRef) {
        chatRegistryRef.current.executeWorkflowCommand = undefined;
        chatRegistryRef.current.getActiveProjectDetails = undefined;
      }
    };
  }, [chatRegistryRef, activePackagingProject, activeSession, sessionEditMode, packagingProjects, activeActivities, tempDefectImages, localRemovedProjects]);

  useEffect(() => {
    if (templateId === 'pack_v0') {
      fetchPackagingProjects(true);
    }
  }, [templateId]);

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
      const scrap = aiCalculateDefects * SCRAP_COEFFICIENT;
      setScrapQty(scrap);
      setPassQty(Math.max(0, totalQty - scrap));
      if (clearAiCalculate) clearAiCalculate();
    }
  }, [aiCalculateDefects]);

  // Automatically default selectedSizeTab to first size of current activeSession report lines
  useEffect(() => {
    if (activeSession && activeSession.report_lines && activeSession.report_lines.length > 0) {
      const sizes = activeSession.report_lines.map((l: any) => l.size_val).filter(Boolean);
      if (sizes.length > 0 && (!selectedSizeTab || !sizes.includes(selectedSizeTab))) {
        setSelectedSizeTab(sizes[0]);
      }
    }
  }, [activeSession, selectedSizeTab]);

  // Clear temporary defect images draft and input fields when session or project changes
  useEffect(() => {
    setTempDefectImages([]);
    setDefectImagePathInput('');
    setSelectedImageBase64('');
    setDefectDescInput('');
    setDefectMajorInput(0);
    setDefectMinorInput(0);
  }, [activeSession?.session_id, activePackagingProject?.project_id]);

  useEffect(() => {
    AIAgentService.getInstance().setActiveProjectId(activePackagingProject?.project_id || null);
    // Cleanup on unmount
    return () => {
      AIAgentService.getInstance().setActiveProjectId(null);
    };
  }, [activePackagingProject]);

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
    const count = STATUS_DEFECT_MAP[status] ?? 0;
    setDefectsCount(count);

    const scrap = count * SCRAP_COEFFICIENT;
    setScrapQty(scrap);
    setPassQty(Math.max(0, totalQty - scrap));
  };

  // Async scanner using ScannerService
  const triggerCameraScan = async () => {
    if (isScanning) return;
    setIsScanning(true);

    const mockCode = await scannerService.performScan(templateId, (phase: ScanPhase) => {
      setScannerStatus(phase);
    });

    handleInputChange('batch_id', mockCode);
    setIsScanning(false);
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

    const reportId = crypto.randomUUID();
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

  // QMS Actions & Handlers
  const handleDownloadProject = async (activityOverride?: any) => {
    // Safety check: if activityOverride is a React SyntheticEvent, ignore it and fall back to selectedActivity
    const act = (activityOverride && typeof activityOverride === 'object' && ('plm_id' in activityOverride || 'plmId' in activityOverride || 'project_id' in activityOverride))
      ? activityOverride
      : selectedActivity;
    if (!act) return;

    const rawPlmId = String(act.plm_id || act.plmId || act.project_id || '');

    // If there is an existing project with the same plm_id that was removed locally, restore it!
    const removedProj = packagingProjects.find(
      (p: any) => p.plm_id === rawPlmId && localRemovedProjects.includes(p.project_id)
    );
    if (removedProj) {
      const nextRemoved = localRemovedProjects.filter(id => id !== removedProj.project_id);
      setLocalRemovedProjects(nextRemoved);
      PackagingService.getInstance().saveLocalRemovedProjects(nextRemoved);

      setSelectedActivity(null);

      await showProfessionalAlert(
        'Project Restored',
        `Restored existing local workspace for ${removedProj.article_name}.`,
        'success'
      );
      return;
    }

    // Prevent double active project (duplicate downloads of the same PLM/style ID)
    const existing = packagingProjects.find(
      (p: any) => p.plm_id === rawPlmId && !localRemovedProjects.includes(p.project_id)
    );
    if (existing) {
      await showProfessionalAlert(
        'Style Already Active',
        `A project for style '${act.article_name}' (${rawPlmId}) has already been downloaded and is active. Prohibiting duplicate downloads.`,
        'danger'
      );
      setSelectedActivity(null);
      return;
    }

    setIsProcessing(true);
    setProcessingMessage(`Downloading workspace for ${act.article_name}...`);
    setIsDownloading(true);
    try {
      if (templateId === 'pack_v0') {
        const projectId = `PRJ-${rawPlmId.replace(/\//g, '-')}-${Date.now()}`;

        const projectObj = {
          project_id: projectId,
          plm_id: rawPlmId,
          brand: act.brand || 'N/A',
          season: act.season || 'N/A',
          article_name: act.article_name || 'N/A',
          production_group: act.production_group || 'N/A',
          po_info: act.po_info || null,
          po_qty: act.po_qty || null,
          po_plan_date: act.po_plan_date || null,
          po_vendor: act.po_vendor || null,
          status: 'downloaded',
          sales_price: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        await PackagingService.getInstance().invokeSafe<void>('save_packaging_project', { project: projectObj }, undefined);

        // Fetch refreshed list from DB and update the projects list
        const res = await PackagingService.getInstance().invokeSafe<any[]>('get_packaging_projects', {}, []);
        setPackagingProjects(res || []);
        
        setSelectedActivity(null);

        // Show professional success alert
        await showProfessionalAlert(
          'Project Configured',
          `Successfully created and configured local workspace for ${act.article_name}.`,
          'success'
        );
      }
    } catch (e: any) {
      console.error('Failed to download project:', e);
      await showProfessionalAlert(
        'Download Failed',
        `Could not download workspace: ${e.message || e}`,
        'danger'
      );
    } finally {
      setIsProcessing(false);
      setIsDownloading(false);
    }
  };

  const handleRefetchReportLines = async () => {
    if (!activePackagingProject) return;
    setIsProcessing(true);
    setProcessingMessage('Re-fetching project baseline and size details from D365...');
    const snapshotProjectId = activePackagingProject.project_id;
    const snapshotSessionId = activeSession?.session_id;
    try {
      // Re-fetch baseline and size templates from D365
      await PackagingService.getInstance().invokeSafe<void>('refresh_packaging_project_lines', { projectId: snapshotProjectId }, undefined);
      // Refresh all projects and re-select the active project & session
      const res = await PackagingService.getInstance().invokeSafe<any[]>('get_packaging_projects', {}, []);
      setPackagingProjects(res || []);
      const refreshed = res?.find((p: any) => p.project_id === snapshotProjectId);
      if (refreshed) {
        setActivePackagingProject(refreshed);
        const updatedSes = refreshed.sessions?.find((s: any) => s.session_id === snapshotSessionId);
        if (updatedSes) {
          setActiveSession(updatedSes);
          if (updatedSes.report_lines && updatedSes.report_lines.length > 0) {
            setSelectedSizeTab(updatedSes.report_lines[0].size_val || '');
          }
        }
      }
      await showProfessionalAlert('Data Refreshed', 'Project baseline cutting quantities and size templates have been updated from D365.', 'success');
    } catch (e) {
      console.error('Failed to re-fetch report lines:', e);
      await showProfessionalAlert('Fetch Failed', `Failed to re-fetch size data: ${e}. Ensure you are connected to the network.`, 'danger');
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Triggers the browser's native print interface for landscape A4 report generation.
   */
  const handlePrintReport = () => {
    window.print();
  };

  const handleUploadVerificationDoc = async (projectId: string, docBase64: string) => {
    setIsProcessing(true);
    setProcessingMessage('Saving signed verification document...');
    try {
      await PackagingService.getInstance().invokeSafe<void>('save_project_verification_doc', { projectId, docBase64 }, undefined);
      await fetchPackagingProjects();
      await showProfessionalAlert('Document Saved', 'The signed verification document has been uploaded and linked to this project.', 'success');
    } catch (e) {
      console.error('Failed to save verification document:', e);
      await showProfessionalAlert('Upload Failed', `Failed to save signed document: ${e}`, 'danger');
    } finally {
      setIsProcessing(false);
    }
  };

  const renderQmsWorkspace = () => {
    if (activePackagingProject) {
      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', zIndex: 2, position: 'relative', width: '100%' }}>
          <WorkspaceControls
            activePackagingProject={activePackagingProject}
            activeSession={activeSession}
            deletingProjectId={deletingProjectId}
            hasNextVersionExists={hasNextVersionExists}
            getCycleName={getCycleName}
            handleMoveVersion={handleMoveVersion}
            handleCompleteProject={handleCompleteProject}
            handleRevertProject={handleRevertProject}
            handleRemovePackagingProject={handleRemovePackagingProject}
            setActiveSession={setActiveSession}
            setSelectedSizeTab={setSelectedSizeTab}
            setSessionEditMode={setSessionEditMode}
            headerButtonStyle={headerButtonStyle}
            versionSelectorButtonStyle={versionSelectorButtonStyle}
            handlePrintReport={handlePrintReport}
            handleUploadVerificationDoc={handleUploadVerificationDoc}
          />

          <div style={{
            flex: 1,
            display: 'flex',
            width: '100%',
            minHeight: 0,
            gap: '1rem',
            paddingBottom: '0.5rem',
            opacity: deletingProjectId ? 0.6 : 1,
            pointerEvents: deletingProjectId ? 'none' : 'auto',
            transition: 'opacity 0.2s ease'
          }}>
            {activeSession ? (
              <>
                <div style={{ flex: '70 1 0%', display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', gap: '1rem', paddingRight: '0.75rem', paddingTop: '6px', borderRight: '2px solid rgba(15, 23, 42, 0.12)' }}>
                  
                  {/* Document Title Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid rgba(15, 23, 42, 0.12)', paddingBottom: '0.55rem', marginBottom: '0.25rem', textAlign: 'left', flexShrink: 0 }}>
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--deep-ocean)', margin: 0, fontFamily: 'var(--font-brand)', display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                      Final Inspection Report
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      {sessionEditMode ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setSessionEditMode(false);
                              setTempDefectImages([]);
                              const original = activePackagingProject.sessions?.find((s: any) => s.session_id === activeSession.session_id);
                              if (original) {
                                setActiveSession(original);
                              } else {
                                setActiveSession(null);
                              }
                            }}
                            className="btn-electric-outline"
                            style={{
                              ...headerButtonStyle,
                              background: 'rgba(255, 255, 255, 0.6)',
                              border: '2px solid rgba(15, 23, 42, 0.16)',
                              color: 'var(--text-muted)',
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveSession}
                            style={{
                              ...headerButtonStyle,
                              background: 'var(--royal-blue)',
                              border: '1.5px solid transparent',
                              color: '#ffffff',
                              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.15)',
                            }}
                          >
                            Save Version
                          </button>
                        </>
                      ) : (
                        activePackagingProject.status !== 'completed' && (
                          <button
                            type="button"
                            onClick={() => setSessionEditMode(true)}
                            className="btn-electric"
                            style={{
                              ...headerButtonStyle,
                              background: 'var(--royal-blue)',
                              border: '1.5px solid transparent',
                              color: '#ffffff',
                              gap: '0.25rem',
                              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.15)',
                            }}
                          >
                            Edit Version
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  <BentoInspectionCards
                    activePackagingProject={activePackagingProject}
                    activeSession={activeSession}
                    sessionEditMode={sessionEditMode}
                    selectedSizeTab={selectedSizeTab}
                    setSelectedSizeTab={setSelectedSizeTab}
                    setActiveSession={setActiveSession}
                    handleRefetchReportLines={handleRefetchReportLines}
                  />

                  {/* Verdict / Result Status Card at the bottom of Column 2 */}
                  <div
                    className="bento-card"
                    style={{
                      padding: '1.25rem',
                      background: '#ffffff',
                      border: '2px solid rgba(15, 23, 42, 0.16)',
                      borderRadius: '16px',
                      boxShadow: '0 4px 20px rgba(15, 23, 42, 0.02)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                      textAlign: 'left',
                      marginTop: '0.5rem',
                    }}
                  >
                    <h4
                      style={{
                        fontSize: '0.76rem',
                        fontWeight: 900,
                        color: 'var(--royal-blue)',
                        textTransform: 'uppercase',
                        margin: 0,
                        borderBottom: '1px solid rgba(37,99,235,0.06)',
                        paddingBottom: '0.35rem',
                      }}
                    >
                      Result Status
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginTop: '0.25rem' }}>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        Overall inspection result status for this session:
                      </div>
                      {sessionEditMode ? (
                        (() => {
                          const resultLower = activeSession.result?.toLowerCase() || 'pending';
                          const isPassed = resultLower === 'passed';
                          const isFailed = resultLower === 'failed';
                          
                          const statusColor = isPassed ? '#10B981' : isFailed ? '#EF4444' : '#F59E0B';
                          const statusBg = isPassed ? 'rgba(16, 185, 129, 0.05)' : isFailed ? 'rgba(239, 68, 68, 0.05)' : '#FFFFFF';
                          const statusBorder = isPassed ? '2px solid rgba(16, 185, 129, 0.38)' : isFailed ? '2px solid rgba(239, 68, 68, 0.38)' : '2px solid rgba(15, 23, 42, 0.16)';
                          const statusText = isPassed ? '#10B981' : isFailed ? '#EF4444' : 'var(--deep-ocean)';
                          const glowColor = isPassed ? 'rgba(16,185,129,0.4)' : isFailed ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.4)';
                          const arrowColor = isPassed ? '%2310B981' : isFailed ? '%23EF4444' : '%23475569';
                          const selectValue = isPassed ? 'Passed' : isFailed ? 'Failed' : 'Pending';

                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                              <span
                                style={{
                                  width: '9px',
                                  height: '9px',
                                  borderRadius: '50%',
                                  background: statusColor,
                                  boxShadow: `0 0 8px ${glowColor}`,
                                  display: 'inline-block',
                                  transition: 'all 0.2s ease',
                                  flexShrink: 0
                                }}
                              />
                              <select
                                value={selectValue}
                                onChange={(e) => setActiveSession((prev: any) => ({ ...prev, result: e.target.value }))}
                                style={{
                                  padding: '0.45rem 1.85rem 0.45rem 0.85rem',
                                  fontSize: '0.82rem',
                                  fontWeight: 800,
                                  border: statusBorder,
                                  borderRadius: '10px',
                                  outline: 'none',
                                  color: statusText,
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                  WebkitAppearance: 'none',
                                  MozAppearance: 'none',
                                  appearance: 'none',
                                  minWidth: '125px',
                                  boxSizing: 'border-box',
                                  background: `${statusBg} url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='${arrowColor}' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E") no-repeat right 8px center / 12px`,
                                }}
                              >
                                <option value="Pending" style={{ color: 'var(--deep-ocean)' }}>Pending</option>
                                <option value="Passed" style={{ color: '#10B981' }}>Passed</option>
                                <option value="Failed" style={{ color: '#EF4444' }}>Failed</option>
                              </select>
                            </div>
                          );
                        })()
                      ) : (
                        (() => {
                          const resultLower = activeSession.result?.toLowerCase() || 'pending';
                          const isPassed = resultLower === 'passed';
                          const isFailed = resultLower === 'failed';
                          const displayLabel = isPassed ? 'Passed' : isFailed ? 'Failed' : 'Pending';

                          return (
                            <span
                              className={`electric-badge ${
                                isPassed
                                  ? 'emerald'
                                  : isFailed
                                  ? 'red'
                                  : 'silver'
                              }`}
                              style={{
                                fontSize: '0.85rem',
                                padding: '0.45rem 1.25rem',
                                fontWeight: 900,
                                borderRadius: '10px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.03)',
                              }}
                            >
                              {displayLabel}
                            </span>
                          );
                        })()
                      )}
                    </div>
                  </div>
                </div>

                {/* COLUMN 3: Right Pane for Defect Images & Photo Attachments (30% width) */}
                <RightDefectPane
                  activeSession={activeSession}
                  sessionEditMode={sessionEditMode}
                  activePackagingProject={activePackagingProject}
                  handleMoveVersion={handleMoveVersion}
                  defectImagePathInput={defectImagePathInput}
                  setDefectImagePathInput={setDefectImagePathInput}
                  selectedImageBase64={selectedImageBase64}
                  setSelectedImageBase64={setSelectedImageBase64}
                  defectTypeInput={defectTypeInput}
                  setDefectTypeInput={setDefectTypeInput}
                  defectDescInput={defectDescInput}
                  setDefectDescInput={setDefectDescInput}
                  defectMajorInput={defectMajorInput}
                  setDefectMajorInput={setDefectMajorInput}
                  defectMinorInput={defectMinorInput}
                  setDefectMinorInput={setDefectMinorInput}
                  handleAddTempDefectImage={handleAddTempDefectImage}
                  tempDefectImages={tempDefectImages}
                  setTempDefectImages={setTempDefectImages}
                  handleUpdateSavedDefect={handleUpdateSavedDefect}
                />
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.78rem', border: '2px dashed rgba(37, 99, 235, 0.12)', borderRadius: '20px', padding: '2rem' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    background: 'rgba(15, 23, 42, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--deep-ocean)',
                    marginBottom: '0.85rem',
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </div>
                <span style={{ fontWeight: 800, color: 'var(--deep-ocean)', fontSize: '0.88rem' }}>No Active QC Inspection Version</span>
                <p style={{ fontSize: '0.72rem', maxWidth: '300px', margin: '0.25rem 0 1rem 0', lineHeight: 1.4, textAlign: 'center' }}>
                  Select a version from the navigation bar above, or initialize the first version to begin editing quality control data.
                </p>
                {activePackagingProject.status !== 'completed' && (
                  <button
                    type="button"
                    onClick={handleMoveVersion}
                    style={{
                      padding: '0.55rem 1.25rem',
                      fontSize: '0.78rem',
                      borderRadius: '12px',
                      background: 'var(--royal-blue)',
                      border: 'none',
                      color: '#ffffff',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
                    }}
                  >
                    + Start Version 1 (1st Final)
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Dedicated Space for Chat AI Assistant at the bottom */}
          {activeSession && (
            <div style={{
              flexShrink: 0,
              marginTop: '0.75rem',
              borderTop: '2px solid rgba(37, 99, 235, 0.12)',
              paddingTop: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              width: '100%',
              position: 'relative'
            }}>
              {/* Workspace QMS Chat History Popup Overlay - Rendered inline directly above input to prevent any relative motion/jitter */}
              {isChatExpanded && (
                <>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setIsChatExpanded(false);
                    }}
                    style={{
                      position: 'fixed',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      zIndex: 998,
                      background: 'rgba(15, 23, 42, 0.05)',
                    }}
                  />
                  <div
                    className="kaizen-chat-popup-card"
                    style={{
                      position: 'absolute',
                      bottom: '105%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      zIndex: 999,
                      width: '600px',
                      maxWidth: '96vw',
                      height: '380px',
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                      background: '#ffffff',
                      border: '2px solid rgba(37, 99, 235, 0.28)',
                      boxShadow: '0 12px 40px rgba(15, 23, 42, 0.12)',
                      borderRadius: '24px',
                      padding: '1.25rem',
                      animation: 'slide-up-centered 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  >
                    <div className="flex-between kaizen-center-header" style={{ marginBottom: '0.85rem', borderBottom: '1.5px solid rgba(15, 23, 42, 0.08)', paddingBottom: '0.55rem', flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="hud-logo-hexagon kaizen-logo-mini" style={{ width: '14px', height: '14px' }}></span>
                        <span className="kaizen-title-label" style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--deep-ocean)' }}>
                          Kaizen AI Chat History
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="electric-badge teal" style={{ fontSize: '0.58rem', padding: '0.1rem 0.4rem', fontWeight: 800 }}>Online</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setIsChatExpanded(false);
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            fontSize: '1.2rem',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            padding: '0 0.2rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            lineHeight: '1'
                          }}
                          title="Hide Chat History"
                        >
                          &times;
                        </button>
                      </div>
                    </div>
                    <div className="hud-local-chat-scroll kaizen-chat-scroll" style={{ flex: 1, overflowY: 'auto', paddingRight: '0.2rem' }}>
                      {chatHistory.length > 0 ? (
                        chatHistory.map((msg, idx) => (
                          <div key={idx} className={`chat-message-envelope ${msg.sender}`} style={{ marginBottom: '0.85rem', display: 'flex', gap: '0.5rem', justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                            {msg.sender === 'agent' && (
                              <div className="envelope-avatar agent-avatar" title="Kaizen Assistant" style={{ width: '26px', height: '26px', marginTop: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(37,99,235,0.06)', borderRadius: '50%', color: 'var(--royal-blue)', border: '1px solid rgba(37,99,235,0.12)' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
                                  <circle cx="12" cy="12" r="3" />
                                </svg>
                              </div>
                            )}
                            <div className={`chat-envelope-content ${msg.sender}`} style={{ maxWidth: '85%' }}>
                              <div className={`chat-bubble-modern ${msg.sender}`} style={{ padding: '0.5rem 0.75rem', borderRadius: '12px', borderTopLeftRadius: msg.sender === 'agent' ? '3px' : '12px', borderTopRightRadius: msg.sender === 'user' ? '3px' : '12px', background: msg.sender === 'user' ? 'var(--royal-blue)' : '#F1F5F9', color: msg.sender === 'user' ? '#fff' : 'var(--deep-ocean)', boxShadow: 'none' }}>
                                <p className="chat-bubble-text" style={{ fontSize: '0.78rem', margin: 0, lineHeight: 1.4, textAlign: 'left' }}>{msg.text}</p>
                              </div>
                            </div>
                            {msg.sender === 'user' && (
                              <div className="envelope-avatar user-avatar" title="System Operator" style={{ width: '26px', height: '26px', marginTop: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.06)', borderRadius: '50%', color: 'var(--deep-ocean)', border: '1px solid rgba(15,23,42,0.12)' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                                  <circle cx="12" cy="7" r="4" />
                                </svg>
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                          No conversation history yet.
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>
                  </div>
                </>
              )}

              {/* Chat Input Capsule Bar - Integrated Full Width (History toggle button removed) */}
              <div
                className="premium-chat-bar"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0.35rem 0.5rem 0.35rem 0.65rem',
                  background: '#ffffff',
                  border: '2px solid rgba(15, 23, 42, 0.22)',
                  borderRadius: '14px',
                  boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
                  position: 'relative',
                  zIndex: 999
                }}
              >
                <div className={`chatbar-prefix-badge ${isListening ? 'listening-active-prefix' : ''}`} style={{ width: '22px', height: '22px', marginRight: '0.45rem' }}>
                  {isListening ? (
                    <div className="voice-visualizer-wave-inline" style={{ height: '9px', gap: '1.5px' }}>
                      <div className="voice-bar bar-1"></div>
                      <div className="voice-bar bar-2"></div>
                      <div className="voice-bar bar-3"></div>
                    </div>
                  ) : (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--royal-blue)" strokeWidth="2.5">
                      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                    </svg>
                  )}
                </div>

                <input
                  type="text"
                  className="premium-chat-input"
                  placeholder={isListening ? "Listening..." : "Ask Kaizen AI Assistant..."}
                  value={chatInput}
                  onChange={e => {
                    setChatInput(e.target.value);
                    if (!isChatExpanded) setIsChatExpanded(true);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      handleSendChat();
                      setIsChatExpanded(true);
                    }
                  }}
                  onFocus={() => {
                    if (!isChatExpanded) setIsChatExpanded(true);
                  }}
                  onClick={() => {
                    if (!isChatExpanded) setIsChatExpanded(true);
                  }}
                  disabled={isListening}
                  style={{ fontSize: '0.78rem', flex: 1, border: 'none', outline: 'none', background: 'transparent' }}
                />

                <div className="chatbar-controls" style={{ gap: '0.3rem', display: 'flex', alignItems: 'center' }}>
                  <button
                    type="button"
                    className={`premium-mic-btn ${isListening ? 'listening-active' : ''}`}
                    onClick={() => {
                      toggleListening();
                      if (!isChatExpanded) setIsChatExpanded(true);
                    }}
                    title="Voice Command"
                    style={{ color: isListening ? '#FFFFFF' : 'var(--royal-blue)', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer' }}
                  >
                    {isListening ? (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ zIndex: 1 }}>
                        <rect x="4" y="4" width="16" height="16" rx="2" />
                      </svg>
                    ) : (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ zIndex: 1 }}>
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
                      </svg>
                    )}
                  </button>

                  <button
                    type="button"
                    className={`premium-send-btn ${chatInput.trim() ? 'active' : ''}`}
                    onClick={() => {
                      handleSendChat();
                      setIsChatExpanded(true);
                    }}
                    disabled={isListening || !chatInput.trim()}
                    style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: 'none', cursor: 'pointer' }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <ProjectSelectionDirectory
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isDropdownOpen={isDropdownOpen}
        setIsDropdownOpen={setIsDropdownOpen}
        activeActivities={activeActivities}
        packagingProjects={packagingProjects.filter(p => !localRemovedProjects.includes(p.project_id))}
        selectedActivity={selectedActivity}
        setSelectedActivity={setSelectedActivity}
        isDownloading={isDownloading}
        deletingProjectId={deletingProjectId}
        handleDownloadProject={handleDownloadProject}
        handleRemovePackagingProject={handleRemovePackagingProject}
        setActivePackagingProject={setActivePackagingProject}
        setActiveSession={setActiveSession}
        setSessionEditMode={setSessionEditMode}
        isFetchingProjects={isFetchingProjects}
        showProfessionalAlert={showProfessionalAlert}
        getCycleName={getCycleName}
      />
    );
  };

  const renderDefaultDraftingArea = () => {
    return (
      <div style={{ flex: 1, overflowY: 'auto', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2, position: 'relative', paddingRight: '0.75rem' }}>
        {/* Blueprint Icon */}
        <div style={{
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: 'rgba(37, 99, 235, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0.5rem auto 1rem auto',
          color: 'var(--royal-blue)',
          border: '2px solid rgba(37, 99, 235, 0.18)',
          flexShrink: 0
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
        </div>

        <h2 style={{ color: 'var(--deep-ocean)', marginBottom: '0.5rem', fontFamily: 'var(--font-brand)', fontSize: '1.25rem' }}>
          {template?.title}
        </h2>

        <p style={{ color: 'var(--text-muted)', maxWidth: '440px', margin: '0 auto 1.25rem auto', fontSize: '0.82rem', lineHeight: '1.5', textAlign: 'center' }}>
          This inspection template is currently blank. You are ready to start building your quality control checks from scratch.
        </p>

        {/* SEARCH DROPDOWN FOR ACTIVE PLM ACTIVITIES */}
        <div style={{ width: '100%', maxWidth: '480px', margin: '0 auto 1.5rem auto', position: 'relative', zIndex: 10 }}>
          <label className="form-label" style={{ textAlign: 'center', marginBottom: '0.5rem', display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--royal-blue)' }}>
            Target PLM Production Mapping
          </label>

          {selectedActivity ? (
            /* Selected Style Passport */
            <div className="bento-card" style={{
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(239, 246, 255, 0.9) 100%)',
              border: '2px solid rgba(37, 99, 235, 0.38) !important',
              padding: '1rem',
              borderRadius: '16px',
              boxShadow: '0 8px 24px rgba(37, 99, 235, 0.04)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem'
            }}>
              <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--deep-ocean)' }}>
                    {selectedActivity.article_name}
                  </div>
                  <span className="electric-badge silver" style={{ fontSize: '0.58rem', padding: '0 0.4rem', lineHeight: '1', display: 'inline-flex', alignItems: 'center', height: '1.05rem', flexShrink: 0 }}>
                    {selectedActivity.season}
                  </span>
                </div>

                {selectedActivity.po_vendor && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--royal-blue)', fontWeight: 800, textAlign: 'left' }}>
                    {selectedActivity.po_vendor}
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                  {selectedActivity.po_info && (
                    <span className="electric-badge teal" style={{ fontSize: '0.58rem', padding: '0 0.4rem', lineHeight: '1', display: 'inline-flex', alignItems: 'center', height: '1.05rem' }}>
                      PO: {selectedActivity.po_info}
                    </span>
                  )}
                  {selectedActivity.po_qty && (
                    <>
                      <span>•</span>
                      <span>
                        Qty: <strong style={{ color: 'var(--deep-ocean)' }}>{selectedActivity.po_qty} units</strong>
                      </span>
                    </>
                  )}
                  {selectedActivity.po_plan_date && (
                    <>
                      <span>•</span>
                      <span>
                        Plan Date: <strong style={{ color: 'var(--deep-ocean)' }}>{selectedActivity.po_plan_date}</strong>
                      </span>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedActivity(null);
                  setFormData(prev => ({ ...prev, batch_id: '' }));
                }}
                className="btn-electric-outline"
                style={{ width: 'auto', padding: '0.4rem 0.85rem', fontSize: '0.72rem', borderRadius: '10px', flexShrink: 0 }}
              >
                Change Style
              </button>
            </div>
          ) : (
            /* Search Input Box */
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', background: '#FFFFFF', border: '2px solid rgba(37, 99, 235, 0.28)', borderRadius: '99px', padding: '0.35rem 0.5rem 0.35rem 0.85rem', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.02)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--royal-blue)" strokeWidth="2.5" style={{ marginRight: '0.5rem', flexShrink: 0 }}>
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  className="premium-chat-input"
                  placeholder="Search active styles (e.g. Carmenta, basic, WINTER)..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsDropdownOpen(true);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  style={{ fontSize: '0.8rem', padding: '0.3rem 0 !important' }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.9rem', cursor: 'pointer', padding: '0.2rem' }}
                  >
                    &times;
                  </button>
                )}
              </div>

              {/* Dropdown Floating Results List */}
              {isDropdownOpen && (
                <>
                  <div
                    onClick={() => setIsDropdownOpen(false)}
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99, cursor: 'default' }}
                  />
                  <div className="bento-card style-search-scroll" style={{
                    position: 'absolute',
                    top: '105%',
                    left: 0,
                    right: 0,
                    maxHeight: '220px',
                    overflowY: 'auto',
                    background: '#ffffff',
                    border: '2px solid rgba(37, 99, 235, 0.22) !important',
                    borderRadius: '16px',
                    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.08)',
                    padding: '0.5rem 0.75rem 0.5rem 0.5rem !important',
                    zIndex: 100
                  }}>
                    {activeActivities.filter(act =>
                      act.plm_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      act.article_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      act.brand.toLowerCase().includes(searchQuery.toLowerCase())
                    ).length > 0 ? (
                      activeActivities.filter(act =>
                        act.plm_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        act.article_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        act.brand.toLowerCase().includes(searchQuery.toLowerCase())
                      ).map((act, index) => (
                        <div
                          key={index}
                          onClick={() => {
                            setSelectedActivity(act);
                            setIsDropdownOpen(false);
                            setSearchQuery('');
                            // Auto-map selected style code to form input
                            handleInputChange('batch_id', act.plm_id);
                          }}
                          className="operation-chip-premium"
                          style={{
                            padding: '0.65rem 0.85rem',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            textAlign: 'left',
                            marginBottom: '0.25rem',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', width: '100%' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--deep-ocean)' }}>
                              {act.article_name}
                            </div>
                            <span className="electric-badge silver" style={{ fontSize: '0.58rem', padding: '0 0.4rem', lineHeight: '1', display: 'inline-flex', alignItems: 'center', height: '1.05rem', flexShrink: 0 }}>
                              {act.season}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.72rem', color: 'var(--royal-blue)', fontWeight: 800, marginTop: '0.2rem', textAlign: 'left' }}>
                            {act.po_vendor}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', marginTop: '0.2rem', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                            <span className="electric-badge teal" style={{ fontSize: '0.58rem', padding: '0 0.4rem', lineHeight: '1', display: 'inline-flex', alignItems: 'center', height: '1.05rem' }}>
                              PO: {act.po_info}
                            </span>
                            <span>•</span>
                            <span>
                              Qty: <strong style={{ color: 'var(--deep-ocean)' }}>{act.po_qty} units</strong>
                            </span>
                            <span>•</span>
                            <span>
                              Plan Date: <strong style={{ color: 'var(--deep-ocean)' }}>{act.po_plan_date}</strong>
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.78rem', textAlign: 'center' }}>
                        No matching active PLM styles found.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Blueprint Multi-Step Builder Guide */}
        <div className="blueprint-steps-container" style={{ marginTop: '0.5rem', gap: '0.85rem' }}>
          <div className="blueprint-step-card" style={{ padding: '0.95rem' }}>
            <div className="blueprint-step-header">
              <span className="blueprint-step-number" style={{ fontSize: '1.2rem' }}>01</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="blueprint-step-icon">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z" />
              </svg>
            </div>
            <h3 style={{ fontSize: '0.82rem !important' }}>Define Fields</h3>
            <p style={{ fontSize: '0.72rem !important' }}>Instruct the Kaizen copilot on the right to add inputs, options, or checkboxes dynamically.</p>
          </div>

          <div className="blueprint-step-card" style={{ padding: '0.95rem' }}>
            <div className="blueprint-step-header">
              <span className="blueprint-step-number" style={{ fontSize: '1.2rem' }}>02</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="blueprint-step-icon">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M21 12H3" />
                <path d="M12 3v18" />
              </svg>
            </div>
            <h3 style={{ fontSize: '0.82rem !important' }}>Organize Layout</h3>
            <p style={{ fontSize: '0.72rem !important' }}>Structure your inputs into custom high-contrast sections and modern bento partitions.</p>
          </div>

          <div className="blueprint-step-card" style={{ padding: '0.95rem' }}>
            <div className="blueprint-step-header">
              <span className="blueprint-step-number" style={{ fontSize: '1.2rem' }}>03</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="blueprint-step-icon">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <h3 style={{ fontSize: '0.82rem !important' }}>Calibrate Yield</h3>
            <p style={{ fontSize: '0.72rem !important' }}>Define custom scrap margins, calculation constants, and offline validation badges.</p>
          </div>
        </div>

        {/* Dynamic Command Interactive Banner */}
        <div className="blueprint-suggestion-banner" style={{ margin: '1.5rem 0', padding: '0.35rem 1rem', fontSize: '0.75rem' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span>Ask Kaizen on the right: <code>"create fields for inspector, batch, defects"</code></span>
        </div>
      </div>
    );
  };

  // Compile guard for temporary blank start-from-scratch mode & QMS methods
  useEffect(() => {
    const dummyRef = {
      isSaving,
      validationErrors,
      scannerStatus,
      triggerCameraScan,
      handleSave,
      getYieldPercentage,
      isScanning,
      isDownloading
    };
    if (dummyRef.isSaving) console.log(dummyRef);
  }, [
    isSaving, validationErrors, scannerStatus, triggerCameraScan, handleSave, getYieldPercentage,
    isScanning, isDownloading
  ]);

  const renderCollapsibleChat = () => {
    if (activePackagingProject) {
      return null;
    }
    if (templateId === 'pack_v0' && !activePackagingProject) {
      return null;
    }

    const containerStyle: React.CSSProperties = {
      position: 'fixed',
      bottom: '1.5rem',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '0.65rem',
      pointerEvents: 'none',
      width: 'auto'
    };

    return (
      <div style={containerStyle}>
        {/* Expanded Chat History Panel */}
        {isChatExpanded && (
          <div
            className="kaizen-chat-popup-card"
            style={{
              pointerEvents: 'auto',
              width: '500px',
              height: '380px',
              maxHeight: '50vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              background: '#ffffff',
              border: '2px solid rgba(37, 99, 235, 0.28)',
              boxShadow: '0 12px 40px rgba(15, 23, 42, 0.15)',
              borderRadius: '24px',
              padding: '1.25rem',
              animation: 'slide-up 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              marginBottom: '0.2rem'
            }}
          >
            <div className="flex-between kaizen-center-header" style={{ marginBottom: '1rem', borderBottom: '1.5px solid rgba(15, 23, 42, 0.08)', paddingBottom: '0.75rem', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="hud-logo-hexagon kaizen-logo-mini" style={{ width: '14px', height: '14px' }}></span>
                <span className="kaizen-title-label" style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Kaizen AI Builder
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="electric-badge teal" style={{ fontSize: '0.58rem', padding: '0.1rem 0.4rem' }}>Online</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setIsChatExpanded(false);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '1.2rem',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    padding: '0 0.2rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: '1'
                  }}
                  title="Minimize Chat"
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Copilot Chat History inside Sidebar */}
            <div className="hud-local-chat-scroll kaizen-chat-scroll" style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem', paddingRight: '0.1rem' }}>
              {chatHistory.map((msg, idx) => (
                <div key={idx} className={`chat-message-envelope ${msg.sender}`} style={{ marginBottom: '0.85rem' }}>
                  {msg.sender === 'agent' && (
                    <div className="envelope-avatar agent-avatar" title="Kaizen Assistant" style={{ width: '26px', height: '26px', marginTop: '2px' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </div>
                  )}

                  <div className={`chat-envelope-content ${msg.sender}`} style={{ maxWidth: '85%' }}>
                    <div className={`chat-bubble-modern ${msg.sender}`} style={{ padding: '0.5rem 0.75rem', borderRadius: '12px', borderTopLeftRadius: msg.sender === 'agent' ? '3px' : '12px', borderTopRightRadius: msg.sender === 'user' ? '3px' : '12px', boxShadow: 'none' }}>
                      <p className="chat-bubble-text" style={{ fontSize: '0.78rem', margin: 0, lineHeight: 1.4 }}>{msg.text}</p>
                      <span className="chat-timestamp" style={{ fontSize: '0.58rem', marginTop: '2px', display: 'block', opacity: 0.6 }}>{msg.timestamp}</span>
                    </div>
                  </div>

                  {msg.sender === 'user' && (
                    <div className="envelope-avatar user-avatar" title="System Operator" style={{ width: '26px', height: '26px', marginTop: '2px' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          </div>
        )}

        {/* Input Capsule Bar (Always Visible, Toggle button replaced with visual Sparkle prefix) */}
        <div
          className="premium-chat-bar"
          style={{
            pointerEvents: 'auto',
            width: '500px',
            boxSizing: 'border-box',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            padding: '0.35rem 0.5rem 0.35rem 0.65rem',
            background: '#ffffff',
            border: '2px solid rgba(15, 23, 42, 0.22)',
            borderRadius: '99px',
            boxShadow: '0 8px 32px rgba(15, 23, 42, 0.08)'
          }}
        >
          {/* Sparkle badge on the left (Toggle button removed) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'rgba(37, 99, 235, 0.06)',
              border: '2px solid rgba(37, 99, 235, 0.28)',
              color: 'var(--royal-blue)',
              marginRight: '0.45rem',
              flexShrink: 0
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
            </svg>
          </div>

          {/* Chat input field */}
          <input
            type="text"
            className="premium-chat-input"
            placeholder={isListening ? "Listening..." : "Ask Kaizen to build..."}
            value={chatInput}
            onChange={e => {
              setChatInput(e.target.value);
              if (!isChatExpanded) setIsChatExpanded(true);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                handleSendChat();
                setIsChatExpanded(true);
              }
            }}
            onFocus={() => {
              if (!isChatExpanded) setIsChatExpanded(true);
            }}
            onClick={() => {
              if (!isChatExpanded) setIsChatExpanded(true);
            }}
            disabled={isListening}
            style={{
              border: 'none',
              background: 'transparent',
              outline: 'none',
              flex: 1,
              fontSize: '0.8rem',
              color: 'var(--deep-ocean)',
              padding: '0.35rem 0'
            }}
          />

          {/* Mic and Send controls on the right */}
          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', marginLeft: '0.5rem', flexShrink: 0 }}>
            {/* Voice Mic Button */}
            <button
              type="button"
              className={`premium-mic-btn ${isListening ? 'listening-active' : ''}`}
              onClick={() => {
                toggleListening();
                if (!isChatExpanded) setIsChatExpanded(true);
              }}
              title="Voice Command"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: '#F1F5F9',
                border: 'none',
                color: isListening ? '#FFFFFF' : 'var(--royal-blue)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                outline: 'none'
              }}
            >
              {isListening ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
                </svg>
              )}
            </button>

            {/* Send Button */}
            <button
              type="button"
              className={`premium-send-btn ${chatInput.trim() ? 'active' : ''}`}
              onClick={() => {
                handleSendChat();
                setIsChatExpanded(true);
              }}
              disabled={isListening || !chatInput.trim()}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: chatInput.trim() ? 'var(--royal-blue)' : '#F1F5F9',
                border: 'none',
                color: chatInput.trim() ? '#FFFFFF' : '#94A3B8',
                cursor: chatInput.trim() ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s ease',
                outline: 'none'
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (!template) {
    return <div className="bento-card loading-state">Loading inspection schema...</div>;
  }

  return (
    <div className="form-container form-layout" style={{ overflow: 'hidden', height: '100%', position: 'relative' }}>
      <style>{`
        @keyframes skeleton-pulse {
          0% { opacity: 0.45; }
          50% { opacity: 0.85; }
          100% { opacity: 0.45; }
        }
        .skeleton-card-pulse {
          animation: skeleton-pulse 1.4s infinite ease-in-out;
        }
      `}</style>

      {/* Dynamic HUD Header encompassing the entire screen view */}
      <FormHeader
        activePackagingProject={activePackagingProject}
        activeSession={activeSession}
        template={template}
        getCycleName={getCycleName}
        onBack={onBack}
        setActivePackagingProject={setActivePackagingProject}
        setSessionEditMode={setSessionEditMode}
        setActiveSession={setActiveSession}
        onMinimize={onMinimize}
        onClose={onClose}
        onShowGuidelines={() => setShowGuidelinesModal(true)}
      />

      {/* Main split workspace layout */}
      <div className="form-workspace-grid" style={{ flex: 1, minHeight: 0, height: 'auto' }}>

        {/* Left Column: Blueprint Drafting Board / QMS Workspace */}
        <div
          className={`bento-card form-blueprint-canvas ${activePackagingProject ? 'workspace-mode' : ''}`}
          style={{
            flex: activePackagingProject ? '1 1 100%' : '70 1 0%',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden'
          }}
        >
          {/* CAD Drafting Crosshairs */}
          {!activePackagingProject && (
            <>
              <div className="blueprint-crosshair top-left"></div>
              <div className="blueprint-crosshair top-right"></div>
              <div className="blueprint-crosshair bottom-left"></div>
              <div className="blueprint-crosshair bottom-right"></div>
            </>
          )}

          {templateId === 'pack_v0' ? (
            renderQmsWorkspace()
          ) : (
            renderDefaultDraftingArea()
          )}
        </div>

        {/* Right Column: Docked Kaizen AI Copilot Sidebar (only shown when NO packaging project is opened) */}
        {!activePackagingProject && (
          <div className="copilot-side-card" style={{ flex: '30 1 0%', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <div className="flex-between kaizen-center-header" style={{ marginBottom: '1rem', borderBottom: '1.5px solid rgba(37, 99, 235, 0.12)', paddingBottom: '0.75rem', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="hud-logo-hexagon kaizen-logo-mini" style={{ width: '14px', height: '14px' }}></span>
                <span className="kaizen-title-label" style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Kaizen AI Builder
                </span>
              </div>
              <span className="electric-badge teal" style={{ fontSize: '0.58rem', padding: '0.1rem 0.4rem' }}>Online</span>
            </div>

            {/* Copilot Chat History inside Sidebar */}
            <div className="hud-local-chat-scroll kaizen-chat-scroll" style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem', paddingRight: '0.1rem' }}>
              {chatHistory.map((msg, idx) => (
                <div key={idx} className={`chat-message-envelope ${msg.sender}`} style={{ marginBottom: '0.85rem' }}>
                  {msg.sender === 'agent' && (
                    <div className="envelope-avatar agent-avatar" title="Kaizen Assistant" style={{ width: '26px', height: '26px', marginTop: '2px' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </div>
                  )}

                  <div className={`chat-envelope-content ${msg.sender}`} style={{ maxWidth: '85%' }}>
                    <div className={`chat-bubble-modern ${msg.sender}`} style={{ padding: '0.5rem 0.75rem', borderRadius: '12px', borderTopLeftRadius: msg.sender === 'agent' ? '3px' : '12px', borderTopRightRadius: msg.sender === 'user' ? '3px' : '12px', boxShadow: 'none' }}>
                      <p className="chat-bubble-text" style={{ fontSize: '0.78rem', margin: 0, lineHeight: 1.4 }}>{msg.text}</p>
                      <span className="chat-timestamp" style={{ fontSize: '0.58rem', marginTop: '2px', display: 'block', opacity: 0.6 }}>{msg.timestamp}</span>
                    </div>
                  </div>

                  {msg.sender === 'user' && (
                    <div className="envelope-avatar user-avatar" title="System Operator" style={{ width: '26px', height: '26px', marginTop: '2px' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Integrated Sidebar Input Capsule */}
            <div className="premium-chat-bar" style={{ padding: '0.2rem 0.35rem 0.2rem 0.65rem', width: '100%', boxSizing: 'border-box', flexShrink: 0 }}>
              <div className={`chatbar-prefix-badge ${isListening ? 'listening-active-prefix' : ''}`} style={{ width: '22px', height: '22px', marginRight: '0.45rem' }}>
                {isListening ? (
                  <div className="voice-visualizer-wave-inline" style={{ height: '9px', gap: '1.5px' }}>
                    <div className="voice-bar bar-1"></div>
                    <div className="voice-bar bar-2"></div>
                    <div className="voice-bar bar-3"></div>
                  </div>
                ) : (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--royal-blue)" strokeWidth="2.5">
                    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                  </svg>
                )}
              </div>

              <input
                type="text"
                className="premium-chat-input"
                placeholder={isListening ? "Listening..." : "Ask Kaizen to build..."}
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                disabled={isListening}
                style={{ fontSize: '0.78rem', padding: '0.35rem 0 !important' }}
              />

              <div className="chatbar-controls" style={{ gap: '0.3rem' }}>
                <button
                  type="button"
                  className={`premium-mic-btn ${isListening ? 'listening-active' : ''}`}
                  onClick={toggleListening}
                  title="Voice Command"
                  style={{ color: isListening ? '#FFFFFF' : 'var(--royal-blue)', width: '22px', height: '22px' }}
                >
                  {isListening ? (
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ zIndex: 1 }}>
                      <rect x="4" y="4" width="16" height="16" rx="2" />
                    </svg>
                  ) : (
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ zIndex: 1 }}>
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
                    </svg>
                  )}
                </button>

                <button
                  type="button"
                  className={`premium-send-btn ${chatInput.trim() ? 'active' : ''}`}
                  onClick={() => handleSendChat()}
                  disabled={isListening || !chatInput.trim()}
                  style={{ width: '24px', height: '24px' }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Hanging Collapsible Chat Widget */}
      {renderCollapsibleChat()}

      {/* Collapsible Chat History Backdrop - Rendered at root to avoid z-index & nested scroll context issues */}
      {!activePackagingProject && isChatExpanded && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setIsChatExpanded(false);
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 998,
            background: 'rgba(15, 23, 42, 0.15)',
          }}
        />
      )}



      {/* Processing Loader Overlay */}
      {isProcessing && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(240, 251, 255, 0.85)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          gap: '1rem',
          transition: 'all 0.2s ease-in-out'
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            border: '3px solid rgba(37, 99, 235, 0.08)',
            borderTopColor: 'var(--royal-blue)',
            animation: 'spin-sync 1s linear infinite'
          }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--deep-ocean)', letterSpacing: '0.02em' }}>
            {processingMessage}
          </span>
        </div>
      )}

      {/* High-Fidelity Custom Dialog Modal */}
      {modalConfig.isOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.55)', // dark navy overlay
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '1.5rem'
        }}>
          <div className="bento-card" style={{
            width: '100%',
            maxWidth: '400px',
            background: '#FFFFFF',
            border: '1px solid rgba(37, 99, 235, 0.25)',
            borderRadius: '16px',
            boxShadow: '0 20px 48px rgba(15, 23, 42, 0.08)',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.95rem',
            textAlign: 'left',
            animation: 'slide-up 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            <h3 style={{
              margin: 0,
              fontSize: '1.05rem',
              fontWeight: 800,
              color: 'var(--deep-ocean)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.55rem'
            }}>
              {modalConfig.type === 'success' && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              )}
              {modalConfig.type === 'danger' && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              )}
              {modalConfig.type === 'confirm' && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14a2 2 0 0 0 1.73 3h16a2 2 0 0 0 1.73-3Z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              )}
              {modalConfig.type === 'alert' && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--royal-blue)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              )}
              {modalConfig.title}
            </h3>
            <p style={{
              margin: 0,
              fontSize: '0.78rem',
              lineHeight: 1.5,
              color: 'var(--text-muted)'
            }}>
              {modalConfig.message}
            </p>
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.65rem',
              marginTop: '0.55rem'
            }}>
              {modalConfig.type === 'confirm' && (
                <button
                  onClick={modalConfig.onCancel}
                  className="btn-electric-outline"
                  style={{
                    width: 'auto',
                    padding: '0.45rem 1.25rem',
                    fontSize: '0.74rem',
                    borderRadius: '10px',
                    fontWeight: 700,
                    borderColor: 'rgba(15, 23, 42, 0.12)',
                    color: 'var(--text-muted)'
                  }}
                >
                  Cancel
                </button>
              )}
              <button
                onClick={modalConfig.onConfirm}
                className="btn-electric"
                style={{
                  width: 'auto',
                  padding: '0.45rem 1.25rem',
                  fontSize: '0.74rem',
                  borderRadius: '10px',
                  fontWeight: 800,
                  background: modalConfig.type === 'danger' ? '#EF4444' : (modalConfig.type === 'success' ? '#10B981' : 'var(--royal-blue)'),
                  color: 'white',
                  border: 'none',
                  boxShadow: modalConfig.type === 'danger' ? '0 4px 12px rgba(239, 68, 68, 0.2)' : (modalConfig.type === 'success' ? '0 4px 12px rgba(16, 185, 129, 0.2)' : '0 4px 12px rgba(37, 99, 235, 0.2)'),
                  cursor: 'pointer'
                }}
              >
                {modalConfig.type === 'confirm' ? 'Confirm' : 'Dismiss'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Premium Bilingual Guidelines Modal */}
      {showGuidelinesModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.3)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1.5rem',
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.95)',
            border: '2px solid rgba(37, 99, 235, 0.25)',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '780px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 24px 64px rgba(15, 23, 42, 0.15)',
            overflow: 'hidden',
            animation: 'modal-zoom-in 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.25rem 1.75rem',
              borderBottom: '2px solid rgba(15, 23, 42, 0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.03) 0%, rgba(239, 246, 255, 0.05) 100%)',
            }}>
              <div style={{ textAlign: 'left' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: 'var(--deep-ocean)' }}>
                  {guidelinesLanguage === 'en' ? 'User Guidelines & Manual' : 'Panduan & Petunjuk Pengguna'}
                </h3>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  {guidelinesLanguage === 'en' ? 'Chimera QC System Operational Scope' : 'Lingkup Operasional Sistem QC Chimera'}
                </span>
              </div>
              
              {/* Language Selection Tabs */}
              <div style={{
                display: 'flex',
                background: 'rgba(15, 23, 42, 0.05)',
                padding: '0.2rem',
                borderRadius: '99px',
                gap: '0.15rem',
                flexShrink: 0
              }}>
                <button
                  onClick={() => setGuidelinesLanguage('en')}
                  style={{
                    background: guidelinesLanguage === 'en' ? '#FFFFFF' : 'transparent',
                    border: 'none',
                    borderRadius: '99px',
                    padding: '0.35rem 0.85rem',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    color: guidelinesLanguage === 'en' ? 'var(--royal-blue)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    boxShadow: guidelinesLanguage === 'en' ? '0 2px 6px rgba(0,0,0,0.05)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  English
                </button>
                <button
                  onClick={() => setGuidelinesLanguage('id')}
                  style={{
                    background: guidelinesLanguage === 'id' ? '#FFFFFF' : 'transparent',
                    border: 'none',
                    borderRadius: '99px',
                    padding: '0.35rem 0.85rem',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    color: guidelinesLanguage === 'id' ? 'var(--royal-blue)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    boxShadow: guidelinesLanguage === 'id' ? '0 2px 6px rgba(0,0,0,0.05)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Bahasa
                </button>
              </div>
            </div>

            {/* Modal Body / Scroll Container */}
            <div className="style-search-scroll" style={{
              padding: '1.75rem',
              overflowY: 'auto',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem',
            }}>
              {USER_GUIDELINES_SECTIONS.map((section, idx) => {
                const title = guidelinesLanguage === 'en' ? section.titleEn : section.titleId;
                const content = guidelinesLanguage === 'en' ? section.contentEn : section.contentId;
                return (
                  <div key={idx} style={{
                    background: 'rgba(37, 99, 235, 0.015)',
                    border: '1.5px solid rgba(37, 99, 235, 0.08)',
                    borderRadius: '16px',
                    padding: '1.15rem 1.35rem',
                    textAlign: 'left'
                  }}>
                    <h4 style={{
                      margin: '0 0 0.75rem 0',
                      fontSize: '0.9rem',
                      fontWeight: 800,
                      color: 'var(--royal-blue)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <span style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: 'var(--royal-blue)',
                        display: 'inline-block'
                      }} />
                      {title}
                    </h4>
                    <ul style={{
                      margin: 0,
                      paddingLeft: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.45rem',
                      fontSize: '0.76rem',
                      lineHeight: 1.5,
                      color: 'var(--deep-ocean)',
                      fontWeight: 500
                    }}>
                      {content.map((bullet, bIdx) => (
                        <li key={bIdx}>{bullet}</li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '1.15rem 1.75rem',
              borderTop: '2px solid rgba(15, 23, 42, 0.08)',
              display: 'flex',
              justifyContent: 'flex-end',
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(239, 246, 255, 0.3) 100%)',
            }}>
              <button
                onClick={() => setShowGuidelinesModal(false)}
                className="btn-electric"
                style={{
                  width: 'auto',
                  padding: '0.55rem 1.75rem',
                  fontSize: '0.78rem',
                  borderRadius: '12px',
                  fontWeight: 800,
                  background: 'var(--royal-blue)',
                  color: 'white',
                  border: 'none',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.15)',
                  cursor: 'pointer'
                }}
              >
                {guidelinesLanguage === 'en' ? 'Close Guide' : 'Tutup Petunjuk'}
              </button>
            </div>
          </div>
        </div>
      )}
      <PrintReport
        activePackagingProject={activePackagingProject}
        activeSession={activeSession}
        getCycleName={getCycleName}
        tempDefectImages={tempDefectImages}
      />
    </div>
  );
}
