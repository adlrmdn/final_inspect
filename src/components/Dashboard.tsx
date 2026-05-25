import { useState, useEffect, useRef } from 'react';
import { DatabaseService } from '../services/database_service';
import { SyncEngine } from '../services/sync_engine';
import { QCInspectionTemplate } from '../models/qc_template';
import { AIAgentService, AgentResponse } from '../services/ai_agent_service';

interface DashboardProps {
  onSelectTemplate: (templateId: string) => void;
}

interface ChatMessage {
  sender: 'user' | 'agent';
  text: string;
  thinking?: string;
  timestamp: string;
}

export default function Dashboard({ onSelectTemplate }: DashboardProps) {
  const [templates, setTemplates] = useState<QCInspectionTemplate[]>([]);
  const [isOnline, setIsOnline] = useState(true);

  // Chat/Voice States inside Main Center HUD
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      sender: 'agent',
      text: "System initialized. I am Kaizen, your offline Quality Control Assistant. Speak, type, or choose an operation to direct your inspection workflow.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [isListening, setIsListening] = useState(false);
  
  // AR Mock Scanner states
  const [isScannerActive, setIsScannerActive] = useState(false);
  const [scannerProgress, setScannerProgress] = useState<'idle' | 'reading' | 'success'>('idle');

  const dbService = DatabaseService.getInstance();
  const syncEngine = SyncEngine.getInstance();
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    setTemplates(dbService.getTemplates());
    setIsOnline(syncEngine.getOnlineStatus());

    // SyncEngine status registration
    const unsubscribe = syncEngine.registerListener(() => {
      setIsOnline(syncEngine.getOnlineStatus());
    });

    // Voice recognition setup
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsListening(true);
      };

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        handleSendChat(transcript);
      };

      rec.onerror = (e: any) => {
        console.error(e);
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech Recognition not supported on this platform. Please type.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  const handleSendChat = (textToSend?: string) => {
    const text = textToSend || chatInput;
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChatHistory(prev => [...prev, userMsg]);
    if (!textToSend) setChatInput('');

    // Process local command using Kaizen branding
    const aiService = AIAgentService.getInstance();
    const result: AgentResponse = aiService.processCommand(text);

    // Swap chatbot replies to reflect Kaizen branding
    let reply = result.reply;
    if (reply.includes('local AI Copilot') || reply.includes('local AI')) {
      reply = reply.replace('local AI Copilot', 'Kaizen').replace('local AI', 'Kaizen');
    }

    setTimeout(() => {
      const agentMsg: ChatMessage = {
        sender: 'agent',
        text: reply,
        thinking: result.thinking.replace('CHAT_RESPONSE', 'KAIZEN_INTENT'),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatHistory(prev => [...prev, agentMsg]);

      // Route if match
      if (result.action && result.action.type === 'navigate' && result.action.target) {
        if (result.action.target !== 'dashboard') {
          setTimeout(() => {
            onSelectTemplate(result.action!.target!);
          }, 800);
        }
      }
    }, 600);
  };

  // Holographic QR Scanner trigger
  const handleTriggerScanner = () => {
    setIsScannerActive(true);
    setScannerProgress('reading');
    
    setTimeout(() => {
      setScannerProgress('success');
      
      setTimeout(() => {
        setIsScannerActive(false);
        setScannerProgress('idle');
        onSelectTemplate('fabric_v1');
      }, 1200);
    }, 2200);
  };

  return (
    <div className="dashboard-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      
      {/* Dynamic HUD Header */}
      <div className="flex-between" style={{ alignItems: 'center', marginBottom: '0.5rem', flexShrink: 0 }}>
        <div>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--royal-blue)' }}>Quality Control System</span>
          <h1 style={{ fontSize: '1.75rem', margin: 0, letterSpacing: '-0.02em', color: 'var(--deep-ocean)' }}>Quality Control Console</h1>
        </div>
        <div className={`electric-badge ${isOnline ? 'teal' : ''}`} style={{ fontSize: '0.68rem', padding: '0.2rem 0.6rem' }}>
          {isOnline ? 'Core Online' : 'Core Offline'}
        </div>
      </div>

      {/* CENTRAL PIECE: Full-bleed Kaizen AI Assistant */}
      <div className="bento-card central-hud-command-center full-bleed-centerpiece" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'visible', marginBottom: '2.25rem', padding: '0.85rem 1.15rem 3.25rem', position: 'relative' }}>
        <div className="flex-between" style={{ borderBottom: '1.5px solid rgba(15, 23, 42, 0.06)', paddingBottom: '0.4rem', marginBottom: '0.5rem', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span className="hud-logo-hexagon" style={{ width: '12px', height: '14px' }}></span>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--deep-ocean)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Kaizen // AI Quality Assistant
            </span>
          </div>
          <span className="electric-badge" style={{ fontSize: '0.6rem', padding: '0.15rem 0.5rem' }}>Local SLM</span>
        </div>

        {/* Local Chat Scroll Area */}
        <div className="hud-local-chat-scroll" style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '0.9rem', marginBottom: '0.5rem' }}>
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
                
                {/* Integrated Thinking Block (Diagnostic header inside envelope card) */}
                {msg.sender === 'agent' && msg.thinking && (
                  <div className="envelope-thinking-header">
                    <div style={{ display: 'flex', gap: '3.5px', alignItems: 'center', marginRight: '4px' }}>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#EF4444', display: 'inline-block' }}></span>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }}></span>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }}></span>
                    </div>
                    <span style={{ fontSize: '0.62rem', fontFamily: 'monospace', color: 'var(--royal-blue)', display: 'inline-block', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      &gt;_ {msg.thinking}
                    </span>
                    <span className="thinking-terminal-cursor"></span>
                  </div>
                )}

                {/* Main Message Bubble */}
                <div className={`chat-bubble-modern ${msg.sender}`}>
                  <p style={{ margin: 0, color: 'inherit', fontSize: '0.85rem', lineHeight: '1.45' }}>{msg.text}</p>
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
        <div className="quick-actions-bar ops-chips-scroll" style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', overflowX: 'auto', paddingBottom: '2px', flexShrink: 0, justifyContent: 'center' }}>
          <button 
            type="button"
            className="quick-action-chip"
            onClick={() => {
              setChatInput("Open Fabric Quality Control");
              setTimeout(() => handleSendChat("Open Fabric Quality Control"), 100);
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '4px', verticalAlign: 'middle', display: 'inline-flex' }}>
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
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '4px', verticalAlign: 'middle', display: 'inline-flex' }}>
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
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '4px', verticalAlign: 'middle', display: 'inline-flex' }}>
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
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '4px', verticalAlign: 'middle', display: 'inline-flex' }}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Run Diagnostic
          </button>
        </div>

        {/* Improved Sleek Centered Floating Chat Input Bar */}
        <div className="premium-chatbar-wrapper" style={{ flexShrink: 0, position: 'relative', width: '100%', maxWidth: '620px', margin: '0.25rem auto 0 auto' }}>
          {isListening && (
            <div className="voice-visualizer-wave">
              <div className="voice-bar bar-1"></div>
              <div className="voice-bar bar-2"></div>
              <div className="voice-bar bar-3"></div>
              <div className="voice-bar bar-4"></div>
              <div className="voice-bar bar-5"></div>
            </div>
          )}

          <div className="premium-chat-bar">
            {/* Sparkling AI Indicator prefix */}
            <div className="chatbar-prefix-badge">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--royal-blue)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
              </svg>
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
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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

        {/* Popped-out integrated QRIS Scan action button in the bottom center */}
        <div 
          className="qris-popped-center-container"
          style={{
            position: 'absolute',
            bottom: '-32px', // Float exactly in the wide bottom gap of chat card
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            cursor: 'pointer'
          }}
          onClick={isScannerActive ? undefined : handleTriggerScanner}
        >
          <div 
            className={`qris-floating-action-button ${scannerProgress === 'reading' ? 'scanning' : ''}`}
            style={{
              width: '58px',
              height: '58px',
              background: 'linear-gradient(135deg, var(--royal-blue) 0%, #1D4ED8 100%)',
              borderRadius: '16px',
              boxShadow: '0 8px 24px rgba(37, 99, 235, 0.35)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              position: 'relative',
              transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* Corner brackets */}
            <div className="qris-btn-corner top-left"></div>
            <div className="qris-btn-corner top-right"></div>
            <div className="qris-btn-corner bottom-left"></div>
            <div className="qris-btn-corner bottom-right"></div>
            
            {/* Laser Line */}
            <div className="qris-btn-laser"></div>

            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ zIndex: 2 }}>
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
          </div>
          
          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', marginTop: '4px', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'Courier New, monospace' }}>
            {scannerProgress === 'reading' ? 'Scanning...' : (scannerProgress === 'success' ? 'Success!' : 'Scan')}
          </span>
        </div>

      </div>

      {/* BOTTOM HUD DOCK: Symmetrical Unified Operations Bento Container Box */}
      <div 
        className="bento-card operations-unified-dock" 
        style={{ 
          display: 'flex', 
          flexDirection: 'column',
          gap: '0.45rem', 
          height: '115px', 
          marginTop: '0.1rem', 
          flexShrink: 0, 
          padding: '0.65rem 1.25rem',
          background: 'rgba(255, 255, 255, 0.8)',
          border: '1px solid rgba(15, 23, 42, 0.08)',
          borderRadius: '20px',
          boxShadow: '0 -4px 20px rgba(15, 23, 42, 0.01)',
          position: 'relative'
        }}
      >
        {/* Symmetrical Section Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Available Operations
          </span>
        </div>

        {/* Symmetrical Operations Grid */}
        <div style={{ display: 'flex', gap: '1.25rem', flex: 1, alignItems: 'center', width: '100%' }}>
          
          {/* Fabric Quality Control Button (Left) */}
          {templates[0] && (
            <div 
              className="operation-dock-card" 
              onClick={() => onSelectTemplate(templates[0].id)}
              style={{
                flex: 1,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(15, 23, 42, 0.015)',
                border: '1px solid rgba(15, 23, 42, 0.05)',
                borderLeft: '4px solid var(--royal-blue)',
                borderRadius: '12px',
                padding: '0.55rem 1.15rem',
                height: '66px',
                transition: 'all 0.25s ease'
              }}
            >
              {/* Thread spool/fabric loom weave icon */}
              <div className="card-icon-badge blue-glow" style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.05) 100%)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: '0.85rem',
                flexShrink: 0,
                border: '1px solid rgba(59, 130, 246, 0.12)'
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--royal-blue)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v20" />
                  <path d="M18 6H6M18 10H6M18 14H6M18 18H6" />
                  <rect x="5" y="3" width="14" height="18" rx="2" strokeWidth="2" />
                </svg>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', textAlign: 'left' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: 'var(--deep-ocean)' }}>{templates[0].title}</h3>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: '1.3' }}>{templates[0].description}</span>
              </div>
            </div>
          )}

          {/* Center Space Holder for Popped down QRIS scanner */}
          <div style={{ width: '90px', flexShrink: 0 }}></div>

          {/* Packaging Quality Control Button (Right) */}
          {templates[1] && (
            <div 
              className="operation-dock-card" 
              onClick={() => onSelectTemplate(templates[1].id)}
              style={{
                flex: 1,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(15, 23, 42, 0.015)',
                border: '1px solid rgba(15, 23, 42, 0.05)',
                borderLeft: '4px solid var(--teal-blue)',
                borderRadius: '12px',
                padding: '0.55rem 1.15rem',
                height: '66px',
                transition: 'all 0.25s ease'
              }}
            >
              {/* Isometric 3D box icon */}
              <div className="card-icon-badge teal-glow" style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(13, 148, 136, 0.1) 0%, rgba(13, 148, 136, 0.05) 100%)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: '0.85rem',
                flexShrink: 0,
                border: '1px solid rgba(13, 148, 136, 0.12)'
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--teal-blue)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', textAlign: 'left' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: 'var(--deep-ocean)' }}>{templates[1].title}</h3>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: '1.3' }}>{templates[1].description}</span>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
