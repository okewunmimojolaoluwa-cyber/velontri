'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface GoogleSignInProps {
  onSuccess: (idToken: string) => void;
  onError?: (msg: string) => void;
  label?: string;
  disabled?: boolean;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: object) => void;
          renderButton: (element: HTMLElement, config: object) => void;
          prompt: (notification?: (n: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => void) => void;
          cancel: () => void;
        };
        oauth2: {
          initTokenClient: (config: object) => { requestAccessToken: () => void };
        };
      };
    };
  }
}

/**
 * GoogleSignInButton — renders the official Google Identity Services button.
 *
 * Requires NEXT_PUBLIC_GOOGLE_CLIENT_ID (set in next.config.js env fallback).
 * For production, add your domain to Google Cloud Console → APIs → Credentials
 * → OAuth 2.0 Client IDs → Authorised JavaScript origins.
 */
export function GoogleSignInButton({
  onSuccess,
  onError,
  label = 'Continue with Google',
  disabled = false,
}: GoogleSignInProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded]       = useState(false);
  const [scriptError, setScriptError] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const initButton = useCallback(() => {
    if (!window.google?.accounts?.id || !containerRef.current || !clientId) return;

    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response: { credential?: string; error?: string }) => {
          if (response?.credential) {
            onSuccess(response.credential);
          } else {
            onError?.('Google sign-in was cancelled or failed. Please try again.');
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
        use_fedcm_for_prompt: false, // avoid FedCM issues in some browsers
      });

      const width = containerRef.current.offsetWidth || 360;

      window.google.accounts.id.renderButton(containerRef.current, {
        type: 'standard',
        shape: 'rectangular',
        theme: 'outline',
        text: 'continue_with',
        size: 'large',
        logo_alignment: 'left',
        width: Math.min(width, 480),
      });

      setLoaded(true);
    } catch (err) {
      // renderButton can throw if the domain isn't on the authorized list
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('origin') || msg.includes('domain') || msg.includes('not allowed')) {
        onError?.(
          'Google sign-in is not configured for this domain. ' +
          'Please add it to the authorized origins in Google Cloud Console.',
        );
      }
      setScriptError(true);
    }
  }, [clientId, onSuccess, onError]);

  useEffect(() => {
    if (!clientId) {
      setScriptError(true);
      return;
    }

    if (window.google?.accounts) {
      initButton();
      return;
    }

    const existing = document.getElementById('google-gsi-script');
    if (existing) {
      existing.addEventListener('load', initButton);
      return () => existing.removeEventListener('load', initButton);
    }

    const script = document.createElement('script');
    script.id    = 'google-gsi-script';
    script.src   = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload  = initButton;
    script.onerror = () => setScriptError(true);
    document.head.appendChild(script);

    return () => script.removeEventListener('load', initButton);
  }, [clientId, initButton]);

  // Fallback button when GSI script failed or domain not authorized
  if (scriptError) {
    return (
      <button
        type="button"
        disabled
        className="w-full flex items-center justify-center gap-3 h-12 rounded-xl
          border border-slate-200 bg-slate-50 text-slate-400 text-[14px] font-medium
          cursor-not-allowed select-none"
        title="Google Sign-In unavailable — domain not authorized in Google Cloud Console"
      >
        <GoogleIcon className="opacity-40" />
        {label}
        <span className="ml-1 text-[11px] opacity-60">(unavailable)</span>
      </button>
    );
  }

  return (
    <div className="relative w-full">
      {/* Loading skeleton */}
      {!loaded && (
        <div className="w-full h-12 rounded-xl border border-slate-200 bg-slate-50 animate-pulse flex items-center justify-center gap-3">
          <GoogleIcon className="opacity-30" />
          <span className="text-[14px] text-slate-400">{label}</span>
        </div>
      )}
      {/* Google renders its button here */}
      <div
        ref={containerRef}
        className={`w-full ${loaded ? 'block' : 'invisible absolute inset-0'}`}
        style={{ minHeight: 44 }}
      />
    </div>
  );
}

function GoogleIcon({ className = '' }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" className={className}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      <path fill="none" d="M0 0h48v48H0z"/>
    </svg>
  );
}

/** Divider for "OR" between form and social login */
export function AuthDivider({ label = 'or' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 border-t border-slate-200 dark:border-slate-700" />
      <span className="text-[12px] font-medium text-slate-400 uppercase tracking-wider">
        {label}
      </span>
      <div className="flex-1 border-t border-slate-200 dark:border-slate-700" />
    </div>
  );
}
