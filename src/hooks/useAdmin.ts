// src/hooks/useAdmin.ts
// Checks whether the currently signed-in user has admin privileges.
// Security: TWO layers —
//   1. Email must match the hardcoded admin address (fast client-side guard)
//   2. Firestore must have an `admins/{uid}` document (server-enforced)
// Both must pass for isAdmin to be true.

import { useState, useEffect } from 'react';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { app } from '../lib/firebase';
import type { User } from 'firebase/auth';

const ADMIN_EMAIL = 'michswo@gmail.com';
const db = getFirestore(app, 'biogrid');

export function useAdmin(user: User | null): { isAdmin: boolean; adminLoading: boolean } {
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setAdminLoading(false);
      return;
    }

    // Layer 1: fast email check — bail immediately for non-admin email
    if (user.email !== ADMIN_EMAIL) {
      setIsAdmin(false);
      setAdminLoading(false);
      return;
    }

    // Layer 2: verify the admins/{uid} Firestore document exists
    // This document is only writable via Firebase Console / Admin SDK (rules: allow write: if false)
    setAdminLoading(true);
    getDoc(doc(db, 'admins', user.uid))
      .then(snap => {
        setIsAdmin(snap.exists() && user.email === ADMIN_EMAIL);
      })
      .catch(() => {
        setIsAdmin(false);
      })
      .finally(() => setAdminLoading(false));
  }, [user?.uid, user?.email]);

  return { isAdmin, adminLoading };
}
