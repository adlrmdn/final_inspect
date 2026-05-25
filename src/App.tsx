import { useState, useEffect, useRef } from 'react';
import './App.css';
import Dashboard from './components/Dashboard';
import FormView from './components/FormView';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { AIAgentService, AgentResponse } from './services/ai_agent_service';

interface ChatMessage {
  sender: 'user' | 'agent';
  text: string;
  thinking?: string;
  timestamp: string;
}

function App() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'form'>('dashboard');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [isTauri, setIsTauri] = useState(false);

  // AI & Voice State
  const isCopilotOpen = true;
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      sender: 'agent',
      text: "System initialized offline. I am Kaizen, your Quality Control Assistant. Speak, type, or ask me to inspect fabric to start.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [isListening, setIsListening] = useState(false);
  const [aiFormFillData, setAiFormFillData] = useState<Record<string, any> | null>(null);
  const [aiCalculateDefects, setAiCalculateDefects] = useState<number | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Detect if we are running inside the Tauri native desktop wrapper
    if (window && (window as any).__TAURI_INTERNALS__) {
      setIsTauri(true);
    }

    // Set up Speech Recognition
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
        handleSendMessage(transcript);
      };

      rec.onerror = (e: any) => {
        console.error('Speech recognition error:', e);
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }
  }, []);

  useEffect(() => {
    // Scroll chat to bottom when expanded
    if (isHistoryExpanded) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isHistoryExpanded]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech Recognition not supported on this platform. Please type your command.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  const handleSendMessage = (textToSend?: string) => {
    const rawText = textToSend || chatInput;
    if (!rawText.trim()) return;

    // Append User Message
    const userMsg: ChatMessage = {
      sender: 'user',
      text: rawText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChatHistory(prev => [...prev, userMsg]);
    if (!textToSend) setChatInput('');

    // Expand history drawer automatically when user sends message
    setIsHistoryExpanded(true);

    // Process with AIAgentService
    const aiService = AIAgentService.getInstance();
    const result: AgentResponse = aiService.processCommand(rawText);

    // Swap chatbot replies to reflect Kaizen branding
    let reply = result.reply;
    if (reply.includes('local AI Copilot') || reply.includes('local AI')) {
      reply = reply.replace('local AI Copilot', 'Kaizen').replace('local AI', 'Kaizen');
    }

    // AI Response Delay Simulation
    setTimeout(() => {
      const agentMsg: ChatMessage = {
        sender: 'agent',
        text: reply,
        thinking: result.thinking.replace('CHAT_RESPONSE', 'KAIZEN_INTENT'),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatHistory(prev => [...prev, agentMsg]);

      // Execute action if matched
      if (result.action) {
        const { type, target, data } = result.action;
        if (type === 'navigate') {
          if (target === 'dashboard') {
            navigateToDashboard();
          } else if (target) {
            navigateToForm(target);
          }
        } else if (type === 'fill' && data) {
          setAiFormFillData(data);
        } else if (type === 'calculate' && data) {
          setAiCalculateDefects(data.defects);
        }
      }
    }, 600);
  };

  const navigateToForm = (templateId: string) => {
    setSelectedTemplate(templateId);
    setCurrentView('form');
  };

  const navigateToDashboard = () => {
    setSelectedTemplate(null);
    setCurrentView('dashboard');
    setAiFormFillData(null);
    setAiCalculateDefects(null);
  };

  const handleMinimize = async () => {
    if (isTauri) {
      try {
        await getCurrentWindow().minimize();
      } catch (e) {
        console.error('Tauri window minimize failed:', e);
        alert('Minimize permission error.');
      }
    } else {
      alert('Desktop Control: Minimize simulated (Web Browser).');
    }
  };

  const handleClose = async () => {
    if (isTauri) {
      try {
        await getCurrentWindow().close();
      } catch (e) {
        console.error('Tauri window close failed:', e);
        alert('Quit permission error.');
      }
    } else {
      alert('Desktop Control: Quit simulated (Web Browser).');
    }
  };

  return (
    <main className="hud-root">
      {/* HUD Header Bar */}
      <header className="hud-header flex-between">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div className="hud-logo-hexagon"></div>
          <span className="hud-logo-text">Quality Control Console</span>
          <span className="electric-badge teal" style={{ marginLeft: '0.5rem', fontSize: '0.65rem', padding: '0.15rem 0.4rem' }}>
            {isTauri ? 'Desktop HUD' : 'Web Sandbox'}
          </span>
        </div>
        <div className="hud-window-controls" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className="hud-win-btn minimize" onClick={handleMinimize} aria-label="Minimize" title="Minimize Window">
            &minus;
          </button>
          <button className="hud-win-btn close" onClick={handleClose} aria-label="Close" title="Quit Application">
            &times;
          </button>
        </div>
      </header>

      {/* Full-Width Workspace Layout */}
      <div className="hud-workspace-container">
        <section className="hud-full-pane">
          {currentView === 'dashboard' && (
            <Dashboard onSelectTemplate={navigateToForm} />
          )}
          {currentView === 'form' && selectedTemplate && (
            <FormView 
              templateId={selectedTemplate} 
              onBack={navigateToDashboard}
              aiFillData={aiFormFillData}
              clearAiFill={() => setAiFormFillData(null)}
              aiCalculateDefects={aiCalculateDefects}
              clearAiCalculate={() => setAiCalculateDefects(null)}
            />
          )}
        </section>
      </div>

      {/* Floating Bottom-Middle AI Copilot System (Only shown in FormView to avoid Dashboard redundancy) */}
      {isCopilotOpen && currentView === 'form' && (
        <div className="hud-floating-copilot-container">
          
          {/* Slide-Up Expandable History Panel */}
          {isHistoryExpanded && (
            <div className="copilot-history-expanded bento-card">
              <div className="copilot-history-header flex-between">
                <span>🤖 Kaizen Copilot Session</span>
                <button 
                  className="btn-copilot-history-close" 
                  onClick={() => setIsHistoryExpanded(false)}
                  title="Minimize History"
                >
                  ▼ Minimize
                </button>
              </div>
              
              <div className="copilot-chat-history">
                {chatHistory.map((msg, idx) => (
                  <div key={idx} className={`chat-node-wrapper ${msg.sender}`}>
                    {msg.thinking && (
                      <div className="chat-thinking">
                        <span className="thinking-terminal-prompt">&gt;_ </span>
                        {msg.thinking}
                      </div>
                    )}
                    <div className={`chat-bubble ${msg.sender}`}>
                      <p style={{ margin: 0, color: 'inherit', fontSize: '0.85rem' }}>{msg.text}</p>
                      <span className="chat-timestamp">{msg.timestamp}</span>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            </div>
          )}

          {/* Floating Pill/Capsule Input Bar */}
          <div className="copilot-floating-pill">
            <button 
              className={`btn-copilot-expand ${isHistoryExpanded ? 'active' : ''}`}
              onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
              title={isHistoryExpanded ? "Collapse History" : "Expand History"}
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              History
            </button>

            <input 
              type="text" 
              className="form-input" 
              style={{ border: 'none', background: 'transparent', fontSize: '0.85rem', padding: '0.5rem 0.75rem' }}
              placeholder={isListening ? "Listening to voice..." : "Ask Kaizen..."}
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
              disabled={isListening}
            />
            
            <button 
              className={`btn-copilot-mic ${isListening ? 'listening-pulse' : ''}`}
              onClick={toggleListening}
              title="Speech Voice Command"
              style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', color: isListening ? '#EF4444' : 'var(--royal-blue)' }}
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
              className="btn-electric" 
              style={{ width: '40px', height: '40px', borderRadius: '50%', padding: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
              onClick={() => handleSendMessage()}
              disabled={isListening}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

        </div>
      )}
    </main>
  );
}

export default App;
