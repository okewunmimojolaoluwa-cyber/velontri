'use client';

import { useState, useEffect, useRef } from 'react';
import { X } from '@phosphor-icons/react';
import { useTheme } from '@/lib/hooks/use-theme';

/**
 * Chatbot Widget - Embeds the existing deployed chatbot
 * 
 * IMPORTANT: This component does NOT contain chatbot logic.
 * It only embeds the existing chatbot from https://velo.pxxlspace.cv
 * The chatbot frontend and backend are already deployed and maintained separately.
 * 
 * This widget provides:
 * - A floating Velontri logo launcher button
 * - An iframe that loads the existing chatbot
 * - Dark mode synchronization with website theme
 * - Open/close functionality
 */
const CHATBOT_STORAGE_KEY = 'velontri-chatbot-open';

export function ChatbotWidget() {
  const { isDark } = useTheme(); // Get theme state from Velontri's theme hook
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeKey, setIframeKey] = useState(0); // Force reload on theme change
  
  // Initialize isOpen from localStorage to persist across page refreshes
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(CHATBOT_STORAGE_KEY);
      return saved === 'true';
    }
    return false;
  });

  // Chatbot URL with current theme parameter
  const CHATBOT_URL = 'https://velo.pxxlspace.cv';
  const chatbotUrl = `${CHATBOT_URL}${isDark ? '?theme=dark' : '?theme=light'}`;

  // Send dark mode status to chatbot iframe
  const sendDarkModeToIframe = (darkMode: boolean) => {
    if (iframeRef.current?.contentWindow) {
      try {
        console.log('[Chatbot Widget] Sending dark mode to chatbot:', darkMode);
        iframeRef.current.contentWindow.postMessage({
          type: 'darkModeChange',
          isDark: darkMode
        }, '*');
      } catch (error) {
        console.error('[Chatbot Widget] Failed to send dark mode to chatbot:', error);
      }
    } else {
      console.warn('[Chatbot Widget] Iframe not ready to receive dark mode message');
    }
  };

  // Reload iframe immediately when theme changes (if chatbot is open)
  useEffect(() => {
    if (isOpen) {
      console.log('[Chatbot Widget] Theme changed to:', isDark ? 'dark' : 'light', '- Reloading iframe');
      setIframeKey(prev => prev + 1);
    }
  }, [isDark, isOpen]);

  // Persist chatbot open/close state to localStorage
  useEffect(() => {
    localStorage.setItem(CHATBOT_STORAGE_KEY, String(isOpen));
  }, [isOpen]);

  // Toggle chatbot and save state
  const toggleChatbot = () => {
    setIsOpen(prev => !prev);
  };

  // Handle messages from chatbot iframe
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      // Handle navigation requests from chatbot
      if (e.data?.type === 'navigate' && e.data?.url) {
        window.location.href = e.data.url;
      }
      // Handle dark mode requests from chatbot
      if (e.data?.type === 'requestDarkMode') {
        sendDarkModeToIframe(isDark);
      }
    };
    
    window.addEventListener('message', handleMessage);
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [isDark]);

  // Send initial dark mode status when iframe loads
  const handleIframeLoad = () => {
    console.log('[Chatbot Widget] Iframe loaded with theme:', isDark ? 'dark' : 'light');
    // Send multiple times with delays to ensure chatbot receives it
    setTimeout(() => sendDarkModeToIframe(isDark), 100);
    setTimeout(() => sendDarkModeToIframe(isDark), 500);
    setTimeout(() => sendDarkModeToIframe(isDark), 1000);
  };

  return (
    <>
      {/* Floating chat panel - only visible when open */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 z-[9999] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          {/* Iframe container - loads the existing chatbot directly without header */}
          <div className="w-[380px] h-[480px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-240px)] sm:w-[380px] sm:h-[480px]">
            <iframe
              key={iframeKey}
              ref={iframeRef}
              src={chatbotUrl}
              className="w-full h-full border-0"
              title="Velontri AI Chatbot"
              allow="clipboard-write"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation"
              loading="lazy"
              onLoad={handleIframeLoad}
            />
          </div>
        </div>
      )}

      {/* Floating launcher button - smaller circle with subtle breathing animation */}
      <button
        onClick={toggleChatbot}
        className="fixed bottom-4 right-4 z-[9998] w-12 h-12 rounded-full shadow-lg transition-all duration-200 hover:scale-110 active:scale-95 overflow-hidden animate-pulse-subtle"
        aria-label={isOpen ? 'Close Velontri AI Assistant' : 'Open Velontri AI Assistant'}
        aria-expanded={isOpen}
        title="Chat with Velontri AI"
        style={{ 
          position: 'fixed', 
          bottom: '16px', 
          right: '16px',
          animation: isOpen ? 'none' : 'breathe 3s ease-in-out infinite'
        }}
      >
        {isOpen ? (
          <div className="w-full h-full flex items-center justify-center bg-white dark:bg-slate-900">
            <X className="h-5 w-5 text-slate-900 dark:text-white" weight="bold" />
          </div>
        ) : (
          <div className="w-full h-full">
            {/* Velontri logo clipped to circle with breathing effect */}
            <img
              src="/logo.png"
              alt="Velontri AI Assistant"
              className="w-full h-full object-cover"
              style={{ display: 'block' }}
            />
          </div>
        )}
      </button>
      
      {/* Breathing animation keyframes */}
      <style jsx>{`
        @keyframes breathe {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
          }
          50% {
            transform: scale(1.08);
            box-shadow: 0 20px 25px -5px rgba(99, 102, 241, 0.3), 0 10px 10px -5px rgba(99, 102, 241, 0.2);
          }
        }
      `}</style>
    </>
  );
}
