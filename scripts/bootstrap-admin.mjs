#!/usr/bin/env node
/**
 * scripts/bootstrap-admin.mjs
 *
 * ONE-TIME SETUP: Writes your UID to the Firestore `admins` collection so
 * the admin dashboard knows you are the administrator.
 *
 * Prerequisites:
 *   1. Download a service account key from Firebase Console:
 *      Project Settings → Service Accounts → Generate new private key
 *   2. Save the JSON as:  scripts/service-account.json
 *   3. Run:  node scripts/bootstrap-admin.mjs
 *
 * The script will:
 *   - Find your UID by email (michswo@gmail.com)
 *   - Write admins/{uid} to Firestore database "biogrid"
 *   - Backfill userIndex/{uid} for any existing users who haven't re-saved their profile
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ADMIN_EMAIL   = 'michswo@gmail.com';
const DATABASE_ID   = 'biogrid';
const PROJECT_ID    = 'biogrid-app';

// ── Load service account ──────────────────────────────────────────────────────
const saPath = resolve(__dirname, 'service-account.json');
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(saPath, 'utf-8'));
} catch {
  console.error('❌  Could not read scripts/service-account.json');
  console.error('    Download it from Firebase Console → Project Settings → Service Accounts');
  process.exit(1);
}

// ── Initialise ────────────────────────────────────────────────────────────────
initializeApp({ credential: cert(serviceAccount), projectId: PROJECT_ID });
const auth = getAuth();
const db   = getFirestore(DATABASE_ID);

async function run() {
  // 1. Resolve admin UID
  console.log(`\n🔍  Looking up UID for ${ADMIN_EMAIL}…`);
  let adminUid;
  try {
    const userRecord = await auth.getUserByEmail(ADMIN_EMAIL);
    adminUid = userRecord.uid;
    console.log(`✅  Found UID: ${adminUid}`);
  } catch (e) {
    console.error(`❌  Could not find Firebase user with email ${ADMIN_EMAIL}`);
    console.error('    Make sure the account exists in Firebase Authentication.');
    process.exit(1);
  }

  // 2. Write admins/{uid}
  console.log('\n🔐  Writing admin document…');
  await db.collection('admins').doc(adminUid).set({
    email:     ADMIN_EMAIL,
    uid:       adminUid,
    grantedAt: Date.now(),
  });
  console.log(`✅  admins/${adminUid} created`);

  // 3. Backfill userIndex for all existing users
  console.log('\n📋  Backfilling userIndex for existing users…');
  const usersSnap = await db.collection('users').listDocuments();
  let indexed = 0;
  for (const userDocRef of usersSnap) {
    const uid = userDocRef.id;
    try {
      // Try to read the profile
      const profileSnap = await db.collection('users').doc(uid)
        .collection('profile').doc('data').get();

      if (!profileSnap.exists) {
        // Try alternate path (some older accounts)
        const altSnap = await db.doc(`users/${uid}/profile`).get();
        if (!altSnap.exists) continue;
      }

      const profile = profileSnap.exists ? profileSnap.data() : {};

      // Get email from Auth
      let email = '';
      try {
        const userRecord = await auth.getUser(uid);
        email = userRecord.email ?? '';
      } catch { /* user may have been deleted */ }

      await db.collection('userIndex').doc(uid).set({
        uid,
        email,
        firstName:  profile?.firstName  ?? '',
        lastName:   profile?.lastName   ?? '',
        company:    profile?.company    ?? '',
        role:       profile?.role       ?? '',
        createdAt:  profile?.createdAt  ?? Date.now(),
        updatedAt:  profile?.updatedAt  ?? Date.now(),
      }, { merge: true });

      indexed++;
      process.stdout.write(`  Indexed ${indexed} users…\r`);
    } catch (e) {
      console.warn(`  ⚠️  Could not index user ${uid}: ${e.message}`);
    }
  }

  console.log(`\n✅  Indexed ${indexed} existing users into userIndex`);
  console.log('\n🎉  Admin bootstrap complete!');
  console.log('    Sign in as michswo@gmail.com → the Admin Dashboard will appear in the sidebar.');
  process.exit(0);
}

run().catch(e => {
  console.error('❌  Unexpected error:', e);
  process.exit(1);
});
