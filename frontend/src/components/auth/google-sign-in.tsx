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
 initCodeClient: (config: object) => { requestCode: () => void };
 };
 };
 };
 __velontri_google_callback?: (idToken: string) => void;
 }
}

const CLIENT_ID =
 process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
 '99339393476-c77uoti2pa2thldagm4fkrmslhg1ggnr.apps.googleusercontent.com';

/**
 * Opens a Google OAuth2 popup and returns an id_token via postMessage.
 * This approach works regardless of GIS script issues and is not affected
 * by domain restrictions on renderButton.
 */
function openGoogleOAuthPopup(
 onSuccess: (idToken: string) => void,
 onError: (msg: string) => void,
) {
 const nonce = Math.random().toString(36).slice(2);
 const redirectUri = `${window.location.origin}/auth/google/callback`;

 const params = new URLSearchParams({
 client_id: CLIENT_ID,
 redirect_uri: redirectUri,
 response_type: 'id_token',
 scope: 'openid email profile',
 nonce,
 prompt: 'select_account',
 });

 const url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
 const width = 500;
 const height = 600;
 const left = window.screenX + (window.outerWidth - width) / 2;
 const top = window.screenY + (window.outerHeight - height) / 2;

 const popup = window.open(
 url,
 'google-oauth',
 `width=${width},height=${height},left=${left},top=${top},toolbar=0,menubar=0,location=0`,
 );

 if (!popup) {
 onError('Popup was blocked. Please allow popups for this site and try again.');
 return;
 }

  // Listen for the callback page to post back the id_token
 function handleMessage(event: MessageEvent) {
 if (event.origin !== window.location.origin) return;
 if (event.data?.type !== 'GOOGLE_OAUTH_SUCCESS') return;
 window.removeEventListener('message', handleMessage);
 if (event.data.idToken) {
 onSuccess(event.data.idToken);
 } else {
 onError('Google sign-in failed. Please try again.');
 }
 }

 window.addEventListener('message', handleMessage);

  // Poll for popup closed without response
 const timer = setInterval(() => {
 if (popup.closed) {
 clearInterval(timer);
 window.removeEventListener('message', handleMessage);
 }
 }, 500);
}

/**
 * GoogleSignInButton
 *
 * Strategy:
 * 1. Try GIS renderButton (Google's official button iframe)
 * 2. If GIS fails (script blocked, domain not authorized, etc.) fall back to
 *    our own styled button that opens a popup OAuth flow
 */
export function GoogleSignInButton({
 onSuccess,
 onError,
 label = 'Continue with Google',
 disabled = false,
}: GoogleSignInProps) {
 const containerRef = useRef<HTMLDivElement>(null);
 const [gisLoaded, setGisLoaded] = useState(false);
 const [gisReady, setGisReady] = useState(false);
 const [useFallback, setUseFallback] = useState(false);
 const [popupLoading, setPopupLoading] = useState(false);

 const initGis = useCallback(() => {
 if (!window.google?.accounts?.id || !containerRef.current) return;

 try {
 window.google.accounts.id.initialize({
 client_id: CLIENT_ID,
 callback: (response: { credential?: string }) => {
 if (response?.credential) {
 onSuccess(response.credential);
 } else {
 onError?.('Google sign-in was cancelled.');
 }
 },
 auto_select: false,
 cancel_on_tap_outside: true,
 use_fedcm_for_prompt: false,
 });

 const width = containerRef.current.offsetWidth || 400;

 window.google.accounts.id.renderButton(containerRef.current, {
 type: 'standard',
 shape: 'rectangular',
 theme: 'outline',
 text: 'continue_with',
 size: 'large',
 logo_alignment: 'left',
 width: Math.min(width, 480),
 });

 setGisReady(true);
 } catch {
      // GIS button failed (most likely domain not in authorized origins)
 setUseFallback(true);
 }
 }, [onSuccess, onError]);

 useEffect(() => {
 if (!CLIENT_ID) {
 setUseFallback(true);
 return;
 }

 if (window.google?.accounts) {
 setGisLoaded(true);
 initGis();
 return;
 }

 const existing = document.getElementById('google-gsi-script');
 if (existing) {
 existing.addEventListener('load', () => { setGisLoaded(true); initGis(); });
 return;
 }

 const script = document.createElement('script');
 script.id = 'google-gsi-script';
 script.src = 'https://accounts.google.com/gsi/client';
 script.async = true;
 script.defer = true;
 script.onload = () => { setGisLoaded(true); initGis(); };
 script.onerror = () => { setUseFallback(true); };
 document.head.appendChild(script);

    // If GIS doesn't render a button within 3s, fall back to popup
 const timeout = setTimeout(() => {
 if (!gisReady) setUseFallback(true);
 }, 3000);

 return () => {
 clearTimeout(timeout);
 script.removeEventListener('load', initGis);
 };
 }, [initGis, gisReady]);

 function handlePopupClick() {
 if (disabled || popupLoading) return;
 setPopupLoading(true);
 openGoogleOAuthPopup(
 (idToken) => {
 setPopupLoading(false);
 onSuccess(idToken);
 },
 (msg) => {
 setPopupLoading(false);
 onError?.(msg);
 },
 );
 }

  // Fallback: our own styled button using popup OAuth
 if (useFallback) {
 return (
 <button
 type="button"
 onClick={handlePopupClick}
 disabled={disabled || popupLoading}
 className="w-full flex items-center justify-center gap-3 h-12 rounded-xl
 border border-slate-200 bg-white text-slate-700 text-[14px] font-medium
 hover:bg-slate-50 hover:border-slate-300 active:scale-[0.99]
 transition-all disabled:opacity-50 disabled:cursor-not-allowed select-none shadow-sm"
 >
 {popupLoading ? (
 <svg className="h-4 w-4 animate-spin text-slate-400" viewBox="0 0 24 24" fill="none">
 <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"
 strokeDasharray="32" strokeDashoffset="12" strokeLinecap="round" />
 </svg>
 ) : (
 <GoogleIcon />
 )}
 {popupLoading ? 'Opening Google…' : label}
 </button>
 );
 }

  // GIS button (Google renders its official button in the div)
 return (
 <div className="relative w-full">
      {/* Loading skeleton shown until GIS renders */}
 {!gisReady && (
 <button
 type="button"
 disabled
 className="w-full flex items-center justify-center gap-3 h-12 rounded-xl
 border border-slate-200 bg-white text-slate-700 text-[14px] font-medium
 opacity-70 cursor-wait select-none shadow-sm"
 >
 <GoogleIcon />
 {label}
 </button>
 )}
      {/* GIS renders its button here */}
 <div
 ref={containerRef}
 className={gisReady ? 'block w-full' : 'invisible absolute inset-0 pointer-events-none'}
 style={{ minHeight: 44 }}
 />
 </div>
 );
}

function GoogleIcon({ className = '' }: { className?: string }) {
 return (
 <svg width="18" height="18" viewBox="0 0 48 48" className={`flex-shrink-0 ${className}`}>
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
 <div className="flex-1 border-t border-slate-200" />
 <span className="text-[12px] font-medium text-slate-400 uppercase tracking-wider">
 {label}
 </span>
 <div className="flex-1 border-t border-slate-200" />
 </div>
 );
}
