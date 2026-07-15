import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { DatabaseService } from '../services/database_service';
import { QCInspectionTemplate } from '../models/qc_template';
import { SyncEngine } from '../services/sync_engine';
import { PackagingService } from '../services/packaging_service';
import { USER_GUIDELINES_SECTIONS } from '../services/user_guidelines';
import { AIAgentService, getFuzzyMatchScore } from '../services/ai_agent_service';
import { calculateDeductions } from '../utils/calculations';
import { getInspectorProfile, saveInspectorProfile } from '../utils/inspector_profile';

import { ChatMessage } from '../hooks/useChatEngine';

import { FormHeader } from './workspace/FormHeader';
import { WorkspaceControls } from './workspace/WorkspaceControls';
import { BentoInspectionCards } from './workspace/BentoInspectionCards';
import { PrintReport } from './workspace/PrintReport';
import { RightDefectPane } from './workspace/RightDefectPane';
import { ProjectSelectionDirectory } from './workspace/ProjectSelectionDirectory';

interface FormViewProps {
  templateId: string;
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



export default function FormView({
  templateId,
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
  const [template, setTemplate] = useState<QCInspectionTemplate | null>(null);

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



  const [isOnline, setIsOnline] = useState(navigator.onLine);
  React.useEffect(() => {
    const up = () => setIsOnline(true);
    const down = () => setIsOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);




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
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('packaging_projects_summary_cache');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {}
      }
    }
    return [];
  });

  const updatePackagingProjects = (projects: any[]) => {
    setPackagingProjects(projects);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('packaging_projects_summary_cache', JSON.stringify(projects));
      } catch (e) {
        console.error('Failed to save summary cache to localStorage:', e);
      }
    }
  };
  const [activePackagingProject, setActivePackagingProject] = useState<any | null>(null);
  const activePackagingProjectRef = React.useRef<any>(null);
  const activeSessionRef = React.useRef<any>(null);
  const [deviceProjectIds, setDeviceProjectIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('packaging_device_downloaded_projects');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {}
      }
    }
    return [];
  });
  const [activeSession, setActiveSession] = useState<any | null>(null);
  // Keep refs in sync so async callbacks always read current values without stale closure issues
  React.useEffect(() => { activePackagingProjectRef.current = activePackagingProject; }, [activePackagingProject]);
  React.useEffect(() => { activeSessionRef.current = activeSession; }, [activeSession]);
  const [sessionEditMode, setSessionEditMode] = useState<boolean>(false);
  const isSessionVerified = !!(
    activeSession?.approval_status === 'approved' ||
    activeSession?.approval_signature?.toLowerCase().includes('digitally signed')
  );
  // Lock ALL versions when any session has a pending or completed verification.
  // Prevents editing older versions while a newer one is awaiting approval.
  // Rejection of approval does not lock editing.
  const isEditLocked = isSessionVerified || !!(
    (activePackagingProject?.sessions || []).some((s: any) => {
      const isRejected = s.approval_status === 'rejected' ||
                         (s.ho_approval_signature && s.ho_approval_signature.includes('Rejected:'));
      if (isRejected) {
        return false;
      }
      return (
        s.approval_token ||
        s.approval_status === 'approved' ||
        s.approval_signature?.toLowerCase().includes('digitally signed')
      );
    })
  );
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

  async function handleSelectPackagingProject(project: any) {
    if (!project) return;

    // Helper to select the latest active session from project details
    const selectSession = (details: any) => {
      const sessions = details.sessions || [];
      const validSessions = sessions
        .filter((s: any) => s.cycle_number >= 1)
        .sort((a: any, b: any) => b.cycle_number - a.cycle_number);
      return validSessions[0] || null;
    };

    // Helper to record project ID locally in downloaded list
    const registerDeviceProject = (projectId: string) => {
      const stored = localStorage.getItem('packaging_device_downloaded_projects');
      let deviceProjects: string[] = stored ? JSON.parse(stored) : [];
      if (!deviceProjects.includes(projectId)) {
        const nextDeviceProjects = [...deviceProjects, projectId];
        localStorage.setItem('packaging_device_downloaded_projects', JSON.stringify(nextDeviceProjects));
        setDeviceProjectIds(nextDeviceProjects);
      }
    };

    // 1. Try to load project details instantly from the offline local database cache
    const cachedProjects = PackagingService.getInstance().getStoredProjects();
    const cachedDetails = cachedProjects.find((p: any) => p.project_id === project.project_id);

    // If cached details with sessions or base lines are present, open the workspace immediately without locking UI with spinner
    if (cachedDetails && (cachedDetails.sessions !== undefined || cachedDetails.base_lines !== undefined)) {
      setActivePackagingProject(cachedDetails);
      setActiveSession(selectSession(cachedDetails));
      setSessionEditMode(false);

      if (project.project_id) {
        registerDeviceProject(project.project_id);
      }

      // Perform background fetch from the remote database to ensure style changes are synced silently
      PackagingService.getInstance()
        .invokeSafe<any>('get_packaging_project_details', { projectId: project.project_id }, cachedDetails)
        .then((details) => {
          if (details) {
            // Silently update active states, but only if the operator is still on the same project
            setActivePackagingProject((current: any) => {
              if (current && current.project_id === details.project_id) {
                return details;
              }
              return current;
            });
            setActiveSession((currentSession: any) => {
              if (currentSession && details.sessions) {
                const updatedSes = details.sessions.find((s: any) => s.session_id === currentSession.session_id);
                return updatedSes || currentSession;
              } else if (!currentSession) {
                return selectSession(details);
              }
              return currentSession;
            });
          }
        })
        .catch((err) => {
          console.warn('Silent background fetch of project details failed:', err);
        });

    } else {
      // 2. Cache miss: Show the blocking loader and perform a standard fetch
      setIsProcessing(true);
      setProcessingMessage(`Opening workspace for ${project.article_name}...`);
      try {
        const details = await PackagingService.getInstance().invokeSafe<any>(
          'get_packaging_project_details',
          { projectId: project.project_id },
          project
        );
        setActivePackagingProject(details);
        setActiveSession(selectSession(details));
        setSessionEditMode(false);

        if (project.project_id) {
          registerDeviceProject(project.project_id);
        }
      } catch (e) {
        console.error('Failed to load project details from offline database fallback:', e);
        await showProfessionalAlert('Open Failed', `Failed to open workspace: ${e}`, 'danger');
      } finally {
        setIsProcessing(false);
      }
    }
  }

  const fetchPackagingProjects = async (silent = false) => {
    // 1. Prioritize offline cache immediately to prevent lagging/freezing and support instant open
    const cached = await PackagingService.getInstance().loadCacheFromDisk();
    if (cached && cached.length > 0) {
      updatePackagingProjects(cached);
    }

    if (!silent && (!cached || cached.length === 0)) {
      setIsFetchingProjects(true);
    }
    try {
      const res = await PackagingService.getInstance().invokeSafe<any[]>('get_packaging_projects_summary', {}, []);
      updatePackagingProjects(res || []);
  
      // Refresh the active project — use refs to read current values without stale closure issues
      const currentProject = activePackagingProjectRef.current;
      if (currentProject) {
        const refreshed = res?.find((p: any) => p.project_id === currentProject.project_id);
        if (refreshed) {
          const details = await PackagingService.getInstance().invokeSafe<any>('get_packaging_project_details', { projectId: currentProject.project_id }, null);
          if (details) {
            // Functional updaters with guard prevent stomping a concurrent project switch
            setActivePackagingProject((cur: any) => cur && cur.project_id === details.project_id ? details : cur);
            setActiveSession((curSes: any) => {
              if (!curSes || !details.sessions) return curSes;
              const updatedSes = details.sessions.find((s: any) => s.session_id === curSes.session_id);
              return updatedSes || curSes;
            });
          }
        }
      }
    } catch (e) {
      console.error('Failed to load packaging projects:', e);
    } finally {
      setIsFetchingProjects(false);
    }
  };

  React.useEffect(() => {
    const unlistenFns: Array<() => void> = [];
    const setupListeners = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');

        const unlistenApproval = await listen('approval-updated', async () => {
          await fetchPackagingProjects(true);
        });
        unlistenFns.push(unlistenApproval);

        // Real-time DB change notification — replaces 8s polling when the DB connection is live
        const unlistenProject = await listen('packaging-project-updated', async (event: any) => {
          try {
            const payload = JSON.parse(event.payload as string);
            const currentProject = activePackagingProjectRef.current;
            if (currentProject && payload.project_id === currentProject.project_id) {
              await handleRefreshActiveProject();
            }
          } catch { /* malformed payload — ignore */ }
        });
        unlistenFns.push(unlistenProject);
      } catch (err) {
        console.error('Failed to setup event listeners:', err);
      }
    };
    setupListeners();
    return () => { unlistenFns.forEach(fn => fn()); };
  }, []);

  React.useEffect(() => {
    if (!activePackagingProject || !activeSession) return;
    
    const signature = activeSession.approval_signature || '';
    const isApproved = activeSession.approval_status === 'approved' || (
      signature && signature.toLowerCase().includes('digitally signed')
    );
    if (isApproved) return; // already approved, no need to poll
    
    const interval = setInterval(async () => {
      if (!navigator.onLine) return;
      try {
        const details = await PackagingService.getInstance().invokeSafe<any>(
          'get_packaging_project_details',
          { projectId: activePackagingProject.project_id },
          null
        );
        if (details && details.sessions) {
          const currentSessionInDb = details.sessions.find(
            (s: any) => s.session_id === activeSession.session_id
          );
          if (currentSessionInDb && (
            currentSessionInDb.approval_signature?.includes('Digitally Signed') ||
            currentSessionInDb.approval_status === 'approved' ||
            currentSessionInDb.approval_status === 'rejected'
          )) {
            setActivePackagingProject((cur: any) => cur && cur.project_id === details.project_id ? details : cur);
            setActiveSession((curSes: any) => curSes && curSes.session_id === currentSessionInDb.session_id ? currentSessionInDb : curSes);
            clearInterval(interval);
          }
        }
      } catch (err) {
        console.warn('Polling for signature failed:', err);
      }
    }, 8000);
    
    return () => clearInterval(interval);
  }, [activePackagingProject?.project_id, activeSession?.session_id, activeSession?.approval_signature]);

  // Stage 2 poller: runs only after Stage 1 is approved, watches for HO signature
  React.useEffect(() => {
    if (!activePackagingProject || !activeSession) return;
    const isStage1Done = activeSession.approval_status === 'approved' ||
      activeSession.approval_signature?.toLowerCase().includes('digitally signed');
    const isStage2Done = !!(activeSession.ho_approval_signature?.includes('Digitally Signed:'));
    if (!isStage1Done || isStage2Done) return;

    const interval = setInterval(async () => {
      if (!navigator.onLine) return;
      try {
        const details = await PackagingService.getInstance().invokeSafe<any>(
          'get_packaging_project_details',
          { projectId: activePackagingProject.project_id },
          null
        );
        if (details && details.sessions) {
          const currentSessionInDb = details.sessions.find(
            (s: any) => s.session_id === activeSession.session_id
          );
          if (currentSessionInDb?.ho_approval_signature) {
            setActivePackagingProject((cur: any) => cur && cur.project_id === details.project_id ? details : cur);
            setActiveSession((curSes: any) => curSes && curSes.session_id === currentSessionInDb.session_id ? currentSessionInDb : curSes);
            clearInterval(interval);
          }
        }
      } catch (err) {
        console.warn('Stage 2 polling failed:', err);
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [activePackagingProject?.project_id, activeSession?.session_id, activeSession?.approval_status, activeSession?.ho_approval_signature]);

  const handleRefreshActiveProject = async () => {
    const current = activePackagingProjectRef.current;
    if (!current) return;
    try {
      const details = await PackagingService.getInstance().invokeSafe<any>(
        'get_packaging_project_details',
        { projectId: current.project_id },
        current
      );
      if (details) {
        setActivePackagingProject((cur: any) => cur && cur.project_id === details.project_id ? details : cur);
        setActiveSession((curSes: any) => {
          if (!curSes || !details.sessions) return curSes;
          const refreshed = details.sessions.find((s: any) => s.session_id === curSes.session_id);
          return refreshed || curSes;
        });
        const cached = PackagingService.getInstance().getStoredProjects();
        const updated = cached.map((p: any) => p.project_id === details.project_id ? { ...p, ...details } : p);
        await PackagingService.getInstance().saveStoredProjects(updated);
      }
    } catch (e) {
      console.warn('Failed to refresh active project:', e);
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
      let newRowVersion: number;
      try {
        newRowVersion = await invoke<number>('save_packaging_session', { session: PackagingService.getInstance().sanitizeSession(savedSession) });
        setActiveSession((prev: any) => prev ? { ...prev, row_version: newRowVersion } : prev);
        
        // Overwrite the local inspector profile name if it has been edited in the session
        if (savedSession.inspector) {
          const profile = getInspectorProfile();
          if (profile && profile.name !== savedSession.inspector) {
            saveInspectorProfile({ ...profile, name: savedSession.inspector });
          }
        }
      } catch (saveErr: any) {
        if (String(saveErr).includes('CONFLICT')) {
          await showProfessionalAlert(
            'Session Conflict',
            'Another user saved this session while you were editing. Reload to see their changes before saving yours.',
            'danger'
          );
          await handleRefreshActiveProject();
          return;
        }
        throw saveErr;
      }

      // Save CMT-Pak session report lines if present
      if (activeSession.report_lines && activeSession.report_lines.length > 0) {
        await PackagingService.getInstance().invokeSafe<void>('save_packaging_project_reports', { reports: activeSession.report_lines }, undefined);
      }

      for (const img of tempDefectImages) {
        await PackagingService.getInstance().invokeSafe<void>('save_packaging_defect_image', { image: img }, undefined);
      }

      // Update deductions on the project header using the lightweight command (no D365 calls)
      const deductions = calculateDeductions(activePackagingProject, savedSession);
      await PackagingService.getInstance().invokeSafe<void>('update_packaging_project_deductions', {
        projectId: activePackagingProject.project_id,
        hasDeduction: deductions.hasDeduction,
        deductionAmount: deductions.deductionAmount
      }, undefined);

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

  const handleRemoveDefectImage = async (imageId: string) => {
    if (!activePackagingProject) return;
    setActivePackagingProject((prev: any) => {
      if (!prev) return null;
      return { ...prev, defect_images: (prev.defect_images || []).filter((i: any) => i.image_id !== imageId) };
    });
    PackagingService.getInstance().invokeSafe<void>('delete_packaging_defect_image', { imageId }, undefined)
      .catch((err) => console.error('Failed to delete defect image from database:', err));
  };

  const removeProjectById = async (projectId: string) => {
    await PackagingService.getInstance().invokeSafe<void>(
      'delete_packaging_project',
      { projectId },
      undefined
    );

    const cached = PackagingService.getInstance().getStoredProjects();
    const updatedCache = cached.filter((p: any) => p.project_id !== projectId);
    await PackagingService.getInstance().saveStoredProjects(updatedCache);
    updatePackagingProjects(updatedCache);

    const stored = localStorage.getItem('packaging_device_downloaded_projects');
    if (stored) {
      let deviceProjects: string[] = JSON.parse(stored);
      deviceProjects = deviceProjects.filter(id => id !== projectId);
      localStorage.setItem('packaging_device_downloaded_projects', JSON.stringify(deviceProjects));
      setDeviceProjectIds(deviceProjects);
    }

    if (activePackagingProject?.project_id === projectId) {
      setActivePackagingProject(null);
      setSessionEditMode(false);
      setActiveSession(null);
    }
  };

  const handleRemovePackagingProject = async (projectId: string) => {
    const confirmed = await showProfessionalConfirm(
      'Remove Project',
      'Are you sure you want to remove this project? This will archive the style and hide it from all directories.'
    );
    if (!confirmed) return;

    setDeletingProjectId(projectId);
    try {
      await removeProjectById(projectId);
      await fetchPackagingProjects(true);
    } catch (e) {
      console.error('Failed to remove packaging project:', e);
      await showProfessionalAlert('Removal Failed', `Failed to remove packaging project: ${e}`, 'danger');
    } finally {
      setDeletingProjectId(null);
    }
  };

  // Auto-remove stale projects: completed+synced dormant >3 days, draft dormant >30 days
  React.useEffect(() => {
    if (packagingProjects.length === 0) return;
    const THREE_DAYS = 3 * 86_400_000;
    const THIRTY_DAYS = 30 * 86_400_000;
    const now = Date.now();
    const stale = packagingProjects.filter((p: any) => {
      if (!p.updated_at) return false;
      const age = now - new Date(p.updated_at).getTime();
      return p.status === 'completed' ? age > THREE_DAYS : age > THIRTY_DAYS;
    });
    if (stale.length === 0) return;
    (async () => {
      for (const p of stale) {
        try { await removeProjectById(p.project_id); } catch { /* non-fatal */ }
      }
      await fetchPackagingProjects(true);
    })();
  }, [packagingProjects.length]);

  // handleCompleteProject / handleRevertProject removed: completion is now driven
  // by the portal's Director approval (stage 3) — the console no longer completes,
  // syncs RPA, or reverts projects manually.

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

  const handlePartialSyncProject = async () => {
    if (!activePackagingProject) return;
    if (sessionEditMode) {
      await showProfessionalAlert(
        'Session Active',
        'Please save or cancel the active inspection session before performing a partial sync.',
        'alert'
      );
      return;
    }

    if (!navigator.onLine) {
      await showProfessionalAlert(
        'Offline Required',
        'You must be online to perform a partial sync. Please check your internet connection.',
        'danger'
      );
      return;
    }

    const confirmed = await showProfessionalConfirm(
      'Sync Partial RAF',
      'Are you sure you want to sync the current inspection progress? This will send the current manufacturing RAF status to Dynamics 365, but will keep the workspace editable.'
    );
    if (!confirmed) return;

    setIsProcessing(true);
    setProcessingMessage('Syncing partial process...');
    try {
      // 1. Save local changes first (Draft status, keeps editable)
      const projectHeader = {
        ...activePackagingProject,
        updated_at: new Date().toISOString()
      };
      const { base_report, base_lines, sessions, defect_images, ...projectHeaderOnly } = projectHeader;
      await PackagingService.getInstance().invokeSafe<void>('save_packaging_project', { project: projectHeaderOnly }, undefined);

      // 2. Trigger partial process sync (creates job_trans_raf RPA)
      await PackagingService.getInstance().invokeSafe<string>('trigger_partial_process_sync', { projectId: activePackagingProject.project_id }, '');

      // 3. Synchronize via SyncEngine
      const syncEngine = SyncEngine.getInstance();
      await syncEngine.synchronize();

      await fetchPackagingProjects(true);
      await showProfessionalAlert(
        'Partial Sync Dispatched',
        'Inspection progress has been synced to Dynamics 365. The workspace remains active.',
        'success'
      );
    } catch (e) {
      console.error('Failed to sync partial process:', e);
      await showProfessionalAlert('Partial Sync Failed', `Failed: ${e}`, 'danger');
    } finally {
      setIsProcessing(false);
    }
  };

  const isBalanceMatching = (() => {
    if (!activePackagingProject || !activeSession) return false;
    const reportLines = activeSession.report_lines || [];
    if (reportLines.length === 0) return false;

    let totalCutting = 0;
    let totalGoodAndReject = 0;

    for (const line of reportLines) {
      const baseLine = (activePackagingProject.base_lines || []).find((bl: any) => bl.size_val === line.size_val);
      const cuttingQty = baseLine ? (baseLine.total_good_qty || 0) : 0;
      totalCutting += cuttingQty;

      // Calculate other sessions' good qty
      const otherGood = (activePackagingProject.sessions || [])
        .filter((s: any) => s.cycle_number <= activeSession.cycle_number && s.session_id !== activeSession.session_id)
        .reduce((sum: number, s: any) => {
          const rl = (s.report_lines || []).find((l: any) => l.size_val === line.size_val);
          return sum + (rl?.session_qty || 0);
        }, 0);
      const goodGarments = otherGood + (line.session_qty || 0);

      // Calculate other sessions' reject qty
      const otherRejects = (activePackagingProject.sessions || [])
        .filter((s: any) => s.cycle_number <= activeSession.cycle_number && s.session_id !== activeSession.session_id)
        .reduce((sum: number, s: any) => {
          const rl = (s.report_lines || []).find((l: any) => l.size_val === line.size_val);
          if (!rl) return sum;
          const rc = rl.reject_cutting || 0;
          const rs = rl.reject_sewing || 0;
          const rf = rl.reject_finishing || 0;
          const rp = rl.reject_printing || 0;
          const re = rl.reject_embro || 0;
          const rw = rl.reject_washing || 0;
          const rb = rl.reject_bahan || 0;
          const bt = rl.btj || 0;
          const bh = rl.barang_hilang || 0;
          const rejProd = rc + rs + rf + rp + re + rw;
          return sum + (rb + rejProd + bt + bh);
        }, 0);

      const rBahan = line.reject_bahan || 0;
      const rCutting = line.reject_cutting || 0;
      const rSewing = line.reject_sewing || 0;
      const rFinishing = line.reject_finishing || 0;
      const rPrinting = line.reject_printing || 0;
      const rEmbro = line.reject_embro || 0;
      const rWashing = line.reject_washing || 0;
      const btjVal = line.btj || 0;
      const bHilang = line.barang_hilang || 0;
      const rejectProduksi = rCutting + rSewing + rFinishing + rPrinting + rEmbro + rWashing;
      const totalReject = otherRejects + (rBahan + rejectProduksi + btjVal + bHilang);

      totalGoodAndReject += (goodGarments + totalReject);
    }

    return totalCutting > 0 && totalGoodAndReject === totalCutting;
  })();


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
        report_id: `${nextSessionId}_LINE_${idx + 1}`,
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
        factory_representative: '', // Reset signature for new cycle session
        approval_status: null,       // Reset approval status
        approved_by: null,           // Reset audit
        approved_at: null,           // Reset audit
        approval_token: null,        // Reset token
        approval_email: null,        // Reset email
        inspector: currentSession.inspector || getInspectorProfile()?.name || '',
        version: currentSession.version || '1.0',
        result: 'Pending',
        report_lines: clonedLines
      };

      // If we came from an existing cycle (>=1), mark that cycle as completed
      if (currentCycle >= 1) {
        const updatedPrevSession = { ...currentSession, status: 'completed' };
        try {
          const closedVersion = await invoke<number>('save_packaging_session', { session: PackagingService.getInstance().sanitizeSession(updatedPrevSession) });
          setActiveSession((prev: any) => prev && prev.session_id === updatedPrevSession.session_id
            ? { ...prev, row_version: closedVersion } : prev);
        } catch (closeErr: any) {
          if (String(closeErr).includes('CONFLICT')) {
            // Another user already closed this cycle — safe to continue creating new cycle
            console.warn('Previous cycle had a conflict on close; continuing with new cycle.');
          } else {
            throw closeErr;
          }
        }
      }

      // Save new session (always an INSERT, no conflict possible)
      await PackagingService.getInstance().invokeSafe<number>('save_packaging_session', { session: newSession }, 1);
      if (clonedLines.length > 0) {
        await PackagingService.getInstance().invokeSafe<void>('save_packaging_project_reports', { reports: clonedLines }, undefined);
      }

      // Clear the project's verification report PDF since we are initializing a new unverified version cycle
      await PackagingService.getInstance().invokeSafe<void>('save_project_verification_doc', { 
        projectId: activePackagingProject.project_id, 
        docBase64: '' 
      }, undefined);

      // Refresh project list and state
      const res = await PackagingService.getInstance().invokeSafe<any[]>('get_packaging_projects', {}, []);
      updatePackagingProjects(res || []);

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

  // Seeding device-downloaded project IDs on startup
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('packaging_device_downloaded_projects');
      if (!stored && packagingProjects.length > 0) {
        const initialIds = packagingProjects.map(p => p.project_id);
        localStorage.setItem('packaging_device_downloaded_projects', JSON.stringify(initialIds));
        setDeviceProjectIds(initialIds);
      }
    }
  }, [packagingProjects]);

  useEffect(() => {
    if (isEditLocked && sessionEditMode) {
      setSessionEditMode(false);
      setTempDefectImages([]);
    }
  }, [isEditLocked]);

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
            (act.production_group || '').toLowerCase().includes(cleanQ) ||
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
            handleSelectPackagingProject(proj);
            return `Membuka proyek QC untuk artikel "${proj.article_name}".`;
          }
          return `Proyek dengan ID ${data.projectId} tidak ditemukan.`;
        }

        if (command === 'update_workspace_data') {
          if (!activeSession) return "Tidak ada sesi inspeksi yang aktif. Silakan buka proyek terlebih dahulu.";

          // Automatically enable edit mode if not already in edit mode (blocked when verified)
          if (!sessionEditMode && !isEditLocked) {
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
          if (isEditLocked) return "Sesi QC sedang dalam proses verifikasi dan dikunci. Reset verifikasi untuk mengedit.";
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
          return "Penyelesaian proyek sekarang otomatis: proyek akan selesai (completed) setelah Director menyetujui inspeksi melalui alur approval portal (Factory Rep \u2192 MD Production \u2192 Director).";
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
  }, [chatRegistryRef, activePackagingProject, activeSession, sessionEditMode, packagingProjects, activeActivities, tempDefectImages]);

  useEffect(() => {
    if (templateId === 'pack_v0') {
      fetchPackagingProjects(true);
    }
  }, [templateId]);

  useEffect(() => {
    const templates = dbService.getTemplates();
    const found = templates.find(t => t.id === templateId);
    if (found) setTemplate(found);
  }, [templateId]);

  useEffect(() => {
    if (aiFillData && clearAiFill) clearAiFill();
  }, [aiFillData]);

  useEffect(() => {
    if (aiCalculateDefects != null && clearAiCalculate) clearAiCalculate();
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

  // QMS Actions & Handlers
  const handleDownloadProject = async (activityOverride?: any) => {
    // Safety check: if activityOverride is a React SyntheticEvent, ignore it and fall back to selectedActivity
    const act = (activityOverride && typeof activityOverride === 'object' && ('production_group' in activityOverride || 'plm_id' in activityOverride || 'plmId' in activityOverride || 'project_id' in activityOverride))
      ? activityOverride
      : selectedActivity;
    if (!act) return;

    const rawPlmId = String(act.plm_id || act.plmId || act.project_id || '');
    const rawPrg = String(act.production_group || '');

    // Prevent double active project (duplicate downloads of the same PRG ID)
    const existing = packagingProjects.find(
      (p: any) => p.production_group === rawPrg
    );
    if (existing) {
      // Style is already active, open it directly!
      setSelectedActivity(null);
      handleSelectPackagingProject(existing);
      return;
    }

    setIsProcessing(true);
    setProcessingMessage(`Downloading workspace for ${act.article_name}...`);
    setIsDownloading(true);
    try {
      if (templateId === 'pack_v0') {
        // Check if this PRG was previously removed — restore it instead of creating a new project
        const removed = await PackagingService.getInstance().invokeSafe<any>('find_removed_project_by_prg', { prg: rawPrg }, null);
        if (removed && removed.project_id) {
          const restoreStatus = removed.status === 'removed_completed' ? 'completed' : 'downloaded';
          await PackagingService.getInstance().invokeSafe<void>('restore_packaging_project', { projectId: removed.project_id, restoreStatus }, undefined);

          const stored = localStorage.getItem('packaging_device_downloaded_projects');
          let deviceProjects: string[] = stored ? JSON.parse(stored) : [];
          if (!deviceProjects.includes(removed.project_id)) {
            const nextDeviceProjects = [...deviceProjects, removed.project_id];
            localStorage.setItem('packaging_device_downloaded_projects', JSON.stringify(nextDeviceProjects));
            setDeviceProjectIds(nextDeviceProjects);
          }

          const res = await PackagingService.getInstance().invokeSafe<any[]>('get_packaging_projects', {}, []);
          updatePackagingProjects(res || []);
          setSelectedActivity(null);
          await showProfessionalAlert(
            'Project Restored',
            `Workspace for ${act.article_name} has been restored${restoreStatus === 'completed' ? ' with its completed status' : ''}.`,
            'success'
          );
          return;
        }

        const projectId = `PRJ-${rawPrg.replace(/\//g, '-')}-${Date.now()}`;

        const projectObj = {
          project_id: projectId,
          plm_id: rawPlmId,
          brand: act.brand || 'N/A',
          season: act.season || 'N/A',
          article_name: act.article_name || 'N/A',
          production_group: rawPrg,
          po_info: act.po_info || null,
          po_qty: act.po_qty || null,
          po_plan_date: act.po_plan_date || null,
          po_vendor: act.po_vendor || null,
          status: 'downloaded',
          sales_price: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const resolvedProjectId = await PackagingService.getInstance().invokeSafe<string>('save_packaging_project', { project: projectObj }, projectId);

        // Add to local device project list
        const stored = localStorage.getItem('packaging_device_downloaded_projects');
        let deviceProjects: string[] = stored ? JSON.parse(stored) : [];
        if (!deviceProjects.includes(resolvedProjectId)) {
          const nextDeviceProjects = [...deviceProjects, resolvedProjectId];
          localStorage.setItem('packaging_device_downloaded_projects', JSON.stringify(nextDeviceProjects));
          setDeviceProjectIds(nextDeviceProjects);
        }

        // Fetch refreshed list from DB and update the projects list
        const res = await PackagingService.getInstance().invokeSafe<any[]>('get_packaging_projects', {}, []);
        updatePackagingProjects(res || []);
        
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
      updatePackagingProjects(res || []);
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

  const handleUploadVerificationDoc = async (projectId: string, docBase64: string, silent = false) => {
    if (!silent) {
      setIsProcessing(true);
      setProcessingMessage('Saving signed verification document...');
    }
    try {
      await PackagingService.getInstance().invokeSafe<void>('save_project_verification_doc', { projectId, docBase64 }, undefined);
      // Update disk cache so verified_doc survives an offline restart — without this the
      // WorkspaceControls catch-up logic would fire again on next project open.
      const cached = PackagingService.getInstance().getStoredProjects();
      const updatedCache = cached.map((p: any) => p.project_id === projectId ? { ...p, verified_doc: docBase64 } : p);
      await PackagingService.getInstance().saveStoredProjects(updatedCache);
      // Targeted local state update — avoids full project list re-fetch which causes blank flash
      setActivePackagingProject((prev: any) => prev ? { ...prev, verified_doc: docBase64 } : prev);
      if (!silent) {
        await showProfessionalAlert('Verified', 'Both approvals collected. The fully-signed report has been saved.', 'success');
      }
    } catch (e) {
      console.error('Failed to save verification document:', e);
      if (!silent) {
        await showProfessionalAlert('Upload Failed', `Failed to save signed document: ${e}`, 'danger');
      }
    } finally {
      if (!silent) setIsProcessing(false);
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
            handleRemovePackagingProject={handleRemovePackagingProject}
            setActiveSession={setActiveSession}
            setSelectedSizeTab={setSelectedSizeTab}
            setSessionEditMode={setSessionEditMode}
            headerButtonStyle={headerButtonStyle}
            versionSelectorButtonStyle={versionSelectorButtonStyle}
            handlePrintReport={handlePrintReport}
            handleUploadVerificationDoc={handleUploadVerificationDoc}
            showProfessionalAlert={showProfessionalAlert}
            showProfessionalConfirm={showProfessionalConfirm}
            isBalanceMatching={isBalanceMatching}
            handlePartialSyncProject={handlePartialSyncProject}
            isOnline={isOnline}
            isProcessing={isProcessing}
            tempDefectImages={tempDefectImages}
            onRefreshProject={handleRefreshActiveProject}
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
                      {activePackagingProject?.status === 'completed' ? (
                        <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#059669', background: 'rgba(5, 150, 105, 0.1)', border: '1.5px solid rgba(5, 150, 105, 0.3)', borderRadius: '20px', padding: '0.2rem 0.65rem', letterSpacing: '0.03em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                          Successful Completion
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#EA580C', background: 'rgba(234, 88, 12, 0.08)', border: '1.5px solid rgba(234, 88, 12, 0.28)', borderRadius: '20px', padding: '0.2rem 0.65rem', letterSpacing: '0.03em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                          Pending Completion
                        </span>
                      )}
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
                        activePackagingProject.status !== 'completed' && !isEditLocked && (
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
                  handleRemoveDefectImage={handleRemoveDefectImage}
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
        packagingProjects={packagingProjects}
        deviceProjectIds={deviceProjectIds}
        selectedActivity={selectedActivity}
        setSelectedActivity={setSelectedActivity}
        isDownloading={isDownloading}
        deletingProjectId={deletingProjectId}
        handleDownloadProject={handleDownloadProject}
        handleRemovePackagingProject={handleRemovePackagingProject}
        setActivePackagingProject={handleSelectPackagingProject}
        isFetchingProjects={isFetchingProjects}
        showProfessionalAlert={showProfessionalAlert}
        getCycleName={getCycleName}
      />
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
        getCycleName={getCycleName}
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

          {renderQmsWorkspace()}
        </div>

        {/* Right Column: Docked Kaizen AI Copilot Sidebar (only shown when NO packaging project is opened) */}
        {!activePackagingProject && (
          <div className="copilot-side-card" style={{ flex: '30 1 0%', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <div className="flex-between kaizen-center-header" style={{ marginBottom: '1rem', borderBottom: '1.5px solid rgba(37, 99, 235, 0.12)', paddingBottom: '0.75rem', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="hud-logo-hexagon kaizen-logo-mini" style={{ width: '14px', height: '14px' }}></span>
                <span className="kaizen-title-label" style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Kaizen AI Assistant
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
                placeholder={isListening ? "Listening..." : "Ask Kaizen AI Assistant..."}
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
                  {guidelinesLanguage === 'en' ? 'Final Inspection QC — Operational Scope' : 'Lingkup Operasional Final Inspection QC'}
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
