import { useState, useEffect, useRef, useCallback } from 'react';
import { AIAgentService, AgentResponse } from '../services/ai_agent_service';
import { invoke } from '@tauri-apps/api/core';

export interface ChatMessage {
  sender: 'user' | 'agent';
  text: string;
  thinking?: string;
  timestamp: string;
}
export interface ChatEngineActions {
  navigateToForm: (templateId: string) => void;
  navigateToDashboard: () => void;
  setAiFormFillData: (data: Record<string, any>) => void;
  setAiCalculateDefects: (defects: number) => void;
  executeWorkflowCommand?: (command: string, data?: any) => Promise<string>;
  getCurrentView?: () => 'dashboard' | 'form';
  getActiveProjectDetails?: () => { projectId?: string; sessionId?: string };
}
export function useChatEngine(actions: ChatEngineActions) {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      sender: 'agent',
      text: "System initialized offline. I am Kaizen, your Quality Control Assistant. Speak, type, or ask me to inspect fabric to start.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const handleSendMessageRef = useRef<(text?: string) => void>(undefined);

  const handleSendMessage = useCallback((textToSend?: string) => {
    const rawText = textToSend || chatInput;
    if (!rawText.trim()) return;

    // Get current project and session details if active
    const details = actions.getActiveProjectDetails ? actions.getActiveProjectDetails() : {};
    const projectId = details.projectId || null;
    const sessionId = details.sessionId || null;

    // Log user message
    invoke('save_chat_log', {
      projectId,
      sessionId,
      sender: 'user',
      message: rawText
    }).catch(err => console.error("Failed to log user chat message:", err));

    const userMsg: ChatMessage = {
      sender: 'user',
      text: rawText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChatHistory(prev => [...prev, userMsg]);
    if (!textToSend) setChatInput('');

    setIsHistoryExpanded(true);

    const isIndo = rawText.toLowerCase().includes('buka') || rawText.toLowerCase().includes('cari') || rawText.toLowerCase().includes('unduh') || rawText.toLowerCase().includes('centang') || rawText.toLowerCase().includes('setel') || rawText.toLowerCase().includes('cacat') || rawText.toLowerCase().includes('simpan') || rawText.toLowerCase().includes('selesaikan') || rawText.toLowerCase().includes('cetak') || rawText.toLowerCase().includes('bagaimana') || rawText.toLowerCase().includes('status');
    const language = isIndo ? 'id' : 'en';

    const aiService = AIAgentService.getInstance();
    const result: AgentResponse = aiService.processCommand(rawText, actions.getCurrentView ? actions.getCurrentView() : 'dashboard');

    let reply = result.reply;
    if (reply.includes('local AI Copilot') || reply.includes('local AI')) {
      reply = reply.replace('local AI Copilot', 'Kaizen').replace('local AI', 'Kaizen');
    }

    setTimeout(() => {
      const agentMsg: ChatMessage = {
        sender: 'agent',
        text: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatHistory(prev => [...prev, agentMsg]);

      // Log agent message
      invoke('save_chat_log', {
        projectId,
        sessionId,
        sender: 'ai',
        message: reply
      }).catch(err => console.error("Failed to log agent chat message:", err));

      if (result.action) {
        const { type, target, data, command } = result.action;
        if (type === 'navigate') {
          if (target === 'dashboard') {
            actions.navigateToDashboard();
          } else if (target) {
            actions.navigateToForm(target);
          }
        } else if (type === 'fill' && data) {
          actions.setAiFormFillData(data);
        } else if (type === 'calculate' && data) {
          actions.setAiCalculateDefects(data.defects);
        } else if (type === 'workflow_cmd' && command) {
          if (actions.executeWorkflowCommand) {
            actions.executeWorkflowCommand(command, data)
              .then((resultMsg) => {
                setChatHistory(prev => [...prev, {
                  sender: 'agent',
                  text: resultMsg,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }]);

                // Log agent workflow command execution result
                invoke('save_chat_log', {
                  projectId,
                  sessionId,
                  sender: 'ai',
                  message: resultMsg
                }).catch(err => console.error("Failed to log workflow result:", err));
              })
              .catch((err) => {
                const errMsg = `Failed: ${err.message || err}`;
                setChatHistory(prev => [...prev, {
                  sender: 'agent',
                  text: errMsg,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }]);

                // Log error
                invoke('save_chat_log', {
                  projectId,
                  sessionId,
                  sender: 'ai',
                  message: errMsg
                }).catch(err => console.error("Failed to log error result:", err));
              });
          } else {
            const offlineMsg = language === 'id' 
              ? "Gagal mengeksekusi perintah: Saluran kontrol alur kerja tidak aktif. Silakan buka proyek QC terlebih dahulu."
              : "Failed to execute: The workflow control channel is currently offline. Please open an inspection project first.";
            setChatHistory(prev => [...prev, {
              sender: 'agent',
              text: offlineMsg,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);

            // Log offline error
            invoke('save_chat_log', {
              projectId,
              sessionId,
              sender: 'ai',
              message: offlineMsg
            }).catch(err => console.error("Failed to log offline warning:", err));
          }
        }
      }
    }, 600);
  }, [chatInput, actions]);

  // Keep ref updated so speech recognition callback uses latest closure
  useEffect(() => {
    handleSendMessageRef.current = handleSendMessage;
  }, [handleSendMessage]);

  useEffect(() => {
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
        handleSendMessageRef.current?.(transcript);
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
    if (isHistoryExpanded && chatEndRef.current) {
      const scrollContainer = chatEndRef.current.parentElement;
      if (scrollContainer) {
        scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
      }
    }
  }, [chatHistory, isHistoryExpanded]);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) {
      alert("Speech Recognition not supported on this platform. Please type your command.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  }, [isListening]);

  return {
    chatHistory,
    chatInput,
    setChatInput,
    isListening,
    isHistoryExpanded,
    setIsHistoryExpanded,
    chatEndRef,
    handleSendMessage,
    toggleListening,
  };
}
