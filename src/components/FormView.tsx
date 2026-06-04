import React, { useState, useEffect } from 'react';
import { DatabaseService } from '../services/database_service';
import { QCInspectionTemplate } from '../models/qc_template';
import { QCInspectionReport } from '../models/qc_report';
import { ScannerService, ScanPhase } from '../services/scanner_service';
import { DEFAULT_TOTAL_QTY, SCRAP_COEFFICIENT, STATUS_DEFECT_MAP } from '../config/yield_constants';
import { invoke } from '@tauri-apps/api/core';
import { SyncEngine } from '../services/sync_engine';

import { ChatMessage } from '../hooks/useChatEngine';

import { FormHeader } from './workspace/FormHeader';
import { WorkspaceControls } from './workspace/WorkspaceControls';
import { BentoInspectionCards } from './workspace/BentoInspectionCards';
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

const getCycleNameFromSessionId = (sessionId: string, sessions: any[]) => {
  const ses = (sessions || []).find((s: any) => s.session_id === sessionId);
  return ses ? getCycleName(ses.cycle_number) : 'Unknown Version';
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
  onClose
}: FormViewProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [template, setTemplate] = useState<QCInspectionTemplate | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // PLM Activity Target States
  const [activeActivities, setActiveActivities] = useState<any[]>([]);
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
  const [packagingProjects, setPackagingProjects] = useState<any[]>([]);
  const [activePackagingProject, setActivePackagingProject] = useState<any | null>(null);
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [sessionEditMode, setSessionEditMode] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isChatExpanded, setIsChatExpanded] = useState<boolean>(false);

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

  const fetchPackagingProjects = async () => {
    setIsFetchingProjects(true);
    try {
      const res = await invokeSafe<any[]>('get_packaging_projects', {}, []);
      setPackagingProjects(res || []);

      // If we have an active project, refresh it
      if (activePackagingProject) {
        const refreshed = res?.find((p: any) => p.project_id === activePackagingProject.project_id);
        if (refreshed) {
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
      await invokeSafe<void>('save_packaging_session', { session: savedSession }, undefined);

      // Save CMT-Pak session report lines if present
      if (activeSession.report_lines && activeSession.report_lines.length > 0) {
        await invokeSafe<void>('save_packaging_project_reports', { reports: activeSession.report_lines }, undefined);
      }

      for (const img of tempDefectImages) {
        await invokeSafe<void>('save_packaging_defect_image', { image: img }, undefined);
      }

      setSessionEditMode(false);
      await fetchPackagingProjects();
    } catch (e) {
      console.error('Failed to save session:', e);
      await showProfessionalAlert('Save Failed', `Failed to save inspection session: ${e}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemovePackagingProject = async (projectId: string) => {
    const confirmed = await showProfessionalConfirm(
      'Remove Project',
      'Are you sure you want to remove this packaging project and all of its inspection sessions? This action cannot be undone.'
    );
    if (!confirmed) return;

    setDeletingProjectId(projectId);
    try {
      await invokeSafe<void>('delete_packaging_project', { projectId }, undefined);

      // Fetch latest projects first
      await fetchPackagingProjects();

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
    if (sessionEditMode || activeSession) {
      await showProfessionalAlert(
        'Session Active',
        'Please save or cancel the active inspection session before completing the project.',
        'alert'
      );
      return;
    }
    const confirmed = await showProfessionalConfirm(
      'Complete Project',
      'Are you sure you want to mark this packaging project as completed? This will lock the workspace and prepare it for sync.'
    );
    if (!confirmed) return;

    setIsProcessing(true);
    setProcessingMessage('Completing packaging project...');
    try {
      const updatedProject = {
        ...activePackagingProject,
        status: 'completed',
        updated_at: new Date().toISOString()
      };
      const { base_report, base_lines, sessions, defect_images, ...projectHeader } = updatedProject;
      await invokeSafe<void>('save_packaging_project', { project: projectHeader }, undefined);

      setActivePackagingProject(updatedProject);
      await fetchPackagingProjects();
      await showProfessionalAlert(
        'Project Completed',
        'Successfully marked project as completed. You can now sync the data to the central database.',
        'success'
      );
    } catch (e) {
      console.error('Failed to complete project:', e);
      await showProfessionalAlert('Completion Failed', `Failed to complete project: ${e}`, 'danger');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSyncProject = async (_projectId: string) => {
    setIsSyncing(true);
    try {
      const syncEngine = SyncEngine.getInstance();
      await syncEngine.synchronize();
      await fetchPackagingProjects();
      await showProfessionalAlert(
        'Sync Successful',
        'Packaging project and all associated QC inspection sessions have been synchronized successfully.',
        'success'
      );
    } catch (e) {
      console.error('Failed to sync project:', e);
      await showProfessionalAlert('Sync Failed', `Failed to sync project: ${e}`, 'danger');
    } finally {
      setIsSyncing(false);
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
        await invokeSafe<void>('save_packaging_session', { session: updatedPrevSession }, undefined);
      }

      // Save new session
      await invokeSafe<void>('save_packaging_session', { session: newSession }, undefined);
      if (clonedLines.length > 0) {
        await invokeSafe<void>('save_packaging_project_reports', { reports: clonedLines }, undefined);
      }

      // Refresh project list and state
      const res = await invokeSafe<any[]>('get_packaging_projects', {}, []);
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

  // Robust, offline-resilient invoke helper that gracefully falls back to localStorage
  const invokeSafe = async <T,>(cmd: string, args: Record<string, any> = {}, fallback: T): Promise<T> => {
    const getStoredProjects = (): any[] => {
      const stored = localStorage.getItem('packaging_offline_projects');
      return stored ? JSON.parse(stored) : [];
    };

    const saveStoredProjects = (projects: any[]) => {
      localStorage.setItem('packaging_offline_projects', JSON.stringify(projects));
    };

    const updateCacheMutation = (synced: boolean) => {
      if (cmd === 'save_packaging_project' && args.project) {
        const projects = getStoredProjects();
        const p = args.project;
        const index = projects.findIndex(item => item.project_id === p.project_id);
        const newProj = {
          ...p,
          synced,
          base_report: p.base_report || null,
          base_lines: p.base_lines || [],
          sessions: p.sessions || [],
          defect_images: p.defect_images || []
        };
        if (index >= 0) {
          projects[index] = { ...projects[index], ...newProj };
        } else {
          projects.push(newProj);
        }
        saveStoredProjects(projects);
      }

      if (cmd === 'save_packaging_base_report' && (args.base_report || args.baseReport)) {
        const projects = getStoredProjects();
        const br = args.base_report || args.baseReport;
        const index = projects.findIndex(item => item.project_id === br.project_id);
        if (index >= 0) {
          projects[index].base_report = { ...br, synced };
          projects[index].synced = synced;
          saveStoredProjects(projects);
        }
      }

      if (cmd === 'save_packaging_session' && args.session) {
        const projects = getStoredProjects();
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
          saveStoredProjects(projects);
        }
      }

      if (cmd === 'save_packaging_defect_image' && args.image) {
        const projects = getStoredProjects();
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
          saveStoredProjects(projects);
        }
      }

      if (cmd === 'save_packaging_project_reports' && args.reports) {
        const projects = getStoredProjects();
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
            saveStoredProjects(projects);
          }
        }
      }

      if (cmd === 'delete_packaging_project') {
        const projects = getStoredProjects();
        const pid = args.project_id || args.projectId;
        const targetProj = projects.find(item => item.project_id === pid);
        const filtered = projects.filter(item => item.project_id !== pid);
        saveStoredProjects(filtered);

        // If the deleted project was already synced to the server and we are offline, track it for future sync
        if (!synced && targetProj && targetProj.synced !== false) {
          const storedRemovals = localStorage.getItem('packaging_offline_removals');
          const removals = storedRemovals ? JSON.parse(storedRemovals) : [];
          if (!removals.includes(pid)) {
            removals.push(pid);
            localStorage.setItem('packaging_offline_removals', JSON.stringify(removals));
          }
        }
      }
    };

    try {
      const res = await invoke<T>(cmd, args);
      // Cache successful queries
      if (cmd === 'get_packaging_projects') {
        localStorage.setItem('packaging_offline_projects', JSON.stringify(res));
      } else if (cmd === 'get_packaging_project_reports' && (args.session_id === 'INITIAL_PAK' || args.sessionId === 'INITIAL_PAK')) {
        const pid = args.project_id || args.projectId;
        localStorage.setItem(`packaging_initial_reports_${pid}`, JSON.stringify(res));
      } else {
        updateCacheMutation(true);
      }
      return res;
    } catch (e: any) {
      const errStr = String(e || '');
      const isConnectionError = errStr.includes('Failed to connect') || errStr.includes('timeout') || errStr.includes('connection');
      if (!isConnectionError && cmd !== 'get_packaging_projects' && cmd !== 'get_packaging_project_reports') {
        console.error(`Tauri invoke '${cmd}' database execution error:`, e);
        throw e;
      }

      console.warn(`Tauri invoke '${cmd}' failed or offline. Using local safety store fallback:`, e);

      if (cmd === 'get_packaging_projects') {
        return getStoredProjects() as unknown as T;
      }

      if (cmd === 'get_packaging_project_reports' && (args.session_id === 'INITIAL_PAK' || args.sessionId === 'INITIAL_PAK')) {
        const pid = args.project_id || args.projectId;
        const stored = localStorage.getItem(`packaging_initial_reports_${pid}`);
        return (stored ? JSON.parse(stored) : fallback) as unknown as T;
      }

      updateCacheMutation(false);
      return fallback;
    }
  };

  // Load active PLM activities from backend (VSM Central source of truth)
  useEffect(() => {
    const fetchPlmActivities = async () => {
      try {
        const list = await invokeSafe<any[]>('pg_get_active_plm_activities', {}, []);
        setActiveActivities(list || []);
      } catch (e) {
        console.error('Failed to fetch active PLM activities:', e);
      }
    };
    fetchPlmActivities();
  }, []);

  useEffect(() => {
    if (templateId === 'pack_v0') {
      fetchPackagingProjects();
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
  const handleDownloadProject = async () => {
    if (!selectedActivity) return;

    // Prevent double active project (duplicate downloads of the same PLM/style ID)
    const existing = packagingProjects.find(
      (p: any) => p.plm_id === selectedActivity.plm_id
    );
    if (existing) {
      await showProfessionalAlert(
        'Style Already Active',
        `A project for style '${selectedActivity.article_name}' (${selectedActivity.plm_id}) has already been downloaded and is active. Prohibiting duplicate downloads.`,
        'danger'
      );
      setSelectedActivity(null);
      return;
    }

    setIsProcessing(true);
    setProcessingMessage(`Downloading workspace for ${selectedActivity.article_name}...`);
    setIsDownloading(true);
    try {
      if (templateId === 'pack_v0') {
        const projectId = `PRJ-${selectedActivity.plm_id.replace(/\//g, '-')}-${Date.now()}`;

        const projectObj = {
          project_id: projectId,
          plm_id: selectedActivity.plm_id,
          brand: selectedActivity.brand,
          season: selectedActivity.season,
          article_name: selectedActivity.article_name,
          production_group: selectedActivity.production_group || 'N/A',
          po_info: selectedActivity.po_info || null,
          po_qty: selectedActivity.po_qty || null,
          po_plan_date: selectedActivity.po_plan_date || null,
          po_vendor: selectedActivity.po_vendor || null,
          status: 'downloaded',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        let onlineSucceeded = false;
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          await invoke('save_packaging_project', { project: projectObj });
          onlineSucceeded = true;
        } catch (e: any) {
          console.warn('save_packaging_project online invoke failed, calling offline fallback:', e);
          await invokeSafe<void>('save_packaging_project', { project: projectObj }, undefined);
        }

        if (!onlineSucceeded) {
          // We are offline! Construct default Session 0 and Session 1 in localStorage
          const totalQty = selectedActivity.po_qty ? Math.round(selectedActivity.po_qty) : 0;

          const cycle0Session = {
            session_id: `BASE-${projectId}`,
            project_id: projectId,
            cycle_number: 0,
            inspector_id: 'system',
            status: 'completed',
            started_at: new Date().toISOString(),
            ended_at: new Date().toISOString(),
            inspection_date: new Date().toISOString().split('T')[0],
            check_wash: true,
            check_style_as_sample: true,
            check_main_label: true,
            check_flag_fit_label: true,
            check_print_embro_artwork: true,
            check_hangtag: true,
            check_waist_tag: true,
            check_barcode: true,
            check_packing_list: true,
            check_shipping_mark: true,
            qty_available: totalQty,
            total_store: totalQty,
            store_inspected: totalQty,
            cutting_pcs: totalQty,
            sewing_pcs: totalQty,
            finishing_pcs: totalQty,
            packing_pcs: totalQty,
            sampling_pcs: 0,
            aql: 2.5,
            level_val: 1.0,
            factory_representative: 'System Baseline',
            inspector: 'System (CMT-Cut)',
            version: 'Baseline',
            result: 'Passed'
          };

          const cycle1Session = {
            session_id: `SES-${projectId}-1`,
            project_id: projectId,
            cycle_number: 1,
            inspector_id: 'inspector-1',
            status: 'pending',
            started_at: new Date().toISOString(),
            ended_at: null,
            inspection_date: new Date().toISOString().split('T')[0],
            check_wash: false,
            check_style_as_sample: false,
            check_main_label: false,
            check_flag_fit_label: false,
            check_print_embro_artwork: false,
            check_hangtag: false,
            check_waist_tag: false,
            check_barcode: false,
            check_packing_list: false,
            check_shipping_mark: false,
            qty_available: totalQty,
            total_store: 0,
            store_inspected: 0,
            cutting_pcs: totalQty,
            sewing_pcs: totalQty,
            finishing_pcs: totalQty,
            packing_pcs: totalQty,
            sampling_pcs: 0,
            aql: 2.5,
            level_val: 1.0,
            factory_representative: '',
            inspector: '',
            version: 'v1.0',
            result: 'Pending'
          };

          await invokeSafe<void>('save_packaging_session', { session: cycle0Session }, undefined);
          await invokeSafe<void>('save_packaging_session', { session: cycle1Session }, undefined);

          // Copy INITIAL_PAK lines into Session 1 reports if available offline
          let templateLines: any[] = [];
          try {
            const res = await invokeSafe<any[]>('get_packaging_project_reports', {
              projectId: projectId,
              sessionId: 'INITIAL_PAK'
            }, []);
            const newSessionId = `SES-${projectId}-1`;
            templateLines = (res || []).map((line: any, idx: number) => ({
              ...line,
              report_id: `${newSessionId}_LINE_${idx}`,
              session_id: newSessionId,
              session_qty: 0.0,
              session_version: 'v1.0'
            }));
          } catch (e) {
            console.error('Failed to copy INITIAL_PAK lines offline:', e);
          }
          if (templateLines.length > 0) {
            await invokeSafe<void>('save_packaging_project_reports', { reports: templateLines }, undefined);
          }
        }

        await fetchPackagingProjects();
        setSelectedActivity(null);

        // Show professional success alert
        await showProfessionalAlert(
          'Project Configured',
          `Successfully created and configured local workspace for ${selectedActivity.article_name}.`,
          'success'
        );
      }
    } catch (e) {
      console.error('Failed to download project offline:', e);
    } finally {
      setIsProcessing(false);
      setIsDownloading(false);
    }
  };

  const handleRefetchReportLines = async () => {
    if (!activePackagingProject) return;
    setIsProcessing(true);
    setProcessingMessage('Re-fetching CMT-Pak size data from D365...');
    const snapshotProjectId = activePackagingProject.project_id;
    const snapshotSessionId = activeSession?.session_id;
    try {
      // Re-call save_packaging_project which will re-trigger OData fetch and duplicate INITIAL_PAK lines to sessions
      const { base_report, base_lines, sessions, defect_images, ...projectHeader } = activePackagingProject;
      await invokeSafe<void>('save_packaging_project', { project: projectHeader }, undefined);
      // Refresh all projects and re-select the active project & session
      const res = await invokeSafe<any[]>('get_packaging_projects', {}, []);
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
      await showProfessionalAlert('Data Refreshed', 'Size report data has been re-fetched from D365 and is now available.', 'success');
    } catch (e) {
      console.error('Failed to re-fetch report lines:', e);
      await showProfessionalAlert('Fetch Failed', `Failed to re-fetch size data: ${e}. Ensure you are connected to the network.`, 'danger');
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
            handleRemovePackagingProject={handleRemovePackagingProject}
            setActiveSession={setActiveSession}
            setSelectedSizeTab={setSelectedSizeTab}
            setSessionEditMode={setSessionEditMode}
            headerButtonStyle={headerButtonStyle}
            versionSelectorButtonStyle={versionSelectorButtonStyle}
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
                {/* COLUMN 2: Workspace details form/review (70% width) */}
                <div style={{ flex: '70 1 0%', display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', gap: '1rem', paddingRight: '0.75rem', paddingTop: '6px', borderRight: '1px solid rgba(37, 99, 235, 0.08)' }}>
                  
                  {/* Document Title Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1.5px solid rgba(37, 99, 235, 0.08)', paddingBottom: '0.55rem', marginBottom: '0.25rem', textAlign: 'left', flexShrink: 0 }}>
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--deep-ocean)', margin: 0, fontFamily: 'var(--font-brand)', display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                      Final Inspection Report
                      <span 
                        className={`electric-badge hud-header-badge ${sessionEditMode ? 'gold' : (activeSession.result?.toLowerCase() === 'passed' ? 'emerald' : activeSession.result?.toLowerCase() === 'failed' ? 'red' : 'silver')}`} 
                        style={{
                           fontSize: '0.62rem',
                           height: '18px',
                           padding: '0 0.55rem',
                           display: 'inline-flex',
                           alignItems: 'center',
                           justifyContent: 'center',
                           lineHeight: 'normal',
                           textTransform: 'uppercase',
                           fontWeight: 800,
                           borderRadius: '6px'
                        }}
                      >
                        {sessionEditMode ? 'Draft' : (activeSession.result || 'Pending')}
                      </span>
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      {sessionEditMode ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setSessionEditMode(false);
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
                              border: '1.5px solid rgba(37, 99, 235, 0.18)',
                              color: 'var(--royal-blue)',
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
                </div>

                {/* COLUMN 3: Right Pane for Defect Images & Photo Attachments (30% width) */}
                <RightDefectPane
                  activeSession={activeSession}
                  sessionEditMode={sessionEditMode}
                  activePackagingProject={activePackagingProject}
                  getCycleNameFromSessionId={getCycleNameFromSessionId}
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
                />
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.78rem', border: '2px dashed rgba(37, 99, 235, 0.12)', borderRadius: '20px', padding: '2rem' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(37, 99, 235, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--royal-blue)', marginBottom: '0.85rem' }}>⚙</div>
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
              borderTop: '1.5px solid rgba(37, 99, 235, 0.12)',
              paddingTop: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              width: '100%'
            }}>
              {/* Collapsible Chat History */}
              {isChatExpanded && (
                <div
                  className="copilot-side-card"
                  style={{
                    width: '100%',
                    height: '140px',
                    minHeight: '140px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    background: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(20px)',
                    border: '2px solid rgba(37, 99, 235, 0.28)',
                    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
                    borderRadius: '16px',
                    padding: '0.85rem',
                    animation: 'slide-up 0.2s ease-in-out'
                  }}
                >
                  <div className="flex-between kaizen-center-header" style={{ marginBottom: '0.45rem', borderBottom: '1px solid rgba(37, 99, 235, 0.08)', paddingBottom: '0.35rem', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span className="hud-logo-hexagon kaizen-logo-mini" style={{ width: '12px', height: '12px' }}></span>
                      <span className="kaizen-title-label" style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Kaizen AI Assistant
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="electric-badge teal" style={{ fontSize: '0.52rem', padding: '0.05rem 0.35rem' }}>Online</span>
                      <button
                        onClick={() => setIsChatExpanded(false)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          fontSize: '1rem',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          padding: '0 0.15rem',
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
                  <div className="hud-local-chat-scroll kaizen-chat-scroll" style={{ flex: 1, overflowY: 'auto', paddingRight: '0.1rem' }}>
                    {chatHistory.map((msg, idx) => (
                      <div key={idx} className={`chat-message-envelope ${msg.sender}`} style={{ marginBottom: '0.65rem' }}>
                        {msg.sender === 'agent' && (
                          <div className="envelope-avatar agent-avatar" title="Kaizen Assistant" style={{ width: '22px', height: '22px', marginTop: '2px' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </div>
                        )}
                        <div className={`chat-envelope-content ${msg.sender}`} style={{ maxWidth: '85%' }}>
                          <div className={`chat-bubble-modern ${msg.sender}`} style={{ padding: '0.4rem 0.65rem', borderRadius: '10px', borderTopLeftRadius: msg.sender === 'agent' ? '3px' : '10px', borderTopRightRadius: msg.sender === 'user' ? '3px' : '10px', boxShadow: 'none' }}>
                            <p className="chat-bubble-text" style={{ fontSize: '0.74rem', margin: 0, lineHeight: 1.35 }}>{msg.text}</p>
                          </div>
                        </div>
                        {msg.sender === 'user' && (
                          <div className="envelope-avatar user-avatar" title="System Operator" style={{ width: '22px', height: '22px', marginTop: '2px' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
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

              {/* Chat Input Capsule Bar - Integrated Full Width */}
              <div
                className="premium-chat-bar"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0.35rem 0.5rem 0.35rem 0.65rem',
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(20px)',
                  border: '2px solid rgba(37, 99, 235, 0.28)',
                  borderRadius: '14px',
                  boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)'
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsChatExpanded(!isChatExpanded)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--royal-blue)',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    marginRight: '0.45rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                  title={isChatExpanded ? "Collapse History" : "Expand History"}
                >
                  💬 {isChatExpanded ? "Hide History" : "Show History"}
                </button>

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
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                  disabled={isListening}
                  style={{ fontSize: '0.78rem', flex: 1, border: 'none', outline: 'none', background: 'transparent' }}
                />

                <div className="chatbar-controls" style={{ gap: '0.3rem', display: 'flex', alignItems: 'center' }}>
                  <button
                    type="button"
                    className={`premium-mic-btn ${isListening ? 'listening-active' : ''}`}
                    onClick={toggleListening}
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
                    onClick={() => handleSendChat()}
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
        packagingProjects={packagingProjects}
        selectedActivity={selectedActivity}
        setSelectedActivity={setSelectedActivity}
        isDownloading={isDownloading}
        deletingProjectId={deletingProjectId}
        isSyncing={isSyncing}
        handleDownloadProject={handleDownloadProject}
        handleSyncProject={handleSyncProject}
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
                    background: 'rgba(255, 255, 255, 0.98)',
                    backdropFilter: 'blur(20px)',
                    border: '2px solid rgba(37, 99, 235, 0.22) !important',
                    borderRadius: '16px',
                    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.08)',
                    padding: '0.5rem 0.75rem 0.5rem 0.5rem !important',
                    zIndex: 100
                  }}>
                    {activeActivities.filter(act =>
                      act.po_info && act.po_info.trim() !== '' && (
                        act.plm_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        act.article_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        act.brand.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                    ).length > 0 ? (
                      activeActivities.filter(act =>
                        act.po_info && act.po_info.trim() !== '' && (
                          act.plm_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          act.article_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          act.brand.toLowerCase().includes(searchQuery.toLowerCase())
                        )
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
      position: 'absolute',
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
            className="copilot-side-card"
            style={{
              pointerEvents: 'auto',
              width: '500px',
              height: '380px',
              maxHeight: '50vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(20px)',
              border: '2px solid rgba(37, 99, 235, 0.28)',
              boxShadow: '0 12px 40px rgba(15, 23, 42, 0.15)',
              borderRadius: '24px',
              padding: '1.25rem',
              animation: 'slide-up 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              marginBottom: '0.2rem'
            }}
          >
            <div className="flex-between kaizen-center-header" style={{ marginBottom: '1rem', borderBottom: '1.5px solid rgba(37, 99, 235, 0.12)', paddingBottom: '0.75rem', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="hud-logo-hexagon kaizen-logo-mini" style={{ width: '14px', height: '14px' }}></span>
                <span className="kaizen-title-label" style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Kaizen AI Builder
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="electric-badge teal" style={{ fontSize: '0.58rem', padding: '0.1rem 0.4rem' }}>Online</span>
                <button
                  onClick={() => setIsChatExpanded(false)}
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

        {/* Input Capsule Bar (Always Visible) */}
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
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '2px solid rgba(37, 99, 235, 0.28)',
            borderRadius: '99px',
            boxShadow: '0 8px 32px rgba(15, 23, 42, 0.08)'
          }}
        >
          {/* Sparkle toggle button badge on the left */}
          <button
            type="button"
            onClick={() => setIsChatExpanded(!isChatExpanded)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: isChatExpanded ? 'rgba(37, 99, 235, 0.15)' : 'rgba(37, 99, 235, 0.06)',
              border: '1.5px solid rgba(37, 99, 235, 0.28)',
              color: 'var(--royal-blue)',
              cursor: 'pointer',
              marginRight: '0.45rem',
              transition: 'all 0.15s ease',
              outline: 'none',
              flexShrink: 0
            }}
            title={isChatExpanded ? "Hide Chat History" : "Show Chat History"}
            className="hover-scale"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
            </svg>
          </button>

          {/* Chat input field */}
          <input
            type="text"
            className="premium-chat-input"
            placeholder={isListening ? "Listening..." : "Ask Kaizen to build..."}
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                handleSendChat();
                setIsChatExpanded(true);
              }
            }}
            onFocus={() => {
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
              onClick={toggleListening}
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

      {/* Processing Loader Overlay */}
      {isProcessing && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(240, 251, 255, 0.65)',
          backdropFilter: 'blur(5px)',
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
          background: 'rgba(15, 23, 42, 0.45)', // dark navy glass overlay
          backdropFilter: 'blur(12px)',
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
    </div>
  );
}
