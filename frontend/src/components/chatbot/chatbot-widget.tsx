'use client';

import { useState } from 'react';
import { X, Robot } from '@phosphor-icons/react';

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
          {/* Panel header with branding */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/20">
                <Robot className="h-4 w-4" weight="fill" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-[13px] leading-tight">Velontri AI Assistant</span>
                <span className="text-[10px] text-white/80 leading-tight">Powered by AI • Always here to help</span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/20 transition-colors flex-shrink-0"
              aria-label="Close chatbot"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Iframe container - loads the existing chatbot */}
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

      {/* Floating launcher button with Velontri logo - always visible */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-[9998] h-14 w-14 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center group"
        aria-label={isOpen ? 'Close Velontri AI Assistant' : 'Open Velontri AI Assistant'}
        aria-expanded={isOpen}
        title="Chat with Velontri AI"
      >
        {isOpen ? (
          <X className="h-6 w-6 text-white" weight="bold" />
        ) : (
          <>
            {/* Logo container with white background */}
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-white dark:bg-white shadow-sm">
              <img
                src="/logo.png"
                alt="Velontri"
                className="w-8 h-8 object-contain"
              />
            </div>
            {/* Pulsing indicator */}
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
          </>
        )}
      </button>
    </>
  );
}
