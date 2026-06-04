import { useState, useEffect, useRef, useCallback } from 'react';
import { AIAgentService, AgentResponse } from '../services/ai_agent_service';

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

    const userMsg: ChatMessage = {
      sender: 'user',
      text: rawText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChatHistory(prev => [...prev, userMsg]);
    if (!textToSend) setChatInput('');

    setIsHistoryExpanded(true);

    const aiService = AIAgentService.getInstance();
    const result: AgentResponse = aiService.processCommand(rawText);

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

      if (result.action) {
        const { type, target, data } = result.action;
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
    if (isHistoryExpanded) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
