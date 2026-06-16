// src/hooks/useAuth.ts
import { useEffect, useState, useRef } from 'react';
import {
  User, onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

export interface AuthState {
  user: User | null;
  loading: boolean;
  authError: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

function friendlyError(code: string): string {
  switch (code) {
    case 'auth/unauthorized-domain':
      return 'Domain not authorized. In Firebase Console → Authentication → Settings → Authorized Domains, confirm "localhost" is listed.';
    case 'auth/operation-not-allowed':
      return 'Google Sign-In is not enabled. Go to Firebase Console → Authentication → Sign-in method → Google → Enable.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return ''; // user dismissed – silent
    case 'auth/popup-blocked':
      return 'Popup was blocked by your browser. Allow popups for localhost and try again.';
    default:
      return code ? `Sign-in error (${code}). Open the browser console for details.` : '';
  }
}

export function useAuth(): AuthState {
  const [user,      setUser]      = useState<User | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  // Guard against StrictMode double-invoke
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (unsubRef.current) return; // already subscribed
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u);
      setLoading(false);
    });
    unsubRef.current = unsub;
    return () => {
      unsub();
      unsubRef.current = null;
    };
  }, []);

  const signIn = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
      const code: string = e?.code ?? '';
      console.error('[Auth] signInWithPopup error:', code, e?.message);
      const msg = friendlyError(code);
      if (msg) setAuthError(msg);
    }
  };

  const signOut = async () => {
    setAuthError(null);
    await fbSignOut(auth);
  };

  return { user, loading, authError, signIn, signOut };
}
