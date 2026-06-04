import { useState, useEffect, useCallback, useMemo } from 'react';
import './App.css';
import Dashboard from './components/Dashboard';
import FormView from './components/FormView';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useChatEngine, ChatEngineActions } from './hooks/useChatEngine';

function App() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'form'>('dashboard');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [isTauri, setIsTauri] = useState(false);

  const [aiFormFillData, setAiFormFillData] = useState<Record<string, any> | null>(null);
  const [aiCalculateDefects, setAiCalculateDefects] = useState<number | null>(null);

  const navigateToForm = useCallback((templateId: string) => {
    setSelectedTemplate(templateId);
    setCurrentView('form');
  }, []);

  const navigateToDashboard = useCallback(() => {
    setSelectedTemplate(null);
    setCurrentView('dashboard');
    setAiFormFillData(null);
    setAiCalculateDefects(null);
  }, []);

  const chatActions: ChatEngineActions = useMemo(() => ({
    navigateToForm,
    navigateToDashboard,
    setAiFormFillData,
    setAiCalculateDefects,
  }), [navigateToForm, navigateToDashboard]);

  const chat = useChatEngine(chatActions);

  useEffect(() => {
    if (window && (window as any).__TAURI_INTERNALS__) {
      setIsTauri(true);
    }
  }, []);

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
      {/* Full-Width Workspace Layout */}
      <div className="hud-workspace-container">
        <section className="hud-full-pane">
          {currentView === 'dashboard' && (
            <Dashboard
              onSelectTemplate={navigateToForm}
              chatHistory={chat.chatHistory}
              chatInput={chat.chatInput}
              setChatInput={chat.setChatInput}
              isListening={chat.isListening}
              handleSendChat={chat.handleSendMessage}
              toggleListening={chat.toggleListening}
              chatEndRef={chat.chatEndRef}
              isTauri={isTauri}
              onMinimize={handleMinimize}
              onClose={handleClose}
            />
          )}
          {currentView === 'form' && selectedTemplate && (
            <FormView
              templateId={selectedTemplate}
              onBack={navigateToDashboard}
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
            />
          )}
        </section>
      </div>
    </main>
  );
}

export default App;
