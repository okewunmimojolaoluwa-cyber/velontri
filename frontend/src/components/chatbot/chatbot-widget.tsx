'use client';

import { useState } from 'react';
import { X } from '@phosphor-icons/react';

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
 * - Clear welcome message so users know it's a chatbot
 * - Open/close functionality
 */
export function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);

  // The existing deployed chatbot URL - DO NOT CHANGE
  const CHATBOT_URL = 'https://velo.pxxlspace.cv';

  return (
    <>
      {/* Floating chat panel - only visible when open */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 z-[9999] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          {/* Iframe container - loads the existing chatbot directly without header */}
          <div className="w-[380px] h-[480px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-240px)] sm:w-[380px] sm:h-[480px]">
            <iframe
              src={CHATBOT_URL}
              className="w-full h-full border-0"
              title="Velontri AI Chatbot"
              allow="clipboard-write"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
              loading="lazy"
            />
          </div>
        </div>
      )}

      {/* Floating launcher button - smaller circle with subtle breathing animation */}
      <button
        onClick={() => setIsOpen(!isOpen)}
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
