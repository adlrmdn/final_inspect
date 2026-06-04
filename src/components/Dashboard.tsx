import React, { useState, useEffect, useCallback } from 'react';
import { DatabaseService } from '../services/database_service';
import { SyncEngine } from '../services/sync_engine';
import { QCInspectionTemplate } from '../models/qc_template';
import { ScannerService, ScanPhase } from '../services/scanner_service';
import { ChatMessage } from '../hooks/useChatEngine';

interface DashboardProps {
  onSelectTemplate: (templateId: string) => void;
  chatHistory: ChatMessage[];
  chatInput: string;
  setChatInput: (val: string) => void;
  isListening: boolean;
  handleSendChat: (text?: string) => void;
  toggleListening: () => void;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  isTauri: boolean;
  onMinimize: () => void;
  onClose: () => void;
}

const TypewriterText = ({ text, isLastAgentMessage }: { text: string; isLastAgentMessage: boolean }) => {
  const [displayedText, setDisplayedText] = useState(isLastAgentMessage ? '' : text);

  useEffect(() => {
    if (!isLastAgentMessage) {
      setDisplayedText(text);
      return;
    }

    let currentIndex = 0;
    setDisplayedText('');
    
    const interval = setInterval(() => {
      if (currentIndex < text.length) {
        setDisplayedText((prev) => prev + text.charAt(currentIndex));
        currentIndex++;
      } else {
        clearInterval(interval);
      }
    }, 20);

    return () => clearInterval(interval);
  }, [text, isLastAgentMessage]);

  return (
    <p className="chat-bubble-text">
      {displayedText}
      {isLastAgentMessage && displayedText.length < text.length && (
        <span className="thinking-terminal-cursor"></span>
      )}
    </p>
  );
};

export default function Dashboard({
  onSelectTemplate,
  chatHistory,
  chatInput,
  setChatInput,
  isListening,
  handleSendChat,
  toggleListening,
  chatEndRef,
  isTauri,
  onMinimize,
  onClose
}: DashboardProps) {
  const [templates, setTemplates] = useState<QCInspectionTemplate[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // AR Mock Scanner states
  const [isScannerActive, setIsScannerActive] = useState(false);
  const [scannerProgress, setScannerProgress] = useState<ScanPhase>('idle');

  const dbService = DatabaseService.getInstance();
  const syncEngine = SyncEngine.getInstance();
  const scannerService = ScannerService.getInstance();

  useEffect(() => {
    setTemplates(dbService.getTemplates());
    setIsOnline(syncEngine.getOnlineStatus());
    setIsLoading(false);

    const unsubscribe = syncEngine.registerListener((count, syncing) => {
      setIsOnline(syncEngine.getOnlineStatus());
      setIsSyncing(syncing);
      setPendingCount(count);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, chatEndRef]);

  // Holographic QR Scanner trigger using ScannerService
  const handleTriggerScanner = useCallback(async () => {
    if (isScannerActive) return;
    setIsScannerActive(true);

    await scannerService.performScan('fabric_v0', (phase: ScanPhase) => {
      setScannerProgress(phase);
    });

    setIsScannerActive(false);
    onSelectTemplate('fabric_v0');
  }, [isScannerActive, onSelectTemplate, scannerService]);

  const handleDockCardKeyDown = useCallback((e: React.KeyboardEvent, templateId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectTemplate(templateId);
    }
  }, [onSelectTemplate]);

  const handleScannerKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!isScannerActive) handleTriggerScanner();
    }
  }, [isScannerActive, handleTriggerScanner]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    card.style.setProperty('--mouse-x', `${x}px`);
    card.style.setProperty('--mouse-y', `${y}px`);
  }, []);

  // Template icon/color map for dynamic rendering
  const templateStyles: Record<string, { colorClass: string; iconColorVar: string; icon: React.JSX.Element }> = {
    fabric_v0: {
      colorClass: 'ops-dock-card-blue',
      iconColorVar: 'var(--royal-blue)',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--royal-blue)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v20" />
          <path d="M18 6H6M18 10H6M18 14H6M18 18H6" />
          <rect x="5" y="3" width="14" height="18" rx="2" strokeWidth="2" />
        </svg>
      ),
    },
    pack_v0: {
      colorClass: 'ops-dock-card-teal',
      iconColorVar: 'var(--teal-blue)',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--teal-blue)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      ),
    },
  };

  const getTemplateStyle = (id: string) =>
    templateStyles[id] ?? {
      colorClass: 'ops-dock-card-blue',
      iconColorVar: 'var(--royal-blue)',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--royal-blue)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>
      ),
    };

  return (
    <div className="dashboard-container dashboard-layout">

      {/* Dynamic HUD Header */}
      <div className="flex-between dashboard-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="dashboard-system-label">Quality Control System</span>
            <span className="electric-badge teal hud-header-badge" style={{ fontSize: '0.62rem', padding: '0.1rem 0.4rem', lineHeight: '1' }}>
              {isTauri ? 'Desktop HUD' : 'Web Sandbox'}
            </span>
          </div>
          <h1 className="dashboard-title">Quality Control Console</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {isSyncing && (
            <span className="sync-activity-indicator">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Syncing {pendingCount}
            </span>
          )}
          <div className="hud-window-controls hud-window-controls-bar" style={{ display: 'flex', gap: '0.35rem' }}>
            <button className="hud-win-btn minimize" onClick={onMinimize} aria-label="Minimize" title="Minimize Window">
              <svg width="10" height="2" viewBox="0 0 10 2" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.85 }}>
                <path d="M1 1H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
            <button className="hud-win-btn close" onClick={onClose} aria-label="Close" title="Quit Application">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.85 }}>
                <path d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* CENTRAL PIECE: Full-bleed Kaizen AI Assistant */}
      <div className={`bento-card central-hud-command-center full-bleed-centerpiece kaizen-center-card ${isScannerActive ? 'scanning-active-hologram' : ''}`}>
        {isScannerActive && (
          <div className="hologram-scan-overlay">
            <div className="hologram-grid-lines"></div>
            <div className="hologram-sweep-laser"></div>
          </div>
        )}
        <div className="flex-between kaizen-center-header">
          <div className="kaizen-center-header-left">
            <span className="hud-logo-hexagon kaizen-logo-mini"></span>
            <span className="kaizen-title-label">
              Kaizen AI Assistant
            </span>
          </div>
          <span className={`electric-badge kaizen-slm-badge ${isOnline ? 'teal' : ''}`}>
            {isOnline ? 'Core Online' : 'Core Offline'}
          </span>
        </div>

        {/* Local Chat Scroll Area */}
        <div className="hud-local-chat-scroll kaizen-chat-scroll">
          {chatHistory.map((msg, idx) => (
            <div key={idx} className={`chat-message-envelope ${msg.sender}`}>

              {/* Left side avatar for Agent (Kaizen) */}
              {msg.sender === 'agent' && (
                <div className="envelope-avatar agent-avatar" title="Kaizen Assistant">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </div>
              )}

              {/* Message Content Wrap */}
              <div className={`chat-envelope-content ${msg.sender}`}>
                <div className={`chat-bubble-modern ${msg.sender}`}>
                  <TypewriterText text={msg.text} isLastAgentMessage={msg.sender === 'agent' && idx === chatHistory.length - 1} />
                  <span className="chat-timestamp">{msg.timestamp}</span>
                </div>
              </div>

              {/* Right side avatar for User (Operator) */}
              {msg.sender === 'user' && (
                <div className="envelope-avatar user-avatar" title="System Operator">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
              )}

            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Floating Quick Action Recommendation Chips */}
        <div className="quick-actions-bar-centered ops-chips-scroll">
          <button
            type="button"
            className="quick-action-chip"
            onClick={() => {
              setChatInput("Open Fabric Quality Control");
              setTimeout(() => handleSendChat("Open Fabric Quality Control"), 100);
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="quick-action-chip-icon">
              <path d="M12 2v20M2 12h20M12 12c0-3.314 2.686-6 6-6s6 2.686 6 6-2.686 6-6 6" />
            </svg>
            Inspect Fabric
          </button>
          <button
            type="button"
            className="quick-action-chip"
            onClick={() => {
              setChatInput("Open Packaging Quality Control");
              setTimeout(() => handleSendChat("Open Packaging Quality Control"), 100);
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="quick-action-chip-icon">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
            Audit Packaging
          </button>
          <button
            type="button"
            className="quick-action-chip"
            onClick={() => {
              setChatInput("Is Core System Online?");
              setTimeout(() => handleSendChat("Is Core System Online?"), 100);
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="quick-action-chip-icon">
              <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            Core Status
          </button>
          <button
            type="button"
            className="quick-action-chip"
            onClick={() => {
              setChatInput("Run Offline Diagnostic");
              setTimeout(() => handleSendChat("Run Offline Diagnostic"), 100);
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="quick-action-chip-icon">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Run Diagnostic
          </button>
        </div>

        {/* Improved Sleek Centered Floating Chat Input Bar */}
        <div className="premium-chatbar-container">
          <div className="premium-chat-bar">
            {/* Sparkling AI Indicator prefix / Voice Visualizer when active */}
            <div className={`chatbar-prefix-badge ${isListening ? 'listening-active-prefix' : ''}`}>
              {isListening ? (
                <div className="voice-visualizer-wave-inline">
                  <div className="voice-bar bar-1"></div>
                  <div className="voice-bar bar-2"></div>
                  <div className="voice-bar bar-3"></div>
                  <div className="voice-bar bar-4"></div>
                  <div className="voice-bar bar-5"></div>
                </div>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--royal-blue)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                </svg>
              )}
            </div>

            <input
              type="text"
              className="premium-chat-input"
              placeholder={isListening ? "Listening to voice command..." : "Ask Kaizen to open forms, sync, or run diagnostics..."}
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendChat()}
              disabled={isListening}
            />

            <div className="chatbar-controls">
              <button
                type="button"
                className={`premium-mic-btn ${isListening ? 'listening-active' : ''}`}
                onClick={toggleListening}
                title="Voice Dictation Command"
                style={{ color: isListening ? '#FFFFFF' : 'var(--royal-blue)' }}
              >
                {isListening ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ zIndex: 1 }}>
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ zIndex: 1 }}>
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
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* QRIS Scan button — hangs off the bottom edge of the chat card */}
        <div
          className="qris-popped-center"
          role="button"
          tabIndex={0}
          onClick={isScannerActive ? undefined : handleTriggerScanner}
          onKeyDown={handleScannerKeyDown}
          aria-label="Scan QR code"
        >
          <div
            className={`qris-floating-action-button qris-action-btn ${scannerProgress === 'reading' ? 'scanning' : ''}`}
          >
            <div className="qris-btn-corner top-left"></div>
            <div className="qris-btn-corner top-right"></div>
            <div className="qris-btn-corner bottom-left"></div>
            <div className="qris-btn-corner bottom-right"></div>
            <div className="qris-btn-laser"></div>

            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ zIndex: 2 }}>
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
          </div>

          <span className="qris-scan-label">
            {scannerProgress === 'reading' ? 'Scanning...' : (scannerProgress === 'success' ? 'Success!' : 'Scan')}
          </span>
        </div>

      </div>

      {/* 10% Flexible Vertical Spacer for Gap */}
      <div style={{ flex: '10 1 0%', minHeight: 0, flexShrink: 0, position: 'relative' }}></div>

      {/* BOTTOM HUD DOCK: Operations Bento Container */}
      <div className="bento-card operations-unified-dock ops-dock-container">
        {/* Section Header */}
        <div className="ops-dock-label">
          <span className="ops-dock-label-text">
            Available Operations
          </span>
        </div>

        {/* Operations Grid */}
        <div className="ops-dock-grid">
          {isLoading && (
            <div className="loading-state">Loading templates...</div>
          )}

          {!isLoading && templates.length === 0 && (
            <div className="empty-state">
              <span>No templates available.</span>
            </div>
          )}

          {!isLoading && templates.map((tmpl, idx) => {
            const style = getTemplateStyle(tmpl.id);
            const badgeClass = tmpl.id === 'pack_v0' ? 'card-icon-badge-teal' : 'card-icon-badge-blue';
            const glowClass = tmpl.id === 'pack_v0' ? 'teal-glow' : 'blue-glow';

            return (
              <React.Fragment key={tmpl.id}>
                {/* Spacer for the hanging QRIS scanner button */}
                {idx === 1 && <div className="ops-dock-scanner-spacer"></div>}
                <div
                  className={`operation-dock-card ops-dock-card-base ${style.colorClass}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectTemplate(tmpl.id)}
                  onKeyDown={e => handleDockCardKeyDown(e, tmpl.id)}
                  onMouseMove={handleMouseMove}
                  aria-label={`Open ${tmpl.title}`}
                >
                  <div className={`card-icon-badge card-icon-badge-base ${badgeClass} ${glowClass}`}>
                    {style.icon}
                  </div>

                  <div className="ops-dock-card-info">
                    <h3 className="ops-dock-card-title">{tmpl.title}</h3>
                    <span className="ops-dock-card-desc">{tmpl.description}</span>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>

      </div>

    </div>
  );
}
