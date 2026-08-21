'use client';

import { useEffect } from 'react';

/**
 * Google OAuth2 popup callback page.
 *
 * Google redirects here after the user picks an account.
 * The URL fragment contains #id_token=...
 * We extract it and postMessage back to the opener, then close.
 *
 * Redirect URI that must be registered in Google Cloud Console:
 *   https://velontri.pxxl.click/auth/google/callback
 *   http://localhost:3000/auth/google/callback  (for local dev)
 */
export default function GoogleCallbackPage() {
  useEffect(() => {
    // Parse the id_token from the URL fragment (#id_token=xxx&token_type=Bearer...)
    const hash = window.location.hash.slice(1); // remove leading '#'
    const params = new URLSearchParams(hash);
    const idToken = params.get('id_token');
    const error   = params.get('error');

    if (window.opener) {
      if (idToken) {
        window.opener.postMessage(
          { type: 'GOOGLE_OAUTH_SUCCESS', idToken },
          window.location.origin,
        );
      } else {
        window.opener.postMessage(
          { type: 'GOOGLE_OAUTH_ERROR', error: error || 'no_token' },
          window.location.origin,
        );
      }
      window.close();
    } else {
      // If not in a popup (e.g. user navigated directly), redirect to login
      window.location.href = '/login';
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center space-y-3">
        <svg className="h-8 w-8 animate-spin text-indigo-500 mx-auto" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"
            strokeDasharray="32" strokeDashoffset="12" strokeLinecap="round" />
        </svg>
        <p className="text-[14px] text-slate-500">Completing sign-in…</p>
      </div>
    </div>
  );
}
