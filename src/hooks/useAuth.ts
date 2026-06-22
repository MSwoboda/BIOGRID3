// src/hooks/useAuth.ts
import { useEffect, useState, useRef, useCallback } from 'react';
import {
  User, onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser,
  signOut as fbSignOut,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { loadUserProfile, saveUserProfile, UserProfile, recordLoginHistory } from '../lib/firestore';

export type { UserProfile };

export interface AuthState {
  user: User | null;
  loading: boolean;
  authError: string | null;
  profile: UserProfile | null;
  profileLoading: boolean;
  needsOnboarding: boolean;
  /** Sign in with Google popup */
  signIn: () => Promise<void>;
  /** Sign in with email + password */
  signInWithEmail: (email: string, password: string) => Promise<void>;
  /** Create account with email + password */
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  /** Send password reset email */
  resetPassword: (email: string) => Promise<void>;
  /** Change password (email accounts only) */
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  /** Delete the account permanently */
  deleteAccount: (currentPassword?: string) => Promise<void>;
  /** Save / update user profile in Firestore */
  saveProfile: (profile: UserProfile) => Promise<void>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
}

function friendlyError(code: string): string {
  switch (code) {
    case 'auth/unauthorized-domain':
      return 'Domain not authorized. Add your domain in Firebase Console → Authentication → Settings → Authorized Domains.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled. Please contact support.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return ''; // silent
    case 'auth/popup-blocked':
      return 'Popup was blocked by your browser. Allow popups for this site and try again.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password. Please try again.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in instead.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please wait a few minutes and try again.';
    case 'auth/requires-recent-login':
      return 'Please sign out and sign back in before making this change.';
    default:
      return code ? `Error (${code}). Please try again.` : 'An unexpected error occurred.';
  }
}

export function useAuth(): AuthState {
  const [user,           setUser]           = useState<User | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [authError,      setAuthError]      = useState<string | null>(null);
  const [profile,        setProfile]        = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);

  // Load profile whenever user changes
  useEffect(() => {
    if (!user) {
      setProfile(null);
      setNeedsOnboarding(false);
      return;
    }
    setProfileLoading(true);
    loadUserProfile(user.uid)
      .then(async p => {
        if (p?.paused) {
          await fbSignOut(auth);
          setUser(null);
          setProfile(null);
          setNeedsOnboarding(false);
          setAuthError('Your account has been suspended by an administrator. Please contact support.');
          return;
        }
        setProfile(p);
        setNeedsOnboarding(!p);

        // Record login once per session
        if (p) {
          const sessionKey = `biogrid_login_${user.uid}_${p.updatedAt || 0}`;
          if (!sessionStorage.getItem(sessionKey)) {
            sessionStorage.setItem(sessionKey, '1');
            recordLoginHistory(user.uid).catch(console.error);
          }
        }
      })
      .catch(() => setNeedsOnboarding(false))
      .finally(() => setProfileLoading(false));
  }, [user?.uid]);

  useEffect(() => {
    if (unsubRef.current) return;
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u);
      setLoading(false);
    });
    unsubRef.current = unsub;
    return () => { unsub(); unsubRef.current = null; };
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const signIn = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
      const msg = friendlyError(e?.code ?? '');
      if (msg) setAuthError(msg);
    }
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e: any) {
      setAuthError(friendlyError(e?.code ?? ''));
    }
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      // needsOnboarding will be set to true by the profile load effect
    } catch (e: any) {
      setAuthError(friendlyError(e?.code ?? ''));
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    setAuthError(null);
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (e: any) {
      setAuthError(friendlyError(e?.code ?? ''));
      throw e;
    }
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    if (!auth.currentUser || !auth.currentUser.email) throw new Error('Not signed in');
    const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
    await reauthenticateWithCredential(auth.currentUser, credential);
    await updatePassword(auth.currentUser, newPassword);
  }, []);

  const deleteAccount = useCallback(async (currentPassword?: string) => {
    if (!auth.currentUser) throw new Error('Not signed in');
    if (currentPassword && auth.currentUser.email) {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
    }
    await deleteUser(auth.currentUser);
  }, []);

  const saveProfile = useCallback(async (p: UserProfile) => {
    if (!user) throw new Error('Not signed in');
    await saveUserProfile(user.uid, p, user.email ?? undefined);
    setProfile(p);
    setNeedsOnboarding(false);
  }, [user]);

  const signOut = useCallback(async () => {
    setAuthError(null);
    await fbSignOut(auth);
  }, []);

  return {
    user, loading, authError, profile, profileLoading, needsOnboarding,
    signIn, signInWithEmail, signUpWithEmail, resetPassword, changePassword, deleteAccount,
    saveProfile, signOut, clearAuthError,
  };
}
