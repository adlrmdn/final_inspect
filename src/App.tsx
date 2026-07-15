import { useState, useEffect, useMemo, useRef } from 'react';
import './App.css';
import FormView from './components/FormView';
import { InspectorProfileGate } from './components/InspectorProfileGate';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useChatEngine, ChatEngineActions } from './hooks/useChatEngine';

function App() {
  const [isTauri, setIsTauri] = useState(false);
  const [aiFormFillData, setAiFormFillData] = useState<Record<string, any> | null>(null);
  const [aiCalculateDefects, setAiCalculateDefects] = useState<number | null>(null);

  const chatRegistryRef = useRef<{
    executeWorkflowCommand?: (command: string, data?: any) => Promise<string>;
    getActiveProjectDetails?: () => { projectId?: string; sessionId?: string };
  }>({});

  const chatActions: ChatEngineActions = useMemo(() => ({
    navigateToForm: () => { /* always on the inspection workspace */ },
    navigateToDashboard: () => { /* no separate dashboard in Final Inspection QC */ },
    setAiFormFillData,
    setAiCalculateDefects,
    getCurrentView: () => 'form' as const,
    getActiveProjectDetails: () => chatRegistryRef.current.getActiveProjectDetails?.() ?? {},
    executeWorkflowCommand: async (command: string, data?: any) => {
      if (chatRegistryRef.current.executeWorkflowCommand) {
        return chatRegistryRef.current.executeWorkflowCommand(command, data);
      }
      // Wait up to 3 s for the workspace to mount and register the executor
      return new Promise<string>((resolve) => {
        let attempts = 0;
        const check = setInterval(() => {
          attempts++;
          if (chatRegistryRef.current.executeWorkflowCommand) {
            clearInterval(check);
            chatRegistryRef.current.executeWorkflowCommand(command, data)
              .then(resolve)
              .catch(err => resolve(`Failed to execute: ${err.message || err}`));
          } else if (attempts >= 30) {
            clearInterval(check);
            resolve('Timed out waiting for the inspection workspace to initialize.');
          }
        }, 100);
      });
    },
  }), []);

  const chat = useChatEngine(chatActions);

  useEffect(() => {
    if (window && (window as any).__TAURI_INTERNALS__) {
      setIsTauri(true);
    }
  }, []);

  const handleMinimize = async () => {
    if (isTauri) {
      try { await getCurrentWindow().minimize(); }
      catch (e) { console.error('Tauri window minimize failed:', e); }
    }
  };

  const handleClose = async () => {
    if (isTauri) {
      try { await getCurrentWindow().close(); }
      catch (e) { console.error('Tauri window close failed:', e); }
    }
  };

  return (
    <main className="hud-root">
      <div className="hud-workspace-container">
        <section className="hud-full-pane">
          <FormView
            templateId="pack_v0"
            aiFillData={aiFormFillData}
            clearAiFill={() => setAiFormFillData(null)}
            aiCalculateDefects={aiCalculateDefects}
            clearAiCalculate={() => setAiCalculateDefects(null)}
            chatHistory={chat.chatHistory}
            chatInput={chat.chatInput}
            setChatInput={chat.setChatInput}
            isListening={chat.isListening}
            handleSendChat={chat.handleSendMessage}
            toggleListening={chat.toggleListening}
            chatEndRef={chat.chatEndRef}
            onMinimize={handleMinimize}
            onClose={handleClose}
            chatRegistryRef={chatRegistryRef}
          />
        </section>
      </div>
      {/* Blocking device-profile gate: name + email required before the app can be used */}
      <InspectorProfileGate />
    </main>
  );
}

export default App;
