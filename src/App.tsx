import React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Category, SearchResult, CountResult, ManufacturerGroup, FiltersSnapshot } from './types';

import { fetchFDAData, fetchFDACounts, fetchDeviceRecalls, fetchDeviceRecallCounts, extractDeviceIdentifiers, autoGroupManufacturers, parseReport, detectQueryFieldKey, probeFallbackFields, resolveSearchFields, SEARCH_FIELD_GROUPS } from './lib/api';
import type { DeviceIdentifier } from './lib/api';


import { useStore } from './store';
import { cn, formatDate, generateId } from './lib/utils';

import { Search, FolderOpen, PieChart, List as ListIcon, Download, Bookmark, AlertTriangle, Clock, Box, Activity, Apple, Cigarette, ChevronDown, ChevronRight, History, PanelLeftClose, PanelLeft, Filter, X, ChevronLeft, Share2, Copy, Settings, LogOut, Pencil, Users, CheckCheck, Plus, Calendar, CheckCircle2, BookmarkMinus, Sparkles } from 'lucide-react';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import SavedScreen from './components/SavedScreen';
import ReportModal from './components/ReportModal';
import { exportSearchResultsToXLSX, exportSearchResultsToPDF, exportSearchResultsToDOCX } from './lib/export';
import { createShareLink, copyToClipboard } from './lib/share';
import ShareLinkDialog from './components/ShareLinkDialog';
import SplashScreen from './components/SplashScreen';
import AuthModal from './components/AuthModal';
import OnboardingFlow from './components/OnboardingFlow';
import ProfileModal from './components/ProfileModal';
import { useAuth } from './hooks/useAuth';
import AdminDashboard from './components/AdminDashboard';
import GlyphAvatar from './components/GlyphAvatar';
import AiInsightsView from './components/AiInsightsView';
import type { ChatMessage } from './components/AiInsightsView';
import { useAdmin } from './hooks/useAdmin';
import { ShieldCheck } from 'lucide-react';


// ── Toast system ─────────────────────────────────────────────────────────────
type ToastItem = { id: string; message: string; type: 'success' | 'info' | 'remove' };

function ToastContainer({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          onClick={() => onDismiss(t.id)}
          className={cn(
            'flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-semibold shadow-2xl pointer-events-auto cursor-pointer',
            'animate-in fade-in slide-in-from-bottom-2 duration-200',
            t.type === 'success' ? 'bg-emerald-950 border-emerald-700 text-emerald-200 shadow-emerald-900/40'
            : t.type === 'remove' ? 'bg-zinc-900 border-zinc-700 text-zinc-300 shadow-zinc-900/40'
            : 'bg-blue-950 border-blue-700 text-blue-200 shadow-blue-900/40'
          )}
        >
          {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {t.type === 'remove'  && <BookmarkMinus className="w-4 h-4 text-zinc-400 shrink-0" />}
          {t.type === 'info'    && <Bookmark className="w-4 h-4 text-blue-400 shrink-0" />}
          {t.message}
          <X className="w-3.5 h-3.5 opacity-40 ml-1 shrink-0" />
        </div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const show = useCallback((message: string, type: ToastItem['type'] = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(ts => [...ts, { id, message, type }]);
    setTimeout(() => setToasts(ts => ts.filter(t => t.id !== id)), 3000);
  }, []);
  const dismiss = useCallback((id: string) => setToasts(ts => ts.filter(t => t.id !== id)), []);
  return { toasts, show, dismiss };
}

// --- Subcomponents will be separated shortly, injecting them all in App.tsx for rapid iteration ---

export default function App() {
  const {
    user, loading: authLoading, authError, profile, profileLoading, needsOnboarding,
    signIn, signInWithEmail, signUpWithEmail, resetPassword, changePassword, deleteAccount,
    saveProfile, signOut, clearAuthError,
  } = useAuth();
  const store = useStore(user?.uid ?? null);
  const { toasts, show: showToast, dismiss: dismissToast } = useToast();
  const { isAdmin, adminLoading } = useAdmin(user);

  const [activeTab, setActiveTab] = useState<'search' | 'history' | 'saved' | 'admin'>('search');
  const [pendingReplay, setPendingReplay] = React.useState<import('./types').SearchHistoryItem | null>(null);
  const [searchCategory, setSearchCategory] = useState<Category>('device');
  const [isDbsOpen, setIsDbsOpen] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const handleSelectCategory = (cat: Category) => {
    setSearchCategory(cat);
    setActiveTab('search');
  };

  const isDemoMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1';

  // ── Handle ?share=ID URL parameter ─────────────────────────────────────────
  const shareHandled = useRef(false);
  useEffect(() => {
    if (!user || shareHandled.current) return;
    const params = new URLSearchParams(window.location.search);
    const shareId = params.get('share');
    if (!shareId) return;
    shareHandled.current = true;
    // Clean the URL
    const url = new URL(window.location.href);
    url.searchParams.delete('share');
    window.history.replaceState({}, '', url.toString());
    // Fetch share
    import('./lib/share').then(({ getShareDoc }) => {
      getShareDoc(shareId).then(shareDoc => {
        if (!shareDoc) { showToast('Shared link not found or expired', 'error'); return; }
        if (shareDoc.type === 'search' && shareDoc.search) {
          setSearchCategory(shareDoc.search.category);
          setActiveTab('search');
          setPendingReplay(shareDoc.search);
          showToast('Shared search loaded!', 'success');
        } else if (shareDoc.type === 'report' && shareDoc.report) {
          store.saveReport(shareDoc.report);
          setActiveTab('saved');
          showToast(`Report "${shareDoc.report.title}" saved to your library!`, 'success');
        } else if (shareDoc.type === 'folder' && shareDoc.folder) {
          const { folder, reports } = shareDoc.folder;
          // Create folder and import all reports
          const newFolder = store.addFolder(folder.name);
          for (const r of reports) {
            store.saveReport({ ...r, folderId: newFolder.id });
          }
          setActiveTab('saved');
          showToast(`Folder "${folder.name}" with ${reports.length} reports imported!`, 'success');
        }
      }).catch(() => showToast('Failed to load shared item', 'error'));
    });
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show splash for unauthenticated users or during profile fetch
  if (!isDemoMode && (authLoading || (user && profileLoading && !profile))) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 animate-pulse" />
          <p className="text-zinc-500 text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  if (!isDemoMode && !user) {
    return (
      <>
        <SplashScreen onShowAuth={() => setShowAuthModal(true)} loading={authLoading} authError={authError} />
        <AuthModal
          open={showAuthModal}
          onClose={() => { setShowAuthModal(false); clearAuthError(); }}
          onSignInGoogle={signIn}
          onSignInEmail={signInWithEmail}
          onSignUpEmail={signUpWithEmail}
          onResetPassword={resetPassword}
          authError={authError}
          clearError={clearAuthError}
        />
      </>
    );
  }

  // Post-signup onboarding wizard
  if (!isDemoMode && user && needsOnboarding && !profileLoading) {
    return (
      <OnboardingFlow
        uid={user.uid}
        email={user.email ?? ''}
        onComplete={saveProfile}
      />
    );
  }

  return (
    <>
    <div className="flex h-screen bg-zinc-950 text-zinc-50 font-sans">
      {/* Sidebar */}
      <aside className={cn("bg-zinc-950 border-r border-zinc-800 flex flex-col shadow-sm z-20 shrink-0 transition-all duration-300", isSidebarOpen ? "w-64" : "w-16 items-center")}>
        <div className={cn("p-4 border-b border-zinc-800 flex items-center justify-between tracking-tight flex-shrink-0 h-16 w-full", !isSidebarOpen && "justify-center")}>
          {isSidebarOpen && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-black font-black text-sm shadow-sm shrink-0">B</div>
              <h1 className="text-sm font-black tracking-[0.15em] text-zinc-100 uppercase">BIOGRID</h1>
            </div>
          )}
          {!isSidebarOpen && (
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-black font-black text-sm cursor-pointer shadow-sm" onClick={() => setIsSidebarOpen(true)}>B</div>
          )}
          {isSidebarOpen && (
            <button onClick={() => setIsSidebarOpen(false)} className="text-zinc-500 hover:text-zinc-400 p-1">
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>
        
        <nav className={cn("flex-1 py-4 flex flex-col gap-6 overflow-y-auto w-full", isSidebarOpen ? "px-3" : "px-2 items-center")}>
          {/* Section 1: Databases */}
          <div className="w-full">
            {isSidebarOpen && (
              <button 
                  onClick={() => setIsDbsOpen(!isDbsOpen)}
                  className="w-full flex items-center justify-between text-xs font-bold text-zinc-500 uppercase tracking-widest px-2 mb-2 hover:text-zinc-400 transition-colors"
              >
                  Databases
                  <ChevronDown className={cn("w-4 h-4 transition-transform", !isDbsOpen && "-rotate-90")} />
              </button>
            )}
            {(isDbsOpen || !isSidebarOpen) && (
                <div className="flex flex-col gap-1 w-full items-center">
                  <button onClick={() => handleSelectCategory('device')} title="Devices" className={cn("flex items-center rounded text-sm transition-all relative group", isSidebarOpen ? "px-3 py-2 w-full gap-3" : "justify-center w-10 h-10 px-0 my-1", activeTab === 'search' && searchCategory === 'device' ? "bg-zinc-900 text-zinc-100 font-semibold" : "text-zinc-400 hover:bg-zinc-950")}>
                    <Box className="w-4 h-4 shrink-0" /> {isSidebarOpen && "Devices"}
                  </button>
                  <button onClick={() => handleSelectCategory('drug')} title="Drug Products" className={cn("flex items-center rounded text-sm transition-all", isSidebarOpen ? "px-3 py-2 w-full gap-3" : "justify-center w-10 h-10 px-0 my-1", activeTab === 'search' && searchCategory === 'drug' ? "bg-zinc-900 text-zinc-100 font-semibold" : "text-zinc-400 hover:bg-zinc-950")}>
                    <Activity className="w-4 h-4 shrink-0" /> {isSidebarOpen && "Drug Products"}
                  </button>
                  <button onClick={() => handleSelectCategory('tobacco')} title="Nicotine & Tobacco" className={cn("flex items-center rounded text-sm transition-all", isSidebarOpen ? "px-3 py-2 w-full gap-3" : "justify-center w-10 h-10 px-0 my-1", activeTab === 'search' && searchCategory === 'tobacco' ? "bg-zinc-900 text-zinc-100 font-semibold" : "text-zinc-400 hover:bg-zinc-950")}>
                    <Cigarette className="w-4 h-4 shrink-0" /> {isSidebarOpen && "Nicotine"}
                  </button>
                  <button onClick={() => handleSelectCategory('food')} title="Food & Dietary" className={cn("flex items-center rounded text-sm transition-all", isSidebarOpen ? "px-3 py-2 w-full gap-3" : "justify-center w-10 h-10 px-0 my-1", activeTab === 'search' && searchCategory === 'food' ? "bg-zinc-900 text-zinc-100 font-semibold" : "text-zinc-400 hover:bg-zinc-950")}>
                    <Apple className="w-4 h-4 shrink-0" /> {isSidebarOpen && "Food & Dietary"}
                  </button>
                </div>
            )}
          </div>

          {/* Section 2: Search History */}
          <div className="w-full">
            {isSidebarOpen && <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-2 mb-2">Search History</h3>}
            <button
                onClick={() => setActiveTab('history')}
                title="History"
                className={cn(
                  "flex items-center rounded text-sm transition-all",
                  isSidebarOpen ? "px-3 py-2 w-full gap-3" : "justify-center w-10 h-10 px-0 mx-auto",
                  activeTab === 'history' ? "bg-zinc-900 text-zinc-100 font-semibold" : "text-zinc-400 hover:bg-zinc-950"
                )}
            >
                <History className="w-4 h-4 shrink-0" />
                {isSidebarOpen && "History"}
            </button>
          </div>

          {/* Section 3: Saved Reports */}
          <div className="w-full">
            {isSidebarOpen && <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-2 mb-2">My Folders</h3>}
            <button
                onClick={() => setActiveTab('saved')}
                title="Saved Reports"
                className={cn(
                  "flex items-center rounded text-sm transition-all",
                  isSidebarOpen ? "px-3 py-2 w-full gap-3" : "justify-center w-10 h-10 px-0 mx-auto",
                  activeTab === 'saved' ? "bg-zinc-900 text-zinc-100 font-semibold" : "text-zinc-400 hover:bg-zinc-950"
                )}
            >
                <FolderOpen className="w-4 h-4 shrink-0" />
                {isSidebarOpen && "Saved Reports"}
            </button>
          </div>

          {/* Section 4: Admin Portal */}
          {isAdmin && (
            <div className="w-full">
              {isSidebarOpen && <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-2 mb-2">Management</h3>}
              <button
                  onClick={() => setActiveTab('admin')}
                  title="Admin Dashboard"
                  className={cn(
                    "flex items-center rounded text-sm transition-all",
                    isSidebarOpen ? "px-3 py-2 w-full gap-3" : "justify-center w-10 h-10 px-0 mx-auto",
                    activeTab === 'admin' ? "bg-zinc-900 text-zinc-100 font-semibold border-zinc-800" : "text-zinc-400 hover:bg-zinc-950 hover:text-zinc-200"
                  )}
              >
                  <ShieldCheck className={cn("w-4 h-4 shrink-0 text-zinc-500", activeTab === 'admin' && "text-zinc-300")} />
                  {isSidebarOpen && "Admin Dashboard"}
              </button>
            </div>
          )}
        </nav>

        {/* User account section at bottom of sidebar */}
        <div className={cn(
          "border-t border-zinc-800 shrink-0 flex items-center gap-1 p-2",
          !isSidebarOpen && "flex-col justify-center"
        )}>
          {/* Profile button */}
          <button
            onClick={() => setShowProfileModal(true)}
            title="Profile settings"
            className={cn(
              "flex items-center gap-2.5 rounded-xl hover:bg-zinc-800 transition-colors group min-w-0 flex-1 p-1.5",
              !isSidebarOpen && "w-10 h-10 justify-center flex-none"
            )}
          >
            {user.photoURL ? (
              <img src={user.photoURL} alt={profile ? `${profile.firstName} ${profile.lastName}` : (user.displayName ?? 'User')}
                className="w-7 h-7 rounded-full ring-2 ring-zinc-700 shrink-0" />
            ) : (
              <GlyphAvatar seed={profile?.avatarSeed || user.uid || user.email || 'user'} size={28} className="ring-2 ring-zinc-700 shrink-0" />
            )}
            {isSidebarOpen && (
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-semibold text-zinc-300 truncate group-hover:text-white transition-colors leading-tight">
                  {profile ? `${profile.firstName} ${profile.lastName}` : (user.displayName ?? 'User')}
                </p>
                <p className="text-[10px] text-zinc-600 truncate leading-tight">{user.email}</p>
              </div>
            )}
          </button>

          {/* Logout button — always visible */}
          {confirmSignOut ? (
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] text-red-400 font-semibold whitespace-nowrap">{isSidebarOpen ? 'Sign out?' : '?'}</span>
              <button
                onClick={async () => { setConfirmSignOut(false); await signOut(); }}
                title="Yes, sign out"
                className="w-6 h-6 flex items-center justify-center rounded-lg bg-red-700 hover:bg-red-600 text-white transition-colors shrink-0"
              >
                <LogOut className="w-3 h-3" />
              </button>
              <button
                onClick={() => setConfirmSignOut(false)}
                title="Cancel"
                className="w-6 h-6 flex items-center justify-center rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setConfirmSignOut(true); setTimeout(() => setConfirmSignOut(false), 4000); }}
              title="Sign out"
              className={cn(
                "flex items-center justify-center rounded-xl transition-colors shrink-0",
                "text-zinc-500 hover:text-red-400 hover:bg-red-950/40",
                isSidebarOpen ? "w-8 h-8" : "w-10 h-10"
              )}
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="flex-1 overflow-y-auto relative">
           {/* SearchScreen always mounted — CSS hide so state/results survive tab switches */}
           <div style={{ display: activeTab === 'search' ? undefined : 'none' }}>
             <SearchScreen
               category={searchCategory}
               setCategory={setSearchCategory}
               store={store}
               pendingReplay={pendingReplay}
               clearPendingReplay={() => setPendingReplay(null)}
               showToast={showToast}
               uid={user?.uid}
             />
           </div>
           {activeTab === 'history' && <HistoryScreen store={store} onReplay={(item) => {
             setSearchCategory(item.category);
             setActiveTab('search');
             // We need to trigger replay inside SearchScreen — pass via a ref/event
             // Use a small state in App to signal a pending replay
             setPendingReplay(item);
           }} />}
           {activeTab === 'saved' && <SavedScreen store={store} uid={user?.uid} showToast={showToast} />}
           {activeTab === 'admin' && isAdmin && <AdminDashboard />}
        </div>
      </main>
     </div>
     <ToastContainer toasts={toasts} onDismiss={dismissToast} />
     {showProfileModal && user && (
       <ProfileModal
         open={showProfileModal}
         onClose={() => setShowProfileModal(false)}
         user={user}
         profile={profile}
         onSaveProfile={saveProfile}
         onChangePassword={changePassword}
         onResetPassword={resetPassword}
         onDeleteAccount={deleteAccount}
         onSignOut={async () => { setShowProfileModal(false); await signOut(); }}
       />
     )}
    </>
  );
}



// ── exportChart utility to copy/download chart as image ──────────────────────
async function exportChart({
  title,
  subtitle,
  visibleData,
  barHue,
  action,
  showToast
}: {
  title: string;
  subtitle: string;
  visibleData: { term: string; count: number }[];
  barHue: number;
  action: 'copy' | 'download';
  showToast?: (message: string, type?: 'success' | 'info' | 'remove') => void;
}) {
  try {
    const DPR       = 2;
    const BAR_H     = 26;
    const BAR_GAP   = 10;
    const LABEL_W   = 190;
    const VAL_W     = 46;
    const PAD       = { t: 64, r: 24, b: 24, l: 20 };
    const BAR_AREA  = 340;
    const maxCount  = Math.max(...visibleData.map(d => d.count), 1);

    const W = PAD.l + LABEL_W + BAR_AREA + VAL_W + PAD.r;
    const H = PAD.t + visibleData.length * (BAR_H + BAR_GAP) - BAR_GAP + PAD.b;

    const canvas = document.createElement('canvas');
    canvas.width  = W * DPR;
    canvas.height = H * DPR;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(DPR, DPR);

    // Background
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, W, H);

    // Border
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

    // Title
    ctx.font = `bold 14px system-ui,-apple-system,BlinkMacSystemFont,sans-serif`;
    ctx.fillStyle = '#fafafa';
    ctx.textAlign = 'left';
    ctx.fillText(title, PAD.l + 4, 26);

    // Subtitle
    ctx.font = '11px system-ui,-apple-system,BlinkMacSystemFont,sans-serif';
    ctx.fillStyle = '#a1a1aa';
    ctx.fillText(subtitle, PAD.l + 4, 44);

    const xBar = PAD.l + LABEL_W;

    // Draw axis line
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xBar, PAD.t - 6);
    ctx.lineTo(xBar, PAD.t + visibleData.length * (BAR_H + BAR_GAP) - BAR_GAP + 6);
    ctx.stroke();

    visibleData.forEach((item, i) => {
      const y   = PAD.t + i * (BAR_H + BAR_GAP);
      const barW = Math.max(4, (item.count / maxCount) * BAR_AREA);
      const mid  = y + BAR_H / 2 + 4;

      // Label
      ctx.font = '11px system-ui,-apple-system,BlinkMacSystemFont,sans-serif';
      ctx.fillStyle = '#d4d4d8';
      ctx.textAlign = 'right';
      const label = item.term.length > 28 ? item.term.slice(0, 27) + '…' : item.term;
      ctx.fillText(label, xBar - 10, mid);

      // Bar
      const r = Math.min(3, BAR_H / 2);
      ctx.fillStyle = `hsl(${barHue}, 70%, ${45 + (i * 2)}%)`;
      ctx.beginPath();
      ctx.moveTo(xBar, y);
      ctx.lineTo(xBar + barW - r, y);
      ctx.arcTo(xBar + barW, y, xBar + barW, y + r, r);
      ctx.arcTo(xBar + barW, y + BAR_H, xBar + barW - r, y + BAR_H, r);
      ctx.lineTo(xBar, y + BAR_H);
      ctx.closePath();
      ctx.fill();

      // Value
      ctx.font = 'bold 11px system-ui,-apple-system,BlinkMacSystemFont,sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.fillText(String(item.count), xBar + barW + 8, mid);
    });

    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'));
    if (!blob) throw new Error('canvas.toBlob returned null');

    if (action === 'copy') {
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        showToast?.('Chart copied to clipboard!', 'success');
      } else {
        throw new Error('ClipboardItem API not supported');
      }
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/[^a-z0-9]/gi, '_')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      showToast?.('Chart downloaded as PNG!', 'success');
    }
  } catch (e) {
    console.error('Export failed:', e);
    showToast?.('Failed to export chart', 'remove');
    throw e;
  }
}

// ── SimpleFilterChart — gear-filterable bar chart for Analytics tab ──────────
function SimpleFilterChart({
  title, icon, data, barHue, layout, totalReports, showToast
}: {
  title: string;
  icon: React.ReactNode;
  data: { term: string; count: number }[];
  barHue: number;
  layout: 'vertical' | 'horizontal';
  totalReports?: number;
  showToast?: (message: string, type?: 'success' | 'info' | 'remove') => void;
}) {
  const [showSettings, setShowSettings] = React.useState(false);
  const [hidden, setHidden] = React.useState<Set<string>>(new Set());
  const [limit, setLimit] = React.useState(20);
  const [copied, setCopied] = React.useState(false);
  const [downloaded, setDownloaded] = React.useState(false);
  const settingsRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!showSettings) return;
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node))
        setShowSettings(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSettings]);

  const visibleData = data.filter(d => !hidden.has(d.term)).slice(0, limit);
  const total = totalReports ?? data.reduce((acc, d) => acc + d.count, 0);

  return (
    <div className="bg-zinc-950 p-4 rounded-lg shadow-sm border border-zinc-800">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="text-sm font-bold text-zinc-100 flex-1">{title}</h3>
        
        {/* Quick limit toggle */}
        <button
          onClick={() => setLimit(prev => (prev === Infinity ? 20 : Infinity))}
          className="px-2 py-1 rounded border border-zinc-800 text-[10px] font-bold text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all"
        >
          {limit === Infinity ? 'Show Top 20' : 'Show All'}
        </button>

        {/* Copy */}
        <button
          onClick={async () => {
            setCopied(true);
            try {
              await exportChart({
                title,
                subtitle: `${limit === Infinity ? 'all' : `top ${visibleData.length}`} · ${total} reports`,
                visibleData,
                barHue,
                action: 'copy',
                showToast
              });
            } catch (e) {
              setCopied(false);
            } finally {
              setTimeout(() => setCopied(false), 2000);
            }
          }}
          title="Copy chart to clipboard"
          className={cn(
            'p-1.5 rounded-md border text-xs font-bold transition-all',
            copied
              ? 'bg-emerald-950 border-emerald-900 text-emerald-400'
              : 'border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
          )}
        >
          {copied ? '✓' : <Copy className="w-3.5 h-3.5" />}
        </button>

        {/* Download */}
        <button
          onClick={async () => {
            setDownloaded(true);
            try {
              await exportChart({
                title,
                subtitle: `${limit === Infinity ? 'all' : `top ${visibleData.length}`} · ${total} reports`,
                visibleData,
                barHue,
                action: 'download',
                showToast
              });
            } catch (e) {
              setDownloaded(false);
            } finally {
              setTimeout(() => setDownloaded(false), 2000);
            }
          }}
          title="Download chart as PNG"
          className={cn(
            'p-1.5 rounded-md border text-xs font-bold transition-all',
            downloaded
              ? 'bg-emerald-900 border-emerald-750 text-emerald-450'
              : 'border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
          )}
        >
          {downloaded ? '✓' : <Download className="w-3.5 h-3.5" />}
        </button>

        <div className="relative" ref={settingsRef}>
          <button
            onClick={() => setShowSettings(s => !s)}
            title="Chart settings"
            className={cn('p-1.5 rounded-md border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors', showSettings && 'bg-zinc-800 text-zinc-300')}
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
          {showSettings && (
            <div className="absolute right-0 top-full mt-2 z-30 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-64 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-300">Chart Settings</span>
                <button onClick={() => setShowSettings(false)} className="text-zinc-600 hover:text-zinc-400"><X className="w-3.5 h-3.5" /></button>
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Show top</p>
                <div className="flex gap-1.5 flex-wrap">
                  {[10, 20, 30].map(n => (
                    <button key={n} onClick={() => setLimit(n)}
                      className={cn('px-2.5 py-1 text-xs rounded border transition-colors',
                        limit === n ? 'bg-blue-600 border-blue-500 text-white' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500')}>
                      {n}
                    </button>
                  ))}
                  <button onClick={() => setLimit(Infinity)}
                    className={cn('px-2.5 py-1 text-xs rounded border transition-colors',
                      limit === Infinity ? 'bg-blue-600 border-blue-500 text-white' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500')}>
                    All
                  </button>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Items</p>
                  <div className="flex gap-2">
                    <button onClick={() => setHidden(new Set())} className="text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors">Select all</button>
                    <span className="text-zinc-700">·</span>
                    <button onClick={() => setHidden(new Set(data.map(d => d.term)))} className="text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors">Deselect all</button>
                  </div>
                </div>
                <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                  {data.slice(0, 50).map(({ term, count }) => {
                    const isHidden = hidden.has(term);
                    return (
                      <label key={term} className="flex items-center gap-2 cursor-pointer group">
                        <input type="checkbox" checked={!isHidden}
                          onChange={() => setHidden(prev => {
                            const next = new Set(prev);
                            if (isHidden) next.delete(term); else next.add(term);
                            return next;
                          })}
                          className="accent-blue-500 w-3.5 h-3.5 shrink-0" />
                        <span className="text-xs text-zinc-300 flex-1 truncate group-hover:text-zinc-100">{term}</span>
                        <span className="text-[10px] text-zinc-600 shrink-0">{count}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className={cn('h-64', layout === 'vertical' && 'overflow-y-auto')}>
        <div style={layout === 'vertical' && (limit === Infinity || visibleData.length > 10) ? { height: `${visibleData.length * 28 + 40}px` } : { height: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            {layout === 'vertical' ? (
              <BarChart data={visibleData} layout="vertical" margin={{ left: 10, right: 30, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#27272a" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#a1a1aa' }} />
                <YAxis dataKey="term" type="category" width={150} tick={{ fontSize: 10, fill: '#a1a1aa' }} />
                <Tooltip contentStyle={{ borderRadius: '6px', backgroundColor: '#09090b', border: '1px solid #27272a', fontSize: '12px', color: '#fafaed' }} />
                <Bar dataKey="count" radius={[0, 2, 2, 0]}>
                  {visibleData.map((_, i) => <Cell key={i} fill={`hsl(${barHue}, 82%, ${48 + i * 2}%)`} />)}
                </Bar>
              </BarChart>
            ) : (
              <BarChart data={visibleData} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                <XAxis dataKey="term" tick={{ fontSize: 10, fill: '#a1a1aa' }} />
                <YAxis tick={{ fontSize: 10, fill: '#a1a1aa' }} />
                <Tooltip contentStyle={{ borderRadius: '6px', backgroundColor: '#09090b', border: '1px solid #27272a', fontSize: '12px', color: '#fafaed' }} />
                <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                  {visibleData.map((_, i) => <Cell key={i} fill={`hsl(${barHue}, 70%, ${45 + i}%)`} />)}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ── ProblemBarChart ────────────────────────────────────────────────────────────
function ProblemBarChart({
  title, data, totalReports, barHue, dotColor, onBarClick, showToast
}: {
  title: string;
  data: { term: string; count: number }[];
  totalReports: number;
  barHue: number;
  dotColor: string;
  onBarClick?: (term: string) => void;
  showToast?: (message: string, type?: 'success' | 'info' | 'remove') => void;
}) {
  const [showSettings, setShowSettings] = React.useState(false);
  const [hidden, setHidden] = React.useState<Set<string>>(new Set());
  const [limit, setLimit] = React.useState<number>(10);
  const [copied, setCopied] = React.useState(false);
  const [downloaded, setDownloaded] = React.useState(false);
  const chartRef = React.useRef<HTMLDivElement>(null);
  const settingsRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!showSettings) return;
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node))
        setShowSettings(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSettings]);

  const visibleData = data.filter(d => !hidden.has(d.term)).slice(0, limit);

  return (
    <div className="bg-zinc-950 p-4 rounded-lg shadow-sm border border-zinc-800">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className={cn('w-2.5 h-2.5 rounded-full inline-block', dotColor)} />
        <h3 className="text-sm font-bold text-zinc-100 flex-1">{title}</h3>
        {onBarClick && <span className="text-[10px] text-zinc-600 italic">click bar to filter</span>}
        <span className="text-[10px] text-zinc-600">from {totalReports} reports</span>
        
        {/* Quick limit toggle */}
        <button
          onClick={() => setLimit(prev => (prev === Infinity ? 10 : Infinity))}
          className="px-2 py-1 rounded border border-zinc-800 text-[10px] font-bold text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all"
        >
          {limit === Infinity ? 'Show Top 10' : 'Show All'}
        </button>

        {/* Copy */}
        <button
          onClick={async () => {
            setCopied(true);
            try {
              await exportChart({
                title,
                subtitle: `${limit === Infinity ? 'all' : `top ${visibleData.length}`} · ${totalReports} reports`,
                visibleData,
                barHue,
                action: 'copy',
                showToast
              });
            } catch (e) {
              setCopied(false);
            } finally {
              setTimeout(() => setCopied(false), 2000);
            }
          }}
          title="Copy chart to clipboard"
          className={cn(
            'p-1.5 rounded-md border text-xs font-bold transition-all',
            copied
              ? 'bg-emerald-950 border-emerald-900 text-emerald-400'
              : 'border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
          )}
        >
          {copied ? '✓' : <Copy className="w-3.5 h-3.5" />}
        </button>

        {/* Download */}
        <button
          onClick={async () => {
            setDownloaded(true);
            try {
              await exportChart({
                title,
                subtitle: `${limit === Infinity ? 'all' : `top ${visibleData.length}`} · ${totalReports} reports`,
                visibleData,
                barHue,
                action: 'download',
                showToast
              });
            } catch (e) {
              setDownloaded(false);
            } finally {
              setTimeout(() => setDownloaded(false), 2000);
            }
          }}
          title="Download chart as PNG"
          className={cn(
            'p-1.5 rounded-md border text-xs font-bold transition-all',
            downloaded
              ? 'bg-emerald-900 border-emerald-700 text-emerald-300'
              : 'border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
          )}
        >
          {downloaded ? '✓' : <Download className="w-3.5 h-3.5" />}
        </button>

        {/* Gear */}
        <div className="relative" ref={settingsRef}>
          <button onClick={() => setShowSettings(s => !s)} title="Chart settings"
            className={cn('p-1.5 rounded-md border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors',
              showSettings && 'bg-zinc-800 text-zinc-300')}>
            <Settings className="w-3.5 h-3.5" />
          </button>
          {showSettings && (
            <div className="absolute right-0 top-full mt-2 z-30 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-64 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-300">Chart Settings</span>
                <button onClick={() => setShowSettings(false)} className="text-zinc-600 hover:text-zinc-400"><X className="w-3.5 h-3.5" /></button>
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Show top</p>
                <div className="flex gap-1.5 flex-wrap">
                  {([5, 10, 15, 20] as number[]).map(n => (
                    <button key={n} onClick={() => setLimit(n)}
                      className={cn('px-2.5 py-1 text-xs rounded border transition-colors',
                        limit === n ? 'bg-blue-600 border-blue-500 text-white' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500')}>
                      {n}
                    </button>
                  ))}
                  <button onClick={() => setLimit(Infinity)}
                    className={cn('px-2.5 py-1 text-xs rounded border transition-colors',
                      limit === Infinity ? 'bg-blue-600 border-blue-500 text-white' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500')}>
                    All
                  </button>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Items</p>
                  <div className="flex gap-2">
                    <button onClick={() => setHidden(new Set())} className="text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors">Select all</button>
                    <span className="text-zinc-700">·</span>
                    <button onClick={() => setHidden(new Set(data.map(d => d.term)))} className="text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors">Deselect all</button>
                  </div>
                </div>
                <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                  {data.map(({ term, count }) => {
                    const isHidden = hidden.has(term);
                    return (
                      <label key={term} className="flex items-center gap-2 cursor-pointer group">
                        <input type="checkbox" checked={!isHidden}
                          onChange={() => setHidden(prev => {
                            const next = new Set(prev);
                            if (isHidden) next.delete(term); else next.add(term);
                            return next;
                          })}
                          className="accent-blue-500 w-3.5 h-3.5 shrink-0" />
                        <span className="text-xs text-zinc-300 flex-1 truncate group-hover:text-zinc-100 leading-tight">{term}</span>
                        <span className="text-[10px] text-zinc-600 shrink-0">{count}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Chart */}
      <div className={cn('h-72 overflow-y-auto', onBarClick && 'cursor-pointer')} ref={chartRef}>
        <div style={{ height: limit === Infinity || visibleData.length > 10 ? `${visibleData.length * 28 + 40}px` : '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={visibleData} layout="vertical" margin={{ left: 10, right: 40, top: 0, bottom: 0 }}
              onClick={onBarClick ? (chartData: any) => {
                if (chartData?.activePayload?.[0]?.payload?.term)
                  onBarClick(chartData.activePayload[0].payload.term);
              } : undefined}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#27272a" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#a1a1aa' }} />
              <YAxis dataKey="term" type="category" width={170} tick={{ fontSize: 10, fill: '#a1a1aa' }} />
              <Tooltip
                contentStyle={{ borderRadius: '6px', backgroundColor: '#09090b', border: '1px solid #27272a', fontSize: '12px', color: '#fafaed' }}
                formatter={(value: any, _name: any, props: any) =>
                  onBarClick ? [`${value} reports — click to filter`, ''] : [value, '']
                }
              />
              <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                {visibleData.map((_, i) => (
                  <Cell key={i} fill={`hsl(${barHue}, 82%, ${48 + i * 2}%)`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function SearchScreen({ category, setCategory, store, pendingReplay, clearPendingReplay, showToast, uid }: {
  category: Category;
  setCategory: (c: Category) => void;
  store: ReturnType<typeof useStore>;
  pendingReplay?: import('./types').SearchHistoryItem | null;
  clearPendingReplay?: () => void;
  showToast?: (message: string, type?: 'success' | 'info' | 'remove' | 'error') => void;
  uid?: string | null;
}) {
  const [queries, setQueries] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [searchedQueries, setSearchedQueries] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [typesData, setTypesData] = useState<CountResult[]>([]);
  const [timeData, setTimeData] = useState<CountResult[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'graph' | 'recalls' | 'problems' | 'insights'>('list');
  const [recallResults, setRecallResults] = useState<any[]>([]);
  const [recallTimeData, setRecallTimeData] = useState<CountResult[]>([]);
  const [recallSearchMode, setRecallSearchMode] = useState<'query' | 'identifiers' | null>(null);
  const [deviceIdentifiers, setDeviceIdentifiers] = useState<DeviceIdentifier[]>([]);

  // AI Insights chat state — lifted here so it persists across tab switches
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  
  const { searchHistory, addSearchHistory, saveQuery, removeHistoryItem, updateHistoryItem } = store;

  // Handle pending replay from HistoryScreen
  React.useEffect(() => {
    if (!pendingReplay) return;
    const item = pendingReplay;
    clearPendingReplay?.();
    // Restore queries and filters
    const qs = item.queries?.length ? item.queries : [item.query];
    setQueries(qs);
    setInputValue('');
    // Restore the full filter snapshot if available
    if (item.filters) {
      setFilters({ ...EMPTY_FILTERS, ...item.filters });
    }
    // Fire search after state update
    setTimeout(() => handleSearch(undefined, qs), 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingReplay]);

  const [showSaveSearch, setShowSaveSearch] = React.useState(false);
  const [saveSearchLabel, setSaveSearchLabel] = React.useState('');
  const [showDatePopover, setShowDatePopover] = React.useState(false);
  const [pendingStartDate, setPendingStartDate] = React.useState('');
  const [pendingEndDate, setPendingEndDate] = React.useState('');
  const datePopoverRef = React.useRef<HTMLDivElement>(null);
  const saveSearchRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!showDatePopover) return;
    const h = (e: MouseEvent) => { if (datePopoverRef.current && !datePopoverRef.current.contains(e.target as Node)) setShowDatePopover(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showDatePopover]);

  React.useEffect(() => {
    if (!showSaveSearch) return;
    const h = (e: MouseEvent) => { if (saveSearchRef.current && !saveSearchRef.current.contains(e.target as Node)) setShowSaveSearch(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showSaveSearch]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [inputFocused, setInputFocused] = React.useState(false);

  // New controls
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  
  type FilterDim = { include: string[]; exclude: string[] };
  type FiltersState = {
    eventTypes: FilterDim;
    manufacturers: FilterDim;
    deviceNames: FilterDim;
    eventLocations: FilterDim;
    reportSources: FilterDim;
    reporterStates: FilterDim;
    sexes: FilterDim;
    patientProblems: FilterDim;
    productProblems: FilterDim;
    productCodes: FilterDim;
    searchField: string;
    startDate: string;
    endDate: string;
    limit: number | 'All';
  };
  const EMPTY_DIM: FilterDim = { include: [], exclude: [] };
  const EMPTY_FILTERS: FiltersState = {
    eventTypes: { ...EMPTY_DIM },
    manufacturers: { ...EMPTY_DIM },
    deviceNames: { ...EMPTY_DIM },
    eventLocations: { ...EMPTY_DIM },
    reportSources: { ...EMPTY_DIM },
    reporterStates: { ...EMPTY_DIM },
    sexes: { ...EMPTY_DIM },
    patientProblems: { ...EMPTY_DIM },
    productProblems: { ...EMPTY_DIM },
    productCodes: { ...EMPTY_DIM },
    searchField: 'auto',
    startDate: '',
    endDate: '',
    limit: 500,
  };
  const [filters, setFilters] = useState<FiltersState>(EMPTY_FILTERS);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [keywordFilter, setKeywordFilter] = useState<{ include: string[]; exclude: string[] }>({ include: [], exclude: [] });
  const [selectedReport, setSelectedReport] = useState<any>(null);
  // { query → { fieldKey, label, fallback } }
  const [queryFieldsUsed, setQueryFieldsUsed] = useState<Record<string, { fieldKey: string; label: string; fallback: boolean }>>({});

  // ── Per-category state snapshot cache ──────────────────────────────────────
  const prevCategory = React.useRef<Category>(category);
  const categoryCache = React.useRef<Partial<Record<Category, any>>>({});

  useEffect(() => {
    const prev = prevCategory.current;
    if (prev === category) return;

    // Save current state under the category we're leaving
    categoryCache.current[prev] = {
      queries, inputValue, searchedQueries, results, typesData, timeData,
      viewMode, recallResults, recallTimeData, recallSearchMode, deviceIdentifiers, hasSearched, filters,
      currentPage, queryFieldsUsed, error, chatMessages,
    };

    // Restore or reset for the category we're entering
    const saved = categoryCache.current[category];
    if (saved) {
      setQueries(saved.queries);
      setInputValue(saved.inputValue);
      setSearchedQueries(saved.searchedQueries);
      setResults(saved.results);
      setTypesData(saved.typesData);
      setTimeData(saved.timeData);
      setViewMode(saved.viewMode);
      setRecallResults(saved.recallResults);
      setRecallTimeData(saved.recallTimeData);
      setRecallSearchMode(saved.recallSearchMode ?? null);
      setDeviceIdentifiers(saved.deviceIdentifiers || []);

      setHasSearched(saved.hasSearched);
      setFilters(saved.filters);
      setCurrentPage(saved.currentPage);
      setQueryFieldsUsed(saved.queryFieldsUsed);
      setError(saved.error);
      setChatMessages(saved.chatMessages || []);
    } else {
      // Fresh slate for a category we've never visited
      setQueries([]);
      setInputValue('');
      setSearchedQueries([]);
      setResults([]);
      setTypesData([]);
      setTimeData([]);
      setViewMode('list');
      setKeywordFilter({ include: [], exclude: [] });
      setRecallResults([]);
      setRecallTimeData([]);
      setRecallSearchMode(null);
      setDeviceIdentifiers([]);

      setHasSearched(false);
      setFilters(EMPTY_FILTERS);
      setCurrentPage(1);
      setQueryFieldsUsed({});
      setError('');
      setChatMessages([]);
    }

    prevCategory.current = category;
  }, [category]); // eslint-disable-line react-hooks/exhaustive-deps

  const categories: { id: Category, label: string, icon: any }[] = [
    { id: 'drug', label: 'Drugs', icon: Activity },
    { id: 'device', label: 'Devices', icon: Box },
    { id: 'food', label: 'Foods', icon: Apple },
    { id: 'tobacco', label: 'Tobacco', icon: Cigarette },
  ];

  const suggestions = searchHistory
      .filter(h => h.category === category && inputValue && h.query.toLowerCase().includes(inputValue.toLowerCase()))
      .slice(0, 5)
      .map(h => h.query)
      .filter(s => !queries.includes(s));

  // Commit the current inputValue as a pill
  // Parse a query value to determine its modifier type
  const queryModifier = (q: string): 'include' | 'exclude' | 'search' => {
    if (q.startsWith('+')) return 'include';
    if (q.startsWith('-')) return 'exclude';
    return 'search';
  };
  const queryTerm = (q: string): string => {
    const mod = queryModifier(q);
    if (mod === 'search') return q;
    // Strip +/- prefix, then strip any semantic code prefix (e.g., "pc:", "mfr:")
    const raw = q.slice(1).trim();
    const colonIdx = raw.indexOf(':');
    if (colonIdx > 0 && colonIdx <= 5) return raw.slice(colonIdx + 1).trim();
    return raw;
  };

  /** Semantic code mapping: short prefix → FiltersState key, per category */
  type FilterDimKey = 'eventTypes' | 'manufacturers' | 'deviceNames' | 'eventLocations' |
    'reportSources' | 'reporterStates' | 'sexes' | 'patientProblems' | 'productProblems' | 'productCodes';
  type SemanticCodeDef = { dimKey: FilterDimKey; label: string; example: string };
  const SEMANTIC_CODES_BY_CATEGORY: Record<Category, Record<string, SemanticCodeDef>> = {
    device: {
      pc:  { dimKey: 'productCodes',    label: 'Product Code',    example: 'LYU' },
      mfr: { dimKey: 'manufacturers',   label: 'Manufacturer',    example: 'Medtronic' },
      ev:  { dimKey: 'eventTypes',      label: 'Event Type',      example: 'Malfunction' },
      dev: { dimKey: 'deviceNames',     label: 'Device Name',     example: 'Pump' },
      loc: { dimKey: 'eventLocations',  label: 'Location',        example: 'US' },
      src: { dimKey: 'reportSources',   label: 'Report Source',   example: 'Manufacturer' },
      sex: { dimKey: 'sexes',           label: 'Sex',             example: 'Female' },
      pp:  { dimKey: 'patientProblems', label: 'Patient Problem', example: 'Death' },
      dp:  { dimKey: 'productProblems', label: 'Device Problem',  example: 'Failure' },
    },
    drug: {
      drug: { dimKey: 'deviceNames',     label: 'Drug Name',           example: 'Metformin' },
      mfr:  { dimKey: 'manufacturers',   label: 'Manufacturer',        example: 'Pfizer' },
      rx:   { dimKey: 'patientProblems', label: 'Reaction',            example: 'Nausea' },
      ev:   { dimKey: 'eventTypes',      label: 'Event Type',          example: 'Hospitalization' },
      ind:  { dimKey: 'productProblems', label: 'Indication',          example: 'Pain' },
      loc:  { dimKey: 'eventLocations',  label: 'Country',             example: 'US' },
      src:  { dimKey: 'reportSources',   label: 'Reporter',            example: 'Physician' },
      sex:  { dimKey: 'sexes',           label: 'Sex',                 example: 'Male' },
      ser:  { dimKey: 'reporterStates',  label: 'Seriousness',         example: 'Serious' },
    },
    food: {
      prod: { dimKey: 'deviceNames',     label: 'Product Name',   example: 'Protein Bar' },
      ind:  { dimKey: 'manufacturers',   label: 'Industry',        example: 'Dietary Supplements' },
      rx:   { dimKey: 'patientProblems', label: 'Reaction',        example: 'Diarrhea' },
      out:  { dimKey: 'productProblems', label: 'Outcome',         example: 'Hospitalization' },
      sex:  { dimKey: 'sexes',           label: 'Sex',             example: 'Female' },
    },
    tobacco: {
      prod: { dimKey: 'deviceNames',     label: 'Product Type',     example: 'Cigarettes' },
      hp:   { dimKey: 'productProblems', label: 'Health Problem',   example: 'Coughing' },
      nu:   { dimKey: 'reporterStates',  label: 'Non-user Affected', example: 'Yes' },
    },
  };
  const SEMANTIC_CODES = SEMANTIC_CODES_BY_CATEGORY[category];

  /** Parse a +/- query for a semantic code prefix. Returns { code, dimKey, value } or null. */
  const parseSemanticCode = (q: string): { code: string; dimKey: FilterDimKey; value: string; mode: 'include' | 'exclude' } | null => {
    const mod = queryModifier(q);
    if (mod === 'search') return null;
    const raw = q.slice(1).trim();
    const colonIdx = raw.indexOf(':');
    if (colonIdx <= 0 || colonIdx > 5) return null;
    const code = raw.slice(0, colonIdx).toLowerCase();
    let value = raw.slice(colonIdx + 1).trim();
    const mapping = SEMANTIC_CODES[code];
    if (!mapping || !value) return null;
    // Auto-capitalize product codes (all FDA product codes are uppercase)
    if (code === 'pc') value = value.toUpperCase();
    return { code, dimKey: mapping.dimKey, value, mode: mod };
  };

  const commitInput = (): string[] => {
    const val = inputValue.trim();
    if (!val || queries.includes(val)) return queries;
    const next = [...queries, val];
    setQueries(next);
    setInputValue('');
    return next;
  };

  const removeQuery = (idx: number) => setQueries(q => q.filter((_, i) => i !== idx));

  const handleSearch = async (e?: React.FormEvent, fromQueries?: string[]) => {
    if (e) e.preventDefault();
    // Commit any pending input before searching
    const effectiveQueries = fromQueries ?? (() => {
      const val = inputValue.trim();
      if (val && !queries.includes(val)) {
        const next = [...queries, val];
        setQueries(next);
        setInputValue('');
        return next;
      }
      return queries;
    })();

    if (effectiveQueries.length === 0) return;

    // Separate: regular search queries, keyword modifiers, and semantic filter codes
    const searchQueries = effectiveQueries.filter(q => queryModifier(q) === 'search');
    const semanticFilters = effectiveQueries.map(q => parseSemanticCode(q)).filter(Boolean) as NonNullable<ReturnType<typeof parseSemanticCode>>[];
    const plainModifiers = effectiveQueries.filter(q => queryModifier(q) !== 'search' && !parseSemanticCode(q));
    const includeModifiers = plainModifiers.filter(q => queryModifier(q) === 'include').map(q => queryTerm(q)).filter(Boolean);
    const excludeModifiers = plainModifiers.filter(q => queryModifier(q) === 'exclude').map(q => queryTerm(q)).filter(Boolean);

    // Apply semantic filter codes to the correct FiltersState dimension
    if (semanticFilters.length > 0) {
      setFilters(prev => {
        const next = { ...prev };
        for (const sf of semanticFilters) {
          const dim = next[sf.dimKey] as FilterDim;
          if (sf.mode === 'include' && !dim.include.includes(sf.value)) {
            next[sf.dimKey] = { ...dim, include: [...dim.include, sf.value] };
          } else if (sf.mode === 'exclude' && !dim.exclude.includes(sf.value)) {
            next[sf.dimKey] = { ...dim, exclude: [...dim.exclude, sf.value] };
          }
        }
        return next;
      });
    }

    // Apply plain modifier queries as keyword filters
    if (includeModifiers.length > 0 || excludeModifiers.length > 0) {
      setKeywordFilter(prev => ({
        include: [...new Set([...prev.include, ...includeModifiers])],
        exclude: [...new Set([...prev.exclude, ...excludeModifiers])],
      }));
    }

    // If there are no actual search queries, just apply filters and return
    if (searchQueries.length === 0) {
      setSearchedQueries(effectiveQueries);
      setHasSearched(true);
      return;
    }

    setSearchedQueries(effectiveQueries);
    setQueryFieldsUsed({});
    setShowSuggestions(false);
    setLoading(true);
    setError('');
    setHasSearched(true);
    setResults([]);
    setTypesData([]);
    setTimeData([]);
    setRecallResults([]);
    setRecallTimeData([]);
    setRecallSearchMode(null);
    setDeviceIdentifiers([]);

    setCurrentPage(1);

    const primaryQuery = effectiveQueries[0];

    try {
      const seenIds = new Set<string>();
      let allResults: any[] = [];
      const limitToFetch = filters.limit === 'All' ? Infinity : (filters.limit as number);
      const perQueryLimit = Math.ceil(limitToFetch === Infinity ? Infinity : limitToFetch / (searchQueries.length || 1));

      // Save combined history item once per search (not per query term)
      addSearchHistory(category, effectiveQueries, { ...filters } as FiltersSnapshot);

      for (const q of searchQueries) {
        // --- Step 1: determine initial field group ---
        const manualField = filters.searchField !== 'auto' ? filters.searchField : null;
        let fieldKey = manualField ?? detectQueryFieldKey(category, q);
        let searchFields = resolveSearchFields(category, fieldKey);
        const fieldGroups = SEARCH_FIELD_GROUPS[category];
        const fieldLabel = fieldGroups?.[fieldKey]?.label ?? 'Auto';

        // --- Step 2: quick probe to check if fields yield results ---
        let fallbackUsed = false;
        if (!manualField) {
          const probe = await fetchFDAData(category, q, 0, 1, searchFields);
          if ((probe?.results?.length ?? 0) === 0) {
            // Try all other field groups in parallel
            const fallbackKey = await probeFallbackFields(category, q, fieldKey);
            if (fallbackKey) {
              fieldKey = fallbackKey;
              searchFields = resolveSearchFields(category, fieldKey);
              fallbackUsed = true;
            }
          }
        }

        setQueryFieldsUsed(prev => ({
          ...prev,
          [q]: { fieldKey, label: fieldGroups?.[fieldKey]?.label ?? fieldKey, fallback: fallbackUsed }
        }));

        // Fire chart fetches for primary query using resolved fields
        if (q === primaryQuery) {
          fetchFDACounts(category, q, 'types', searchFields).then(c => { if (c?.results) setTypesData(c.results.slice(0, 10)); });
          fetchFDACounts(category, q, 'time', searchFields).then(c => { if (c?.results) setTimeData(c.results); });
            // Extract device identifiers from accumulated results for recall cross-linking
            if (category === 'device') {
              // We fire recall fetches after first page results arrive so we have identifiers
              // This runs after allResults is populated from first batch
            }

        }

        // --- Step 3: paginated fetch with resolved fields ---
        let skip = 0;
        let remaining = perQueryLimit;
        while (skip < remaining) {
          const toFetch = Math.min(500, remaining - skip);
          const resData = await fetchFDAData(category, q, skip, toFetch, searchFields);
          if (resData?.results) {
            for (const item of resData.results) {
              const id = item.mdr_report_key || item.safetyreportid || item.report_number || item.report_id || JSON.stringify(item).slice(0, 64);
              if (!seenIds.has(id)) {
                seenIds.add(id);
                allResults.push(item);
              }
            }
            setResults([...allResults]);

            // After first page arrives, extract device identifiers and fire recall searches
            if (skip === 0 && category === 'device' && q === primaryQuery) {
              const ids = extractDeviceIdentifiers(allResults);
              setDeviceIdentifiers(ids);
              const mfrGrps = store.mfrGroups;

              // Strategy 1: try direct product-name search (same as MAUDE query)
              const directRecalls = await fetchDeviceRecalls([], q, 0, 100, mfrGrps);
              if (directRecalls?.results?.length) {
                setRecallResults(directRecalls.results);
                setRecallSearchMode('query');
                fetchDeviceRecallCounts([], q, 'time', mfrGrps).then(c => { if (c?.results) setRecallTimeData(c.results); });
              } else {
                // Strategy 2: tiered identifier-based search
                const idRecalls = await fetchDeviceRecalls(ids, q, 0, 100, mfrGrps);
                if (idRecalls?.results?.length) {
                  setRecallResults(idRecalls.results);
                  setRecallSearchMode('identifiers');
                  fetchDeviceRecallCounts(ids, q, 'time', mfrGrps).then(c => { if (c?.results) setRecallTimeData(c.results); });
                } else {
                  setRecallResults([]);
                  setRecallSearchMode(null);
                }
              }
            }

            if (resData.results.length < toFetch) break;
            if (skip === 0 && resData.meta?.results?.total) {
              remaining = Math.min(remaining, resData.meta.results.total);
            }
          } else { break; }
          skip += toFetch;
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching data');
    } finally {
      setLoading(false);
    }
  };

  const exportAsCSV = () => {
     if (!results.length) return;
     const parsed = results.map(r => parseReport(category, r));
     const header = ['ID', 'Title', 'Date', 'Events', 'Description'];
     const rows = parsed.map(r => [
       `"${r.id}"`, 
       `"${r.title}"`, 
       `"${r.date}"`, 
       `"${r.events.join(', ')}"`, 
       `"${r.description.replace(/"/g, '""')}"`
     ]);
     const csvContent = [header.join(','), ...rows.map(e => e.join(','))].join('\n');
     
     const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
     const url = URL.createObjectURL(blob);
     const link = document.createElement("a");
     link.setAttribute("href", url);
     link.setAttribute("download", `biogrid_${category}_${searchedQueries.join('_')}.csv`);
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
  };

  // Helper: apply a FilterDim (include/exclude) against a list of values for this record
  const applyDim = (dim: { include: string[]; exclude: string[] }, vals: string[]) => {
    if (dim.include.length > 0 && !vals.some(v => dim.include.includes(v))) return false;
    if (dim.exclude.length > 0 && vals.some(v => dim.exclude.includes(v))) return false;
    return true;
  };

  const filteredResults = results.filter(r => {
      const parsed = parseReport(category, r);
      // Events / reactions / health problems (shared across all categories via parsed.events)
      if (!applyDim(filters.eventTypes, parsed.events)) return false;
      // Category-specific dimension filters
      if (category === 'device') {
        if (!applyDim(filters.manufacturers, [r.device?.[0]?.manufacturer_d_name || ''])) return false;
        if (!applyDim(filters.deviceNames, [r.device?.[0]?.generic_name || ''])) return false;
        if (!applyDim(filters.productCodes, [r.device?.[0]?.device_report_product_code || ''])) return false;
        if (!applyDim(filters.eventLocations, [r.event_location || ''])) return false;
        if (!applyDim(filters.reportSources, [r.report_source_code || ''])) return false;
        if (!applyDim(filters.reporterStates, [r.reporter_state_code || ''])) return false;
      } else if (category === 'drug') {
        // manufacturers = drug manufacturer
        const mfrNames: string[] = (r.patient?.drug || []).flatMap((d: any) =>
          Array.isArray(d.openfda?.manufacturer_name) ? d.openfda.manufacturer_name : []
        );
        if (!applyDim(filters.manufacturers, mfrNames.length > 0 ? mfrNames : [''])) return false;
        // deviceNames = drug brand/product name
        const drugNames: string[] = (r.patient?.drug || []).map((d: any) =>
          Array.isArray(d.openfda?.brand_name) ? d.openfda.brand_name[0] : d.medicinalproduct
        ).filter(Boolean);
        if (!applyDim(filters.deviceNames, drugNames.length > 0 ? drugNames : [''])) return false;
        // eventLocations = country
        if (!applyDim(filters.eventLocations, [r.primarysourcecountry || r.occurcountry || ''])) return false;
        // reportSources = reporter qualification
        const qualMap: Record<string, string> = { '1': 'Physician', '2': 'Pharmacist', '3': 'Health Professional', '4': 'Lawyer', '5': 'Consumer' };
        const qual = qualMap[r.primarysource?.qualification] || r.primarysource?.qualification || '';
        if (!applyDim(filters.reportSources, [qual])) return false;
        // seriousness filter via eventTypes already handles — also filter by serious flag
        if (filters.reporterStates.include.length > 0) {
          // re-use reporterStates dim for serious filter ("Serious"/"Non-serious")
          const isSerious = r.serious === '1' ? 'Serious' : 'Non-serious';
          if (!applyDim(filters.reporterStates, [isSerious])) return false;
        }
      } else if (category === 'food') {
        // manufacturers = industry name
        const industries: string[] = (r.products || []).map((p: any) => p.industry_name).filter(Boolean);
        if (!applyDim(filters.manufacturers, industries.length > 0 ? industries : [''])) return false;
        // deviceNames = brand name
        const brands: string[] = (r.products || []).map((p: any) => p.name_brand).filter(Boolean);
        if (!applyDim(filters.deviceNames, brands.length > 0 ? brands : [''])) return false;
        // sex filter
        if (!applyDim(filters.sexes, [r.consumer?.gender || ''])) return false;
      } else if (category === 'tobacco') {
        // deviceNames = product types
        const tobaccoProducts: string[] = r.tobacco_products || [];
        if (!applyDim(filters.deviceNames, tobaccoProducts.length > 0 ? tobaccoProducts : [''])) return false;
        // reporterStates dim = nonuser affected filter
        if (filters.reporterStates.include.length > 0) {
          const nonuser = r.nonuser_affected === 'Yes' ? 'Yes' : 'No';
          if (!applyDim(filters.reporterStates, [nonuser])) return false;
        }
      }
      // Shared: sex filter (device and drug)
      if (category !== 'food' && category !== 'tobacco') {
        if (!applyDim(filters.sexes, [parsed.patient?.sex || ''])) return false;
      }
      // Patient & product problem filters (shared, using parsed)
      if (filters.patientProblems.include.length > 0) {
          const pp = parsed.patientProblems as string[];
          if (!filters.patientProblems.include.some((inc: string) => pp.includes(inc))) return false;
      }
      if (filters.patientProblems.exclude.length > 0) {
          const pp = parsed.patientProblems as string[];
          if (filters.patientProblems.exclude.some((exc: string) => pp.includes(exc))) return false;
      }
      if (filters.productProblems.include.length > 0) {
          const dp = parsed.deviceProblems as string[];
          if (!filters.productProblems.include.some((inc: string) => dp.includes(inc))) return false;
      }
      if (filters.productProblems.exclude.length > 0) {
          const dp = parsed.deviceProblems as string[];
          if (filters.productProblems.exclude.some((exc: string) => dp.includes(exc))) return false;
      }
      if (filters.startDate) {
          const s = filters.startDate.replace(/-/g, '');
          const d = (parsed.date as string).replace(/-/g, '');
          if (d < s) return false;
      }
      if (filters.endDate) {
          const e = filters.endDate.replace(/-/g, '');
          const d = (parsed.date as string).replace(/-/g, '');
          if (d > e) return false;
      }
      return true;
  });

  // ── Keyword filter (client-side full-text) ────────────────────────────────
  const getReportText = (r: any): string => {
    const parsed = parseReport(category, r);
    const base = [
      parsed.title,
      parsed.description,
      parsed.narrative,
      ...(parsed.events ?? []),
      ...(parsed.deviceProblems ?? []),
      ...(parsed.patientProblems ?? []),
    ];
    const extra = category === 'device' ? [
      r.device?.[0]?.manufacturer_d_name,
      r.device?.[0]?.brand_name,
      r.device?.[0]?.generic_name,
      r.device?.[0]?.model_number,
      r.device?.[0]?.lot_number,
      r.report_source_code,
      r.reporter_state_code,
      r.event_location,
      r.mdr_report_key,
    ] : category === 'drug' ? [
      r.safetyreportid,
      r.primarysourcecountry,
      r.occurcountry,
      ...(r.patient?.drug || []).flatMap((d: any) => [
        d.medicinalproduct,
        ...(Array.isArray(d.openfda?.brand_name) ? d.openfda.brand_name : []),
        ...(Array.isArray(d.openfda?.generic_name) ? d.openfda.generic_name : []),
        ...(Array.isArray(d.openfda?.manufacturer_name) ? d.openfda.manufacturer_name : []),
        d.drugindication,
        ...(Array.isArray(d.openfda?.pharm_class_epc) ? d.openfda.pharm_class_epc : []),
      ]),
    ] : category === 'food' ? [
      r.report_number,
      ...(r.products || []).flatMap((p: any) => [p.name_brand, p.industry_name]),
      ...(r.reactions || []),
      ...(r.outcomes || []),
      r.consumer?.gender,
    ] : category === 'tobacco' ? [
      String(r.report_id ?? ''),
      ...(r.tobacco_products || []),
      ...(r.reported_health_problems || []),
      r.nonuser_affected,
    ] : [];
    return [...base, ...extra].filter(Boolean).join(' ').toLowerCase();
  };

  const keywordFilteredResults = React.useMemo(() => {
    const { include, exclude } = keywordFilter;
    if (include.length === 0 && exclude.length === 0) return filteredResults;
    return filteredResults.filter(r => {
      const text = getReportText(r);
      // All include keywords must match
      if (include.length > 0 && !include.every(kw => text.includes(kw.toLowerCase()))) return false;
      // No exclude keyword may match
      if (exclude.length > 0 && exclude.some(kw => text.includes(kw.toLowerCase()))) return false;
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredResults, keywordFilter]);

  const totalPages = Math.ceil(keywordFilteredResults.length / rowsPerPage);
  const paginatedResults = keywordFilteredResults.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  // Aggregate product & patient problems from loaded results for analytics charts
  const { productProblemData, patientProblemData } = React.useMemo(() => {
    const pp: Record<string, number> = {};
    const pt: Record<string, number> = {};
    for (const r of filteredResults) {
      const parsed = parseReport(category, r);
      (parsed.deviceProblems ?? []).forEach((v: string) => { if (v) pp[v] = (pp[v] || 0) + 1; });
      (parsed.patientProblems ?? []).forEach((v: string) => { if (v) pt[v] = (pt[v] || 0) + 1; });
    }
    const toBar = (counts: Record<string, number>) =>
      Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([term, count]) => ({ term, count }));
    return { productProblemData: toBar(pp), patientProblemData: toBar(pt) };
  }, [keywordFilteredResults, category]);

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Top Search Header */}
      <div className="bg-zinc-950 border-b border-zinc-800 p-8 shadow-sm z-10 flex flex-col gap-6">
        <div className="flex items-start justify-between">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-100">Global Database Search</h2>
        </div>
        
        <div className="w-full max-w-7xl ml-auto relative">
        <form onSubmit={e => handleSearch(e)} className="flex items-center gap-2 w-full">
            {/* Multi-query pill input — grows, but never pushes icons off */}
            <div
                className="flex-1 min-w-0 relative flex items-center flex-nowrap gap-2 bg-zinc-900 border border-zinc-800 rounded-full px-4 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-zinc-700 cursor-text overflow-x-auto overflow-y-hidden scrollbar-none h-[48px]"
                onClick={() => inputRef.current?.focus()}
            >
                <Search className="w-5 h-5 text-zinc-500 shrink-0 self-center" />

                {/* Pills */}
                {queries.map((q, i) => {
                    const mod = queryModifier(q);
                    const pillClass = mod === 'include'
                      ? 'bg-emerald-950 border border-emerald-700 text-emerald-300'
                      : mod === 'exclude'
                      ? 'bg-red-950 border border-red-700 text-red-300'
                      : 'bg-zinc-700 text-zinc-100';
                    const iconClass = mod === 'include'
                      ? 'text-emerald-500 hover:text-emerald-200'
                      : mod === 'exclude'
                      ? 'text-red-500 hover:text-red-200'
                      : 'text-zinc-400 hover:text-zinc-100';
                    return (
                    <span key={i} className={`flex items-center gap-1.5 text-sm font-medium pl-3 pr-2 py-1 rounded-full shrink-0 ${pillClass}`}>
                        {mod === 'include' && <span className="text-[10px] font-bold">+</span>}
                        {mod === 'exclude' && <span className="text-[10px] font-bold">−</span>}
                        {queryTerm(q)}
                        <button
                            type="button"
                            onClick={e => { e.stopPropagation(); removeQuery(i); }}
                            className={`transition-colors ${iconClass}`}
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </span>
                    );
                })}

                {/* Text input */}
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={e => { setInputValue(e.target.value); setShowSuggestions(true); }}
                    onFocus={() => { setShowSuggestions(true); setInputFocused(true); }}
                    onBlur={() => { setTimeout(() => setShowSuggestions(false), 200); setTimeout(() => setInputFocused(false), 200); }}
                    onKeyDown={e => {
                        if ((e.key === 'Enter' || e.key === ',') && inputValue.trim()) {
                            e.preventDefault();
                            commitInput();
                        } else if (e.key === 'Backspace' && !inputValue && queries.length > 0) {
                            removeQuery(queries.length - 1);
                        }
                    }}
                    placeholder={queries.length === 0
                        ? `Search ${categories.find(c => c.id === category)?.label} by name…`
                        : 'Add another query…'}
                    className="flex-1 min-w-36 bg-transparent text-base focus:outline-none text-zinc-100 placeholder:text-zinc-500 self-center"
                />

                {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden z-20">
                        {suggestions.map((suggestion, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onMouseDown={e => {
                                    e.preventDefault();
                                    const next = queries.includes(suggestion) ? queries : [...queries, suggestion];
                                    setQueries(next);
                                    setInputValue('');
                                    handleSearch(undefined, next);
                                }}
                                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-zinc-800 transition-colors border-b border-zinc-800 last:border-b-0"
                            >
                                <History className="w-4 h-4 text-zinc-500" />
                                <span className="text-zinc-100 font-medium">{suggestion}</span>
                                <span className="ml-auto text-xs text-zinc-600">+ add query</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Right-side controls — OUTSIDE pill div so they never wrap */}
            <div className="flex items-center gap-2 shrink-0">
                    {/* Filter icon — always visible in search bar */}
                    {(() => {
                      const activeCount = [
                        filters.eventTypes, filters.manufacturers, filters.deviceNames,
                        filters.eventLocations, filters.reportSources, filters.reporterStates,
                        filters.sexes, filters.patientProblems, filters.productProblems, filters.productCodes
                      ].reduce((n, d) => n + d.include.length + d.exclude.length, 0)
                        + (filters.startDate ? 1 : 0) + (filters.endDate ? 1 : 0)
                        + (filters.searchField !== 'auto' ? 1 : 0);
                      return (
                        <button
                          type="button"
                          onClick={() => setShowFiltersModal(true)}
                          className={`relative flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                            activeCount > 0
                              ? 'bg-blue-600/20 border border-blue-500/40 text-blue-400 hover:bg-blue-600/30'
                              : 'border border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'
                          }`}
                          title="Search filters"
                        >
                          <Filter className="w-4 h-4" />
                          {activeCount > 0 && (
                            <span className="text-xs font-bold">{activeCount}</span>
                          )}
                        </button>
                      );
                    })()}
                    {(queries.length > 0 || inputValue.trim()) && (
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 bg-zinc-100 text-zinc-950 font-semibold rounded-full text-sm hover:bg-zinc-200 transition-colors disabled:opacity-50 shrink-0"
                        >
                            <Search className="w-4 h-4" />
                            {queries.length > 1 || (queries.length === 1 && inputValue.trim()) ? `Search ${queries.length + (inputValue.trim() ? 1 : 0)}` : 'Search'}
                        </button>
                    )}
            </div>
        </form>

        {/* ── Search hint tooltip — anchored to outer relative wrapper ── */}
        {inputFocused && !loading && results.length === 0 && (
          <div className="absolute left-0 top-full mt-2 z-50 pointer-events-none">
            {/* Arrow pointing up */}
            <div className="w-3 h-3 border-l border-t border-zinc-700 bg-zinc-900 rotate-45 ml-6 -mb-1.5 relative z-10" />
            <div className="bg-zinc-900/95 backdrop-blur border border-zinc-700 rounded-xl shadow-2xl px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">
              {!inputValue.trim() && queries.length === 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-zinc-500">Type a drug, device, food product or report ID to begin</span>
                  <span className="text-zinc-600 text-[10px]">Prefix with <kbd className="px-1 py-0.5 rounded border border-zinc-700 bg-zinc-800 text-emerald-400 font-mono">+</kbd> to include or <kbd className="px-1 py-0.5 rounded border border-zinc-700 bg-zinc-800 text-red-400 font-mono">-</kbd> to exclude from results</span>
                </div>
              )}
              {inputValue.trim() && queries.length === 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <kbd className="inline-flex items-center px-1.5 py-0.5 rounded border border-zinc-700 bg-zinc-800 text-zinc-200 font-mono text-[10px] leading-none">↵ Enter</kbd>
                    <span>to <strong className="text-zinc-200">confirm term</strong> as a search pill</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <kbd className="inline-flex items-center px-1.5 py-0.5 rounded border border-zinc-700 bg-zinc-800 text-zinc-200 font-mono text-[10px] leading-none">,</kbd>
                    <span>to add a <strong className="text-zinc-200">second term</strong> without confirming first</span>
                  </div>
                </div>
              )}
              {!inputValue.trim() && queries.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <kbd className="inline-flex items-center px-1.5 py-0.5 rounded border border-zinc-700 bg-zinc-800 text-zinc-200 font-mono text-[10px] leading-none">↵ Enter</kbd>
                    <span>or click <strong className="text-zinc-200">Search</strong> to run the search</span>
                  </div>
                  <div className="text-zinc-600">or keep typing to add another term</div>
                </div>
              )}
              {inputValue.trim() && queries.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <kbd className="inline-flex items-center px-1.5 py-0.5 rounded border border-zinc-700 bg-zinc-800 text-zinc-200 font-mono text-[10px] leading-none">↵ Enter</kbd>
                    <span>to <strong className="text-zinc-200">confirm term</strong> — then Enter again to search</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <kbd className="inline-flex items-center px-1.5 py-0.5 rounded border border-zinc-700 bg-zinc-800 text-zinc-200 font-mono text-[10px] leading-none">,</kbd>
                    <span>to add term <strong className="text-zinc-200">and continue typing</strong></span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Modifier hints dropdown — when typing + or - ── */}
        {inputFocused && (inputValue.startsWith('+') || inputValue.startsWith('-')) && !inputValue.includes(':') && (
          <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-zinc-900/98 backdrop-blur border border-zinc-700 rounded-xl shadow-2xl overflow-hidden max-w-md pointer-events-auto">
            <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-zinc-600">No code = keyword filter</span>
                <span className="text-[10px] text-zinc-700 mx-1.5">·</span>
                <span className="text-[10px] text-zinc-600"><kbd className="px-1 py-0.5 rounded border border-emerald-800 bg-emerald-950/50 text-emerald-400 font-mono">+</kbd> include  <kbd className="px-1 py-0.5 rounded border border-red-800 bg-red-950/50 text-red-400 font-mono">-</kbd> exclude</span>
              </div>
              <span className="text-[10px] text-zinc-600">click or type code:</span>
            </div>
            <div className="max-h-52 overflow-y-auto">
              {Object.entries(SEMANTIC_CODES).map(([code, { label, example }]) => {
                const prefix = inputValue[0]; // + or -
                return (
                  <button
                    key={code}
                    type="button"
                    onMouseDown={e => { e.preventDefault(); setInputValue(`${prefix}${code}:`); }}
                    className="w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-zinc-800 transition-colors border-b border-zinc-800/50 last:border-b-0"
                  >
                    <kbd className="px-1.5 py-0.5 rounded border border-cyan-800 bg-cyan-950/50 text-cyan-300 font-mono text-[11px] font-bold min-w-[36px] text-center">{code}:</kbd>
                    <span className="text-zinc-300 text-xs font-medium">{label}</span>
                    <span className="ml-auto text-[10px] text-zinc-600 font-mono">{prefix}{code}:{example}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        </div>

        {/* Controls Bar — shows below search when results present */}
        {(loading || results.length > 0) && (
          <div className="w-full max-w-7xl ml-auto">
               {/* Controls Bar */}
               {/* Controls Bar — compact single row */}
               <div className="flex items-center gap-2 bg-zinc-950 px-3 py-2 rounded-lg shadow-sm border border-zinc-800">

                  {/* LEFT: count + pills — shrinks gracefully */}
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden text-xs">
                     {loading && <div className="w-3 h-3 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin shrink-0"></div>}
                     <span className="font-bold text-zinc-100 shrink-0">{keywordFilteredResults.length}</span>
                     {keywordFilteredResults.length !== filteredResults.length && (
                       <span className="text-zinc-600 shrink-0">/{filteredResults.length}</span>
                     )}
                     <span className="text-zinc-500 shrink-0">for</span>

                     {/* Query pills — truncate label */}
                     {searchedQueries.map((q, i) => {
                       const qf = queryFieldsUsed[q];
                       const abbrev = qf ? qf.label.split(/[\s/]+/).map((w: string) => w[0]).join('').toUpperCase() : '';
                       const mod = queryModifier(q);
                       const sc = parseSemanticCode(q);
                       const isModifier = mod !== 'search';
                       const isInclude = mod === 'include';
                       return (
                         <span key={i} className={cn(
                           "inline-flex items-center gap-1 font-semibold rounded-full border px-2 py-0.5 shrink-0 max-w-[180px]",
                           sc ? (isInclude
                             ? 'bg-cyan-950/60 border-cyan-800 text-cyan-300'
                             : 'bg-orange-950/60 border-orange-800 text-orange-300')
                           : isModifier ? (isInclude
                             ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                             : 'bg-red-950/60 border-red-800 text-red-300')
                           : ''
                         )}
                           style={!isModifier ? { background: qf?.fallback ? 'rgba(234,179,8,0.1)' : 'rgba(63,63,70,0.6)', borderColor: qf?.fallback ? 'rgba(234,179,8,0.3)' : 'rgba(63,63,70,1)', color: qf?.fallback ? '#eab308' : '#e4e4e7' } : undefined}
                         >
                           {sc ? (
                             <>
                               <span className="text-[9px] uppercase opacity-70 shrink-0">{SEMANTIC_CODES[sc.code]?.label ?? sc.code}</span>
                               <span className="truncate">{sc.value}</span>
                             </>
                           ) : (
                             <>
                               <Search className="w-2.5 h-2.5 opacity-60 shrink-0" />
                               <span className="truncate">{q}</span>
                               {qf && <span className="opacity-50 shrink-0 ml-0.5">{abbrev}{qf.fallback ? '\u26a1' : ''}</span>}
                             </>
                           )}
                         </span>
                       );
                     })}

                     {/* Date pill — compact YYYY-MM format */}
                     {(() => {
                       let d: string;
                       const hasF = !!(filters.startDate || filters.endDate);
                       const ym = (s: string) => s.slice(0, 7);
                       if (hasF) {
                         d = filters.startDate && filters.endDate
                           ? `${ym(filters.startDate)}\u2192${ym(filters.endDate)}`
                           : filters.startDate ? `\u2265${ym(filters.startDate)}` : `\u2264${ym(filters.endDate || '')}`;
                       } else if (results.length > 0) {
                         const ds = results.map((r: any) => { const p = parseReport(category, r); return (p.date as string || ''); })
                           .filter(Boolean).map((s: string) => s.replace(/-/g,'').padEnd(8,'0')).sort();
                         d = ds.length ? `${ds[0].slice(0,4)}-${ds[0].slice(4,6)}\u2192${ds[ds.length-1].slice(0,4)}-${ds[ds.length-1].slice(4,6)}` : 'all dates';
                       } else { d = 'all dates'; }
                       return (
                         <div className="relative shrink-0" ref={datePopoverRef}>
                           <button
                             onClick={() => { setShowDatePopover(s => !s); setPendingStartDate(filters.startDate); setPendingEndDate(filters.endDate); }}
                             className={`inline-flex items-center gap-1 font-semibold rounded-full border px-2 py-0.5 transition-colors whitespace-nowrap ${hasF ? 'bg-violet-950/60 border-violet-800 text-violet-300 hover:bg-violet-900/50' : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'}`}
                           >
                             <Calendar className="w-2.5 h-2.5 opacity-80 shrink-0" />
                             {d}
                             {hasF && <span onClick={e => { e.stopPropagation(); setFilters((f: any) => ({ ...f, startDate: '', endDate: '' })); }} className="opacity-60 hover:opacity-100 cursor-pointer">&times;</span>}
                           </button>
                           {showDatePopover && (
                             <div className="absolute left-0 top-full mt-2 z-50 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-3 space-y-3 w-72">
                               <div className="flex items-center justify-between">
                                 <span className="text-xs font-bold text-zinc-300">Set Date Range</span>
                                 <button onClick={() => setShowDatePopover(false)} className="text-zinc-600 hover:text-zinc-400"><X className="w-3.5 h-3.5" /></button>
                               </div>
                               <div className="grid grid-cols-2 gap-2">
                                 <div>
                                   <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">From</label>
                                   <input type="date" value={pendingStartDate} onChange={e => setPendingStartDate(e.target.value)}
                                     className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-700 rounded-lg text-xs focus:outline-none focus:border-blue-500 text-zinc-300" />
                                 </div>
                                 <div>
                                   <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">To</label>
                                   <input type="date" value={pendingEndDate} onChange={e => setPendingEndDate(e.target.value)}
                                     className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-700 rounded-lg text-xs focus:outline-none focus:border-blue-500 text-zinc-300" />
                                 </div>
                               </div>
                               <div className="flex flex-wrap gap-1.5">
                                 {[
                                   { label: 'Last yr', from: `${new Date().getFullYear()-1}-01-01`, to: `${new Date().getFullYear()-1}-12-31` },
                                   { label: 'Last 2yr', from: `${new Date().getFullYear()-2}-01-01`, to: '' },
                                   { label: 'Last 5yr', from: `${new Date().getFullYear()-5}-01-01`, to: '' },
                                   { label: '2020-24', from: '2020-01-01', to: '2024-12-31' },
                                 ].map(p => (
                                   <button key={p.label} onClick={() => { setPendingStartDate(p.from); setPendingEndDate(p.to); }}
                                     className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors">{p.label}</button>
                                 ))}
                               </div>
                               <div className="flex gap-2">
                                 <button
                                   onClick={() => { setFilters((f: any) => ({ ...f, startDate: pendingStartDate, endDate: pendingEndDate })); setShowDatePopover(false); }}
                                   className="flex-1 py-1.5 text-xs font-semibold bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors"
                                 >Apply</button>
                                 <button
                                   onClick={() => { setFilters((f: any) => ({ ...f, startDate: pendingStartDate, endDate: pendingEndDate })); setShowDatePopover(false); handleSearch(undefined, searchedQueries); }}
                                   className="flex-1 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                                 >&circlearrowleft; Re-run</button>
                               </div>
                             </div>
                           )}
                         </div>
                       );
                     })()}

                     {/* Limit pill */}
                     <button onClick={() => setShowFiltersModal(true)}
                       className="inline-flex items-center gap-0.5 font-semibold rounded-full border px-2 py-0.5 bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors shrink-0 whitespace-nowrap"
                       title="Change result limit">
                       <span className="opacity-60">&uarr;</span>{filters.limit === 'All' ? 'All' : `${filters.limit}`}
                     </button>

                     {loading && <span className="text-zinc-600 animate-pulse shrink-0">loading&hellip;</span>}
                  </div>

                  {/* RIGHT: actions — never wrap */}
                  <div className="flex items-center gap-2 shrink-0">
                     {hasSearched && searchedQueries.length > 0 && (
                       <div className="relative" ref={saveSearchRef}>
                         <button
                           onClick={() => { setShowSaveSearch(s => !s); setSaveSearchLabel(searchedQueries.join(', ')); }}
                           className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-800 text-xs font-semibold text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-colors whitespace-nowrap"
                           title="Save this search"
                         >
                           <Bookmark className="w-3.5 h-3.5" /> Save
                         </button>
                         {showSaveSearch && (
                           <div className="absolute right-0 top-full mt-2 z-50 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-3 space-y-2 w-72">
                             <p className="text-xs font-bold text-zinc-300">Save this search</p>
                             <input
                               autoFocus
                               type="text" value={saveSearchLabel} onChange={e => setSaveSearchLabel(e.target.value)}
                               placeholder="Label for this search\u2026"
                               onKeyDown={e => {
                                 if (e.key === 'Enter' && saveSearchLabel.trim()) {
                                   const currentItem: import('./types').SearchHistoryItem = {
                                     id: '', category, query: searchedQueries.join(', '),
                                     queries: searchedQueries, timestamp: Date.now(),
                                     filters: { ...filters } as FiltersSnapshot,
                                   };
                                   saveQuery(currentItem, saveSearchLabel.trim());
                                   setShowSaveSearch(false);
                                   showToast?.(`Search "${saveSearchLabel.trim()}" saved`, 'info');
                                 }
                               }}
                               className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500"
                             />
                             <p className="text-[10px] text-zinc-600">Queries: {searchedQueries.map(q => `"${q}"`).join(', ')}</p>
                             {(filters.startDate || filters.endDate) && (
                               <p className="text-[10px] text-violet-600">\uD83D\uDCC5 {filters.startDate || '\u2026'} &rarr; {filters.endDate || '\u2026'}</p>
                             )}
                             <button
                               disabled={!saveSearchLabel.trim()}
                               onClick={() => {
                                 const currentItem: import('./types').SearchHistoryItem = {
                                   id: '', category, query: searchedQueries.join(', '),
                                   queries: searchedQueries, timestamp: Date.now(),
                                   filters: { ...filters } as FiltersSnapshot,
                                 };
                                 saveQuery(currentItem, saveSearchLabel.trim());
                                 setShowSaveSearch(false);
                               }}
                               className="w-full py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg transition-colors"
                             >
                               \uD83D\uDD16 Save to History
                             </button>
                           </div>
                         )}
                       </div>
                     )}

                     {/* Share search button */}
                     {searchedQueries.length > 0 && uid && (
                       <button
                         onClick={async () => {
                           try {
                             const searchItem: import('./types').SearchHistoryItem = {
                               id: generateId(), category, query: searchedQueries.join(', '),
                               queries: searchedQueries, timestamp: Date.now(),
                               filters: { ...filters } as FiltersSnapshot,
                             };
                             const url = await createShareLink(uid, 'search', { search: searchItem });
                             setShareUrl(url);
                           } catch (err) { console.error('Share failed:', err); showToast?.('Failed to create share link', 'info'); }
                         }}
                         className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-800 text-xs font-semibold text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-colors whitespace-nowrap"
                         title="Share this search"
                       >
                         <Share2 className="w-3.5 h-3.5" /> Share
                       </button>
                     )}
                     {viewMode === 'list' && (
                       <select value={rowsPerPage} onChange={e => {setRowsPerPage(parseInt(e.target.value)); setCurrentPage(1);}}
                         className="bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1 text-xs text-zinc-300 outline-none"
                         title="Rows per page">
                         <option value={20}>20</option>
                         <option value={50}>50</option>
                         <option value={100}>100</option>
                       </select>
                     )}

                     <div className="relative group">
                       <button className="flex items-center gap-1.5 px-2.5 py-1.5 border border-zinc-800 text-zinc-400 rounded hover:bg-zinc-900 text-xs font-semibold whitespace-nowrap">
                         <Download className="w-3.5 h-3.5" /> Export <ChevronDown className="w-3 h-3" />
                       </button>
                       <div className="absolute right-0 top-full pt-1 w-40 z-50 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all">
                         <div className="bg-zinc-900 border border-zinc-700 shadow-xl rounded-lg py-1">
                           <button onClick={exportAsCSV} className="w-full text-left px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">CSV</button>
                           <button onClick={() => exportSearchResultsToXLSX(filteredResults, category, searchedQueries)} className="w-full text-left px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">Excel (.xlsx)</button>
                           <button onClick={() => exportSearchResultsToPDF(filteredResults, category, searchedQueries)} className="w-full text-left px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">PDF</button>
                           <button onClick={() => exportSearchResultsToDOCX(filteredResults, category, searchedQueries)} className="w-full text-left px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">Word (.docx)</button>
                         </div>
                       </div>
                     </div>
                  </div>
               </div>
          </div>
        )}

      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-zinc-950 relative">
         {!hasSearched ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-4">
               <Search className="w-16 h-16 opacity-20" />
               <p className="text-lg">Select a database and enter a search query above.</p>
            </div>
         ) : loading && results.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center space-y-6">
                <div className="w-8 h-8 border-4 border-zinc-700 border-t-zinc-400 rounded-full animate-spin"></div>
                <p className="text-sm text-zinc-500 font-medium animate-pulse">Querying openFDA Databases...</p>
             </div>
         ) : error && results.length === 0 ? (
            <div className="p-6 bg-red-950 text-red-400 rounded-xl border border-red-900 flex items-start gap-4 mx-auto max-w-2xl mt-10">
               <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
               <div>
                 <h3 className="font-semibold text-lg">Search Failed</h3>
                 <p className="text-red-400/80 mt-1">{error}</p>
               </div>
            </div>
         ) : (
            <div className="max-w-7xl mx-auto space-y-6">
                {/* View Mode Tabs — full width */}
                <div className="flex bg-zinc-900/50 p-1.5 rounded-xl border border-zinc-800 shadow-sm mb-6">
                    <button onClick={() => setViewMode('list')} className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all duration-200", viewMode === 'list' ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50')}>
                        <ListIcon className="w-4 h-4" /> List
                    </button>
                    <button onClick={() => setViewMode('graph')} className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all duration-200", viewMode === 'graph' ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50')}>
                        <PieChart className="w-4 h-4" /> Analytics
                    </button>
                    <button onClick={() => setViewMode('problems')} className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all duration-200", viewMode === 'problems' ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50')}>
                        <Share2 className="w-4 h-4" /> Problems
                    </button>
                    {category === 'device' && (
                        <button onClick={() => setViewMode('recalls')} className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all duration-200", viewMode === 'recalls' ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50')}>
                            <AlertTriangle className="w-4 h-4" /> Recalls
                        </button>
                    )}
                    <button onClick={() => setViewMode('insights')} className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all duration-200", viewMode === 'insights' ? 'bg-gradient-to-r from-violet-900/80 to-blue-900/80 text-violet-200 shadow-sm border border-violet-700/30' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50')}>
                        <Sparkles className="w-4 h-4" /> AI Insights
                    </button>
                </div>

               {/* Keyword search + Quick filters — below tabs, above results */}
               {(loading || results.length > 0) && (
                 <div className="flex flex-col gap-2 mb-4">
                   <KeywordSearchBar
                     keywordFilter={keywordFilter}
                     setKeywordFilter={setKeywordFilter}
                     totalResults={filteredResults.length}
                     matchCount={keywordFilteredResults.length}
                   />
                   <QuickFilterBar
                     filters={filters}
                     setFilters={setFilters}
                     results={results}
                     category={category}
                     onOpenMore={() => setShowFiltersModal(true)}
                   />
                 </div>
               )}

               
               {/* Results Views */}
               {viewMode === 'list' && (
                   <div className="space-y-4">
                       <div className="grid grid-cols-1 gap-4">
                           {paginatedResults.map((r, i) => (
                                <ReportCard key={i} rawReport={r} category={category} onClick={() => setSelectedReport(r)} store={store} showToast={showToast} />
                           ))}
                           {paginatedResults.length === 0 && !loading && (
                               <div className="text-center py-20 text-zinc-500 font-medium bg-zinc-950 rounded-lg border border-zinc-800">No results found matching your filters.</div>
                           )}
                       </div>
                       
                       {/* Pagination Controls */}
                       {totalPages > 1 && (
                           <div className="flex items-center justify-between bg-zinc-950 px-4 py-3 rounded-lg border border-zinc-800">
                               <span className="text-sm text-zinc-400">Page <b>{currentPage}</b> of <b>{totalPages}</b></span>
                               <div className="flex gap-2">
                                  <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="px-3 py-1.5 border border-zinc-800 rounded text-sm font-semibold text-zinc-400 hover:bg-zinc-950 disabled:opacity-50">Previous</button>
                                  <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="px-3 py-1.5 border border-zinc-800 rounded text-sm font-semibold text-zinc-400 hover:bg-zinc-950 disabled:opacity-50">Next</button>
                               </div>
                           </div>
                       )}
                   </div>
               )}
               {viewMode === 'graph' && (
                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <SimpleFilterChart
                          title="Top Reported Issues"
                          icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
                          data={typesData}
                          barHue={217}
                          layout="vertical"
                        />

                        <SimpleFilterChart
                          title="Reports Over Time"
                          icon={<Clock className="w-4 h-4 text-zinc-400" />}
                          data={timeData.map(d => ({ term: String(d.time ?? d.term ?? '').substring(0,4), count: d.count }))}
                          barHue={160}
                          layout="horizontal"
                        />

                        {productProblemData.length > 0 && (
                            <ProblemBarChart
                                title="Top Product Problems"
                                data={productProblemData}
                                totalReports={filteredResults.length}
                                barHue={38}
                                dotColor="bg-amber-500"
                                onBarClick={(term) => {
                                    setFilters(f => ({ ...f, productProblems: { include: [term], exclude: [] } }));
                                    setViewMode('list');
                                }}
                            />
                        )}

                        {/* Patient Problems chart */}
                        {patientProblemData.length > 0 && (
                            <ProblemBarChart
                                title="Top Patient Problems"
                                data={patientProblemData}
                                totalReports={filteredResults.length}
                                barHue={345}
                                dotColor="bg-rose-500"
                            />
                        )}
                    </div>
               )}
                {viewMode === 'problems' && (
                    <ProblemsView
                      results={filteredResults}
                      category={category}
                      onProductProblemClick={(code) => {
                        setFilters(f => ({ ...f, productProblems: { include: [code], exclude: [] } }));
                        setViewMode('list');
                      }}
                      onPatientProblemClick={(code) => {
                        setFilters(f => ({ ...f, patientProblems: { include: [code], exclude: [] } }));
                        setViewMode('list');
                      }}
                    />
                )}
               {viewMode === 'recalls' && (
                   <RecallsView
                     recallResults={recallResults}
                     recallTimeData={recallTimeData}
                     deviceIdentifiers={deviceIdentifiers}
                     mfrGroups={store.mfrGroups}
                     onSaveMfrGroup={store.saveMfrGroup}
                     onRemoveMfrGroup={store.removeMfrGroup}
                     recallSearchMode={recallSearchMode}
                     searchQuery={searchedQueries[0] ?? ''}
                     loading={loading}
                   />
               )}
               {viewMode === 'insights' && (
                   <AiInsightsView
                     results={filteredResults}
                     category={category}
                     onSelectReport={setSelectedReport}
                     chatMessages={chatMessages}
                     setChatMessages={setChatMessages}
                     savedReportIds={new Set(store.savedReports.map(r => r.id))}
                   />
               )}
            </div>
         )}
         
         {showFiltersModal && <FiltersModal filters={filters} setFilters={setFilters} onClose={() => setShowFiltersModal(false)} results={results} category={category} />}
         {selectedReport && <ReportModal rawReport={selectedReport} category={category} onClose={() => setSelectedReport(null)} store={store} uid={uid} showToast={showToast} />}
         {shareUrl && <ShareLinkDialog url={shareUrl} onClose={() => setShareUrl(null)} />}
      </div>
    </div>
  );
}

const ReportCard: React.FC<{ rawReport: any, category: Category, onClick?: () => void, store: ReturnType<typeof useStore>, showToast?: (msg: string, type?: 'success' | 'info' | 'remove') => void }> = ({ rawReport, category, onClick, store, showToast }) => {
    const { saveReport, removeReport, savedReports, folders } = store;
    const parsed = parseReport(category, rawReport);
    const [justSaved, setJustSaved] = useState(false);

    // Check if already saved
    const existingSave = savedReports.find(r => r.id === parsed.id);
    const savedFolder = existingSave
        ? (existingSave.folderId === 'archive'
            ? 'Archive'
            : folders.find(f => f.id === existingSave.folderId)?.name ?? 'Uncategorized')
        : null;

    const handleSave = () => {
        if (existingSave) {
            // Already saved → remove it
            removeReport(parsed.id);
            showToast?.(`"${parsed.title}" removed from saved`, 'remove');
        } else {
            saveReport({
                id: parsed.id,
                category,
                title: parsed.title,
                summary: parsed.description.substring(0, 200),
                rawData: rawReport,
                notes: '',
                folderId: null
            });
            setJustSaved(true);
            setTimeout(() => setJustSaved(false), 2000);
            showToast?.(`"${parsed.title}" saved`, 'success');
        }
    };

    return (
        <div onClick={onClick} className="bg-zinc-950 border text-sm border-zinc-800 hover:border-zinc-600 rounded-lg p-4 shadow-sm hover:shadow transition-all group cursor-pointer">
            <div className="flex justify-between items-start mb-3">
               <div className="flex-1 min-w-0 mr-3">
                 <div className="flex items-center gap-2 mb-1 flex-wrap">
                     <span className="font-mono text-xs text-zinc-100 font-medium">{parsed.id}</span>
                     <span className="text-zinc-500 text-xs">· {formatDate(parsed.date)}</span>
                     {existingSave && !justSaved && (
                         <span className="flex items-center gap-1 bg-emerald-950 text-emerald-400 border border-emerald-900 px-2 py-0.5 rounded-full text-[10px] font-bold">
                             <Bookmark className="w-2.5 h-2.5 fill-current" />
                             Saved · {savedFolder}
                         </span>
                     )}
                 </div>
                 <h4 className="text-base font-bold text-zinc-50 capitalize">{parsed.title}</h4>
               </div>

               <button
                    onClick={(e) => { e.stopPropagation(); handleSave(); }}
                    className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-colors shrink-0",
                        justSaved
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-900"
                            : existingSave
                            ? "bg-zinc-900 text-zinc-400 border border-zinc-700 hover:bg-red-950 hover:text-red-300 hover:border-red-900"
                            : "bg-zinc-950 border border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                    )}
                >
                    {justSaved
                      ? <><Bookmark className="w-3.5 h-3.5 fill-current" /> Saved!</>
                      : existingSave
                      ? <><BookmarkMinus className="w-3.5 h-3.5" /> Remove</>
                      : <><Bookmark className="w-3.5 h-3.5" /> Save</>
                    }
                </button>
            </div>

            <p className="text-zinc-400 mb-4 line-clamp-2 leading-relaxed text-sm">
                {parsed.description}
            </p>

            {/* Category-specific metadata row */}
            {category === 'drug' && (() => {
              const serious = rawReport.serious === '1';
              const fatal = rawReport.seriousnessdeath === '1';
              const hospitalized = rawReport.seriousnesshospitalization === '1';
              const lifeThreat = rawReport.seriousnesslifethreatening === '1';
              const sexCode = rawReport.patient?.patientsex;
              const sex = sexCode === '1' ? 'M' : sexCode === '2' ? 'F' : null;
              const country = rawReport.primarysourcecountry || rawReport.occurcountry;
              const allDrugs: string[] = (rawReport.patient?.drug || []).map((d: any) =>
                Array.isArray(d.openfda?.brand_name) ? d.openfda.brand_name[0] : d.medicinalproduct
              ).filter(Boolean);
              const ageGroupMap: Record<string, string> = { '1': 'Neonate', '2': 'Infant', '3': 'Child', '4': 'Adolescent', '5': 'Adult', '6': 'Elderly' };
              const ageGroup = ageGroupMap[rawReport.patient?.patientagegroup];
              return (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {fatal && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-950 border border-red-800 text-red-300">☠ Fatal</span>}
                  {!fatal && lifeThreat && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-950 border border-orange-800 text-orange-300">⚡ Life-threatening</span>}
                  {!fatal && !lifeThreat && hospitalized && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 border border-rose-800 text-rose-300">🏥 Hospitalized</span>}
                  {!fatal && !lifeThreat && !hospitalized && serious && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 border border-amber-800 text-amber-300">⚠ Serious</span>}
                  {sex && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-900 border border-zinc-700 text-zinc-400">{sex}</span>}
                  {ageGroup && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-900 border border-zinc-700 text-zinc-400">{ageGroup}</span>}
                  {country && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-900 border border-zinc-700 text-zinc-400">{country}</span>}
                  {allDrugs.length > 1 && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-950 border border-indigo-800 text-indigo-400">{allDrugs.length} drugs</span>}
                </div>
              );
            })()}
            {category === 'food' && (() => {
              const outcomes: string[] = rawReport.outcomes || [];
              const industryNames = [...new Set((rawReport.products || []).map((p: any) => p.industry_name).filter(Boolean))] as string[];
              const gender = rawReport.consumer?.gender;
              const age = rawReport.consumer?.age ? `${rawReport.consumer.age} ${rawReport.consumer.age_unit || 'yr'}` : null;
              const outcomeColor = (o: string) => {
                const l = o.toLowerCase();
                return l.includes('death') ? 'bg-red-950 border-red-800 text-red-300' :
                       l.includes('life threat') ? 'bg-orange-950 border-orange-800 text-orange-300' :
                       l.includes('hospital') ? 'bg-rose-950 border-rose-800 text-rose-300' :
                       l.includes('emergency') ? 'bg-amber-950 border-amber-800 text-amber-300' :
                       'bg-zinc-900 border-zinc-700 text-zinc-400';
              };
              return (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {outcomes.slice(0,3).map((o, i) => (
                    <span key={i} className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${outcomeColor(o)}`}>{o}</span>
                  ))}
                  {industryNames[0] && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-950 border border-indigo-800 text-indigo-400">{industryNames[0]}</span>}
                  {age && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-900 border border-zinc-700 text-zinc-400">Age: {age}</span>}
                  {gender && gender !== 'Not Available' && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-900 border border-zinc-700 text-zinc-400">{gender}</span>}
                </div>
              );
            })()}
            {category === 'tobacco' && (() => {
              const nonuser = rawReport.nonuser_affected === 'Yes';
              const tobProducts: string[] = rawReport.tobacco_products || [];
              const numProblems: number = rawReport.number_health_problems ?? 0;
              return (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {nonuser && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 border border-amber-800 text-amber-300">⚠ Non-user affected</span>}
                  {tobProducts.slice(0,3).map((p, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-900 border border-zinc-700 text-zinc-400">{p}</span>
                  ))}
                  {numProblems > 0 && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-900 border border-zinc-700 text-zinc-400">{numProblems} health {numProblems === 1 ? 'problem' : 'problems'}</span>}
                </div>
              );
            })()}

            <div className="flex flex-wrap gap-1.5">
                {parsed.events.slice(0, 5).map((e, idx) => (
                    <span key={idx} className="bg-zinc-900 text-zinc-400 px-2 py-0.5 rounded text-[11px] font-semibold border border-zinc-800">
                        {e}
                    </span>
                ))}
                {parsed.events.length > 5 && (
                    <span className="bg-zinc-950 text-zinc-500 px-2 py-0.5 rounded text-[11px] font-medium border border-zinc-800">
                        +{parsed.events.length - 5}
                    </span>
                 )}
            </div>
        </div>
    )
}

// ─── FDA MDR Problem Code Lookup ──────────────────────────────────────────────
const MDR_CODES: Record<string, string> = {
  // Single-digit (legacy)
  '1':'Device Malfunction','2':'User/Patient Error','3':'Inadequate Labeling',
  '4':'Design Issue','5':'Manufacturing','6':'Component Failure','7':'Packaging','8':'Other','9':'No Information',
  // 4-digit device problem codes
  '1069':'Failure to Perform as Expected','1070':'Other Device Problem','1071':'Documentation Error',
  '1072':'Human Factors Issue','1073':'Chemical Hazard','1074':'Design Issue','1075':'Labeling Issue',
  '1076':'Component Failure','1077':'Software Issue','1078':'Electrical Issue','1079':'Mechanical Failure',
  '1080':'Manufacturing Defect','1081':'Packaging Issue','1082':'Sterility Compromise',
  '1083':'Biocompatibility Issue','1084':'Contamination','1085':'Leakage','1086':'Fracture',
  '1087':'Alarm Failure','1088':'No Known Device Problem','1089':'Occlusion',
  '1090':'Adverse Event Without Device Problem','1091':'Missing/Incorrect Information',
  '2682':'Operated Differently Than Expected','2993':'No Apparent Adverse Event',
  '3189':'No Device Problem Identified','3190':'Software-Related','3191':'Use Error',
  '3192':'Alarm Issue','3193':'Disconnection','3194':'Heating/Cooling','3195':'Power Failure',
  '3196':'Sensor Malfunction','3197':'Display/UI Issue','3198':'Communication Error',
  '3199':'Connectivity Issue','3200':'Interoperability Issue',
  // Patient problem codes
  '2001':'Death','2003':'Life Threatening','2005':'Hospitalization','2007':'Disability/Impairment',
  '2009':'Congenital Anomaly','2011':'Required Intervention','2013':'Pain/Discomfort',
  '2015':'Illness/Injury','2017':'No Patient Consequence','2019':'Infection',
  '2021':'Hemorrhage/Bleeding','2023':'Rash/Skin Reaction','2025':'Nausea/Vomiting',
  '2027':'Fever','2029':'Cardiac Event','2031':'Neurological Event','2033':'Respiratory Event','2035':'Unknown',
};
const lookupCode = (code: string) => /^\d+$/.test(code.trim()) ? (MDR_CODES[code.trim()] ?? `Code ${code}`) : code;

// ─── ProblemsView ──────────────────────────────────────────────────────────────
function ProblemsView({
  results, category, onProductProblemClick, onPatientProblemClick,
}: {
  results: any[];
  category: Category;
  onProductProblemClick?: (term: string) => void;
  onPatientProblemClick?: (term: string) => void;
}) {
  const [selectedNode, setSelectedNode] = React.useState<string | null>(null);
  const [minEdge, setMinEdge] = React.useState(1);
  const [showTopN, setShowTopN] = React.useState(20);
  const [hiddenLeftNodes, setHiddenLeftNodes] = React.useState<Set<string>>(new Set());
  const [hiddenRightNodes, setHiddenRightNodes] = React.useState<Set<string>>(new Set());
  const [showMapSettings, setShowMapSettings] = React.useState(false);
  const mapSettingsRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!showMapSettings) return;
    const handler = (e: MouseEvent) => {
      if (mapSettingsRef.current && !mapSettingsRef.current.contains(e.target as Node))
        setShowMapSettings(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMapSettings]);

  const { deviceProblems, patientProblems, eventTypes, coOccurrences } = React.useMemo(() => {
    const dp: Record<string,number> = {};
    const pp: Record<string,number> = {};
    const et: Record<string,number> = {};
    const co: Record<string,number> = {};

    for (const r of results) {
      const parsed = parseReport(category, r);
      const dps: string[] = (parsed.deviceProblems ?? []).flat().filter(Boolean);
      const pps: string[] = (parsed.patientProblems ?? []).flat().filter(Boolean);
      const evts: string[] = (parsed.events ?? []).filter(Boolean);
      dps.forEach(d => { dp[d] = (dp[d]||0)+1; });
      pps.forEach(p => { pp[p] = (pp[p]||0)+1; });
      evts.forEach(e => { et[e] = (et[e]||0)+1; });
      // co-occurrence: device × patient
      dps.forEach(d => pps.forEach(p => { const k=`${d}|||${p}`; co[k]=(co[k]||0)+1; }));
      // co-occurrence: device × event type
      dps.forEach(d => evts.forEach(e => { const k=`${d}|||evt:${e}`; co[k]=(co[k]||0)+1; }));
    }
    return {
      deviceProblems: Object.entries(dp).sort((a,b)=>b[1]-a[1]),
      patientProblems: Object.entries(pp).sort((a,b)=>b[1]-a[1]),
      eventTypes: Object.entries(et).sort((a,b)=>b[1]-a[1]),
      coOccurrences: co,
    };
  }, [results, category]);

  const noProblems = deviceProblems.length === 0 && patientProblems.length === 0;

  if (noProblems) return (
    <div className="flex flex-col items-center justify-center py-24 text-zinc-600">
      <Share2 className="w-12 h-12 mb-4 opacity-20" />
      <p className="text-lg font-medium text-zinc-500">No problem codes found in these results</p>
      <p className="text-sm mt-1">Problem codes appear in FDA device event reports under <code className="bg-zinc-900 px-1 rounded">device_problem_code</code> and <code className="bg-zinc-900 px-1 rounded">patient_problem_code</code></p>
    </div>
  );

  // ── SVG bipartite map ────────────────────────────────────────────────────────
  const VW = 960, VH_BASE = 80;
  const LEFT_X = 230, RIGHT_X = 730;
  const NODE_R_BASE = 5, NODE_R_MAX = 12;
  const topDP = deviceProblems.filter(([id]) => !hiddenLeftNodes.has(id)).slice(0, showTopN);
  const topPP = [...patientProblems, ...eventTypes.map(([k,v]) => [`evt:${k}`,v] as [string,number])]
    .filter(([id]) => !hiddenRightNodes.has(id as string))
    .sort((a,b)=>b[1]-a[1]).slice(0, showTopN);
  const maxDP = topDP[0]?.[1] ?? 1;
  const maxPP = topPP[0]?.[1] ?? 1;
  const VH = VH_BASE + Math.max(topDP.length, topPP.length) * 42 + 40;
  const nodeR = (count: number, max: number) => NODE_R_BASE + ((count/max)*(NODE_R_MAX-NODE_R_BASE));

  const dpNodes = topDP.map(([id, count], i) => ({ id: `dp:${id}`, label: lookupCode(id), rawId: id, count, x: LEFT_X, y: VH_BASE + i*42 }));
  const ppNodes = topPP.map(([id, count], i) => ({
    id: `pp:${id}`, label: id.startsWith('evt:') ? id.slice(4) : lookupCode(id),
    rawId: id as string, count, x: RIGHT_X, y: VH_BASE + i*42,
    isEvent: (id as string).startsWith('evt:')
  }));

  const edges = Object.entries(coOccurrences)
    .filter(([,c]) => c >= minEdge)
    .map(([key, count]) => {
      const [rawDp, rawPp] = key.split('|||');
      const left = dpNodes.find(n => n.id === `dp:${rawDp}`);
      const right = ppNodes.find(n => n.id === `pp:${rawPp}` || n.id === `pp:evt:${rawPp.replace('evt:','')}`);
      if (!left || !right) return null;
      return { left, right, count };
    })
    .filter(Boolean) as { left: typeof dpNodes[0], right: typeof ppNodes[0], count: number }[];

  const maxEdge = Math.max(...edges.map(e => e.count), 1);

  const isNodeActive = (id: string) => !selectedNode || selectedNode === id ||
    edges.some(e => (e.left.id === id || e.right.id === id) && (e.left.id === selectedNode || e.right.id === selectedNode));
  const isEdgeActive = (e: typeof edges[0]) => !selectedNode || e.left.id === selectedNode || e.right.id === selectedNode;

  // All unique left/right labels for gear panel
  const allLeftIds = deviceProblems.slice(0, showTopN + 20).map(([id]) => id);
  const allRightIds = [...patientProblems, ...eventTypes.map(([k,v]) => [`evt:${k}`,v] as [string,number])]
    .sort((a,b)=>b[1]-a[1]).slice(0, showTopN + 20).map(([id]) => id as string);

  return (
    <div className="space-y-5">
      {/* Header row — summary legend only, no sub-tab toggle */}
      <div className="flex items-center gap-4 text-xs text-zinc-500 flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block"/>{deviceProblems.length} device problems</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-rose-500 inline-block"/>{patientProblems.length} patient problems</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-indigo-500 inline-block"/>{eventTypes.length} event types</span>
      </div>

      {/* ── Connection Map ──────────────────────────────────────────────────── */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
        {/* Map controls */}
        <div className="flex items-center gap-4 px-5 py-3 border-b border-zinc-800 flex-wrap">
          <span className="text-xs font-bold text-zinc-400 tracking-wide">⬡ Connection Map</span>
          <div className="flex items-center gap-2 text-xs">
            <label className="text-zinc-500 font-medium">Show top</label>
            <select value={showTopN} onChange={e=>setShowTopN(+e.target.value)}
              className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-300 text-xs outline-none">
              {[10,15,20,30,40].map(n=><option key={n} value={n}>{n}</option>)}
            </select>
            <label className="text-zinc-500 font-medium">· Min co-occurrences</label>
            <select value={minEdge} onChange={e=>setMinEdge(+e.target.value)}
              className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-300 text-xs outline-none">
              {[1,2,3,5,10,20].map(n=><option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          {selectedNode && (
            <button onClick={()=>setSelectedNode(null)} className="text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-700 px-3 py-1 rounded-full transition-colors">
              ✕ Clear selection
            </button>
          )}

          {/* Gear filter icon */}
          <div className="relative ml-auto" ref={mapSettingsRef}>
            <button
              onClick={() => setShowMapSettings(s => !s)}
              title="Node filter"
              className={cn('p-1.5 rounded-md border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors', showMapSettings && 'bg-zinc-800 text-zinc-300')}
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
            {showMapSettings && (
              <div className="absolute right-0 top-full mt-2 z-30 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-72 p-3 space-y-3 max-h-[70vh] overflow-y-auto">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-300">Node Filter</span>
                  <button onClick={() => setShowMapSettings(false)} className="text-zinc-600 hover:text-zinc-400"><X className="w-3.5 h-3.5" /></button>
                </div>

                {/* Left column — Device Problems */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"/> Device Problems
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => setHiddenLeftNodes(new Set())} className="text-[10px] text-zinc-600 hover:text-zinc-300">Select all</button>
                      <span className="text-zinc-700">·</span>
                      <button onClick={() => setHiddenLeftNodes(new Set(allLeftIds))} className="text-[10px] text-zinc-600 hover:text-zinc-300">Deselect all</button>
                    </div>
                  </div>
                  <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                    {deviceProblems.slice(0, 40).map(([id, cnt]) => {
                      const isHidden = hiddenLeftNodes.has(id);
                      return (
                        <label key={id} className="flex items-center gap-2 cursor-pointer group">
                          <input type="checkbox" checked={!isHidden}
                            onChange={() => setHiddenLeftNodes(prev => {
                              const next = new Set(prev);
                              if (isHidden) next.delete(id); else next.add(id);
                              return next;
                            })}
                            className="accent-amber-500 w-3.5 h-3.5 shrink-0" />
                          <span className="text-xs text-zinc-300 flex-1 truncate group-hover:text-zinc-100">{lookupCode(id)}</span>
                          <span className="text-[10px] text-zinc-600 shrink-0">{cnt}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Right column — Patient / Event */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"/> Patient / Event
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => setHiddenRightNodes(new Set())} className="text-[10px] text-zinc-600 hover:text-zinc-300">Select all</button>
                      <span className="text-zinc-700">·</span>
                      <button onClick={() => setHiddenRightNodes(new Set(allRightIds))} className="text-[10px] text-zinc-600 hover:text-zinc-300">Deselect all</button>
                    </div>
                  </div>
                  <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                    {[...patientProblems, ...eventTypes.map(([k,v]) => [`evt:${k}`,v] as [string,number])]
                      .sort((a,b)=>b[1]-a[1]).slice(0, 40).map(([id, cnt]) => {
                        const sid = id as string;
                        const isHidden = hiddenRightNodes.has(sid);
                        const label = sid.startsWith('evt:') ? sid.slice(4) : lookupCode(sid);
                        return (
                          <label key={sid} className="flex items-center gap-2 cursor-pointer group">
                            <input type="checkbox" checked={!isHidden}
                              onChange={() => setHiddenRightNodes(prev => {
                                const next = new Set(prev);
                                if (isHidden) next.delete(sid); else next.add(sid);
                                return next;
                              })}
                              className="accent-rose-500 w-3.5 h-3.5 shrink-0" />
                            <span className={cn('text-xs flex-1 truncate group-hover:text-zinc-100', sid.startsWith('evt:') ? 'text-indigo-400' : 'text-zinc-300')}>{label}</span>
                            <span className="text-[10px] text-zinc-600 shrink-0">{cnt}</span>
                          </label>
                        );
                      })}
                  </div>
                </div>

                <button
                  onClick={() => { setHiddenLeftNodes(new Set()); setHiddenRightNodes(new Set()); }}
                  className="w-full py-1.5 text-[10px] text-zinc-500 hover:text-zinc-300 border border-zinc-800 rounded-lg transition-colors"
                >
                  Reset all filters
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 text-[10px] text-zinc-600">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"/>Device Problem</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"/>Patient Problem</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block"/>Event Type</span>
          </div>
        </div>

        {edges.length === 0 ? (
          <div className="py-20 text-center text-zinc-600 text-sm">
            No connections found — try lowering the minimum co-occurrence threshold
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
            <svg viewBox={`0 0 ${VW} ${VH}`} width={VW} height={VH} className="block">
              <defs>
                <filter id="glow-amber"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                <filter id="glow-rose"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
              </defs>

              {/* Column headers */}
              <text x={LEFT_X} y={32} textAnchor="middle" fontSize={11} fontWeight="700" fill="#f59e0b" letterSpacing="2">DEVICE PROBLEMS</text>
              <text x={RIGHT_X} y={32} textAnchor="middle" fontSize={11} fontWeight="700" fill="#f43f5e" letterSpacing="2">PATIENT / EVENT</text>
              <line x1={VW/2} y1={20} x2={VW/2} y2={VH-10} stroke="#27272a" strokeWidth={1} strokeDasharray="4 4"/>

              {/* Edges */}
              {edges.map((edge, i) => {
                const active = isEdgeActive(edge);
                const weight = edge.count / maxEdge;
                const cx1 = LEFT_X + 120, cy1 = edge.left.y, cx2 = RIGHT_X - 120, cy2 = edge.right.y;
                return (
                  <path key={i}
                    d={`M ${edge.left.x} ${edge.left.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${edge.right.x} ${edge.right.y}`}
                    fill="none"
                    stroke={edge.right.isEvent ? '#818cf8' : '#a78bfa'}
                    strokeWidth={active ? 0.5 + weight*2.5 : 0.5}
                    opacity={active ? 0.15 + weight*0.7 : 0.03}
                    style={{transition:'opacity 0.2s'}}
                  />
                );
              })}

              {/* Device problem nodes (left) */}
              {dpNodes.map(node => {
                const r = nodeR(node.count, maxDP);
                const active = isNodeActive(node.id);
                const sel = selectedNode === node.id;
                return (
                  <g key={node.id} onClick={() => setSelectedNode(sel ? null : node.id)} style={{cursor:'pointer',opacity:active?1:0.25,transition:'opacity 0.2s'}}>
                    <circle cx={node.x} cy={node.y} r={r+4} fill="transparent"/>
                    <circle cx={node.x} cy={node.y} r={r} fill={sel?'#f59e0b':'#78350f'} stroke={sel?'#fde68a':'#f59e0b'} strokeWidth={sel?2:1} filter={sel?'url(#glow-amber)':undefined}/>
                    <text x={node.x - r - 6} y={node.y + 4} textAnchor="end" fontSize={10} fill={active?'#d4d4d8':'#52525b'} fontWeight={sel?'700':'400'}>
                      {node.label.length > 28 ? node.label.slice(0,26)+'…' : node.label}
                    </text>
                    <text x={node.x - r - 6} y={node.y + 14} textAnchor="end" fontSize={8} fill="#52525b">{node.count}×</text>
                  </g>
                );
              })}

              {/* Patient / event type nodes (right) */}
              {ppNodes.map(node => {
                const r = nodeR(node.count, maxPP);
                const active = isNodeActive(node.id);
                const sel = selectedNode === node.id;
                const color = node.isEvent ? '#6366f1' : '#f43f5e';
                const dimColor = node.isEvent ? '#312e81' : '#4c0519';
                const stroke = node.isEvent ? '#a5b4fc' : '#fda4af';
                return (
                  <g key={node.id} onClick={() => setSelectedNode(sel ? null : node.id)} style={{cursor:'pointer',opacity:active?1:0.25,transition:'opacity 0.2s'}}>
                    <circle cx={node.x} cy={node.y} r={r+4} fill="transparent"/>
                    <circle cx={node.x} cy={node.y} r={r} fill={sel?color:dimColor} stroke={sel?stroke:color} strokeWidth={sel?2:1} filter={sel?'url(#glow-rose)':undefined}/>
                    <text x={node.x + r + 6} y={node.y + 4} fontSize={10} fill={active?'#d4d4d8':'#52525b'} fontWeight={sel?'700':'400'}>
                      {node.label.length > 28 ? node.label.slice(0,26)+'…' : node.label}
                    </text>
                    <text x={node.x + r + 6} y={node.y + 14} fontSize={8} fill="#52525b">{node.count}×</text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>

      {/* ── Problem List (below the map) ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Device problems */}
        <div className="lg:col-span-1 bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"/>
            <h3 className="text-sm font-bold text-zinc-100">Device / Product Problems</h3>
            <span className="ml-auto text-xs text-zinc-500">{deviceProblems.length} unique</span>
          </div>
          <div className="divide-y divide-zinc-900 max-h-96 overflow-y-auto">
            {deviceProblems.map(([code, count]) => (
              <div key={code}
                className={cn('px-4 py-2.5 flex items-center gap-3 transition-colors', onProductProblemClick ? 'cursor-pointer hover:bg-blue-950/30 group' : 'hover:bg-zinc-900/50')}
                onClick={() => onProductProblemClick?.(lookupCode(code))}
                title={onProductProblemClick ? 'Click to filter results by this problem' : undefined}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-200 font-medium truncate group-hover:text-blue-300 transition-colors">{lookupCode(code)}</p>
                  <p className="text-[10px] text-zinc-600 font-mono">#{code}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-20 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{width:`${(count/deviceProblems[0][1])*100}%`}}/>
                  </div>
                  <span className="text-xs font-bold text-zinc-400 w-8 text-right">{count}</span>
                  {onProductProblemClick && <span className="text-[10px] text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">→</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Patient problems */}
        <div className="lg:col-span-1 bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"/>
            <h3 className="text-sm font-bold text-zinc-100">Patient Problems</h3>
            <span className="ml-auto text-xs text-zinc-500">{patientProblems.length} unique</span>
          </div>
          <div className="divide-y divide-zinc-900 max-h-96 overflow-y-auto">
            {patientProblems.map(([code, count]) => (
              <div key={code}
                className={cn('px-4 py-2.5 flex items-center gap-3 transition-colors', onPatientProblemClick ? 'cursor-pointer hover:bg-blue-950/30 group' : 'hover:bg-zinc-900/50')}
                onClick={() => onPatientProblemClick?.(lookupCode(code))}
                title={onPatientProblemClick ? 'Click to filter results by this problem' : undefined}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-200 font-medium truncate group-hover:text-blue-300 transition-colors">{lookupCode(code)}</p>
                  <p className="text-[10px] text-zinc-600 font-mono">#{code}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-20 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-500 rounded-full" style={{width:`${(count/patientProblems[0][1])*100}%`}}/>
                  </div>
                  <span className="text-xs font-bold text-zinc-400 w-8 text-right">{count}</span>
                  {onPatientProblemClick && <span className="text-[10px] text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">→</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Event types */}
        <div className="lg:col-span-1 bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"/>
            <h3 className="text-sm font-bold text-zinc-100">Event Types</h3>
            <span className="ml-auto text-xs text-zinc-500">{eventTypes.length} unique</span>
          </div>
          <div className="divide-y divide-zinc-900 max-h-96 overflow-y-auto">
            {eventTypes.map(([evt, count]) => (
              <div key={evt} className="px-4 py-2.5 flex items-center gap-3 hover:bg-zinc-900/50 transition-colors">
                <p className="flex-1 text-sm text-zinc-200 font-medium truncate">{evt}</p>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-20 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{width:`${(count/eventTypes[0][1])*100}%`}}/>
                  </div>
                  <span className="text-xs font-bold text-zinc-400 w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── RecallsView ───────────────────────────────────────────────────────────────
function RecallsView({
  recallResults, recallTimeData, deviceIdentifiers, mfrGroups, onSaveMfrGroup, onRemoveMfrGroup, recallSearchMode, searchQuery, loading,
}: {
  recallResults: any[];
  recallTimeData: CountResult[];
  deviceIdentifiers: DeviceIdentifier[];
  mfrGroups: ManufacturerGroup[];
  onSaveMfrGroup: (g: ManufacturerGroup) => void;
  onRemoveMfrGroup: (id: string) => void;
  recallSearchMode: 'query' | 'identifiers' | null;
  searchQuery: string;
  loading: boolean;
}) {
  const [selectedDevice, setSelectedDevice] = React.useState<string | null>(null);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  // ── Manufacturer grouping UI state ────────────────────────────────────────
  const [showMfrPanel, setShowMfrPanel] = React.useState(false);
  const [editingGroupId, setEditingGroupId] = React.useState<string | null>(null);
  const [editDraft, setEditDraft] = React.useState<{ name: string; aliases: string[] } | null>(null);
  const [newAlias, setNewAlias] = React.useState('');

  // Collect all raw firm names from current recall results
  const rawFirms = React.useMemo(() => {
    const all = recallResults.map(r => (r.recalling_firm || '').trim()).filter(Boolean);
    return [...new Set(all)].sort();
  }, [recallResults]);

  // Auto-suggested groups from current results (not yet saved)
  const suggestedGroups = React.useMemo(() => {
    if (rawFirms.length < 2) return [];
    const suggestions = autoGroupManufacturers(rawFirms);
    // Filter out suggestions already covered by saved groups
    return suggestions.filter(s =>
      !mfrGroups.some(g => s.aliases.every(a => g.aliases.includes(a)))
    );
  }, [rawFirms, mfrGroups]);

  const startEditGroup = (id: string) => {
    const g = mfrGroups.find(g => g.id === id);
    if (!g) return;
    setEditingGroupId(id);
    setEditDraft({ name: g.name, aliases: [...g.aliases] });
  };

  const commitEdit = () => {
    if (!editingGroupId || !editDraft) return;
    const g = mfrGroups.find(g => g.id === editingGroupId);
    if (g) onSaveMfrGroup({ ...g, name: editDraft.name, aliases: editDraft.aliases });
    setEditingGroupId(null);
    setEditDraft(null);
    setNewAlias('');
  };

  const saveSuggestion = (suggestion: { name: string; aliases: string[] }) => {
    onSaveMfrGroup({
      id: generateId(),
      name: suggestion.name,
      aliases: suggestion.aliases,
      createdAt: Date.now(),
    });
  };

  // ── Build bipartite graph: Device (left) ↔ Recall (right) ─────────────────
  // Each recall may match multiple device identifiers; we decide linkage by
  // checking whether the recall's product_description or openfda.device_name
  // contains the device brand/generic/openfda name.
  const deviceNodes = React.useMemo(() => {
    const nodes: { id: string; label: string; count: number }[] = [];
    const seen = new Set<string>();
    for (const d of deviceIdentifiers) {
      const label = d.deviceName || d.brandName || d.genericName;
      if (!label || seen.has(label)) continue;
      seen.add(label);
      // count = how many recalls mention this device
      const count = recallResults.filter(r => {
        const haystack = `${r.product_description || ''} ${r.openfda?.device_name || ''}`.toLowerCase();
        return label.toLowerCase().split(' ').slice(0, 3).some(w => w.length > 3 && haystack.includes(w));
      }).length;
      if (count > 0) nodes.push({ id: label, label, count });
    }
    return nodes.sort((a, b) => b.count - a.count).slice(0, 20);
  }, [deviceIdentifiers, recallResults]);

  const recallNodes = React.useMemo(() => {
    return recallResults.slice(0, 30).map((r, i) => ({
      id: r.cfres_id || String(i),
      label: (r.recalling_firm || 'Unknown Firm').slice(0, 32),
      status: r.recall_status || 'Unknown',
      count: 1,
    }));
  }, [recallResults]);

  const edges = React.useMemo(() => {
    const result: { devId: string; recId: string }[] = [];
    for (const dev of deviceNodes) {
      const words = dev.label.toLowerCase().split(' ').filter(w => w.length > 3).slice(0, 3);
      for (const rec of recallNodes) {
        const hay = recallResults.find(r => (r.cfres_id || '') === rec.id || recallResults.indexOf(r) === recallNodes.indexOf(rec));
        const haystack = `${hay?.product_description || ''} ${hay?.openfda?.device_name || ''}`.toLowerCase();
        if (words.some(w => haystack.includes(w))) {
          result.push({ devId: dev.id, recId: rec.id });
        }
      }
    }
    return result;
  }, [deviceNodes, recallNodes, recallResults]);

  // SVG layout
  const VW = 900, VH_BASE = 60, ROW_H = 36;
  const LEFT_X = 200, RIGHT_X = 700;
  const VH = VH_BASE + Math.max(deviceNodes.length, recallNodes.length) * ROW_H + 30;
  const maxDevCount = deviceNodes[0]?.count ?? 1;

  const isDevActive = (id: string) => !selectedDevice || selectedDevice === id || edges.some(e => e.devId === id && e.recId === (selectedDevice ?? '')) || edges.some(e => e.devId === id && edges.some(f => f.recId === e.recId && f.devId === selectedDevice));
  const isRecActive = (id: string) => !selectedDevice || edges.some(e => e.recId === id && e.devId === selectedDevice);
  const isEdgeActive = (e: { devId: string; recId: string }) => !selectedDevice || e.devId === selectedDevice;

  // Filter recalls list by selected device
  const filteredRecalls = React.useMemo(() => {
    if (!selectedDevice) return recallResults;
    const words = selectedDevice.toLowerCase().split(' ').filter(w => w.length > 3).slice(0, 3);
    return recallResults.filter(r => {
      const hay = `${r.product_description || ''} ${r.openfda?.device_name || ''}`.toLowerCase();
      return words.some(w => hay.includes(w));
    });
  }, [selectedDevice, recallResults]);

  const statusColor = (s: string) =>
    s === 'Ongoing' ? 'bg-amber-950 text-amber-400 border-amber-900'
    : s === 'Terminated' ? 'bg-emerald-950 text-emerald-400 border-emerald-900'
    : 'bg-zinc-900 text-zinc-400 border-zinc-700';

  if (!loading && recallResults.length === 0) return (
    <div className="flex flex-col items-center justify-center py-24 text-zinc-600">
      <AlertTriangle className="w-12 h-12 mb-4 opacity-20" />
      <p className="text-lg font-medium text-zinc-500">No recalls found for "{searchQuery}"</p>
      <p className="text-sm mt-1 text-zinc-600">Tried direct product name and identifier-based searches — no matching recall records in the FDA database.</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Summary + search mode label */}
      <div className="flex items-center gap-3 text-xs text-zinc-500 flex-wrap">
        {/* Source label */}
        {recallSearchMode === 'query' && (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950 border border-emerald-900 text-emerald-400 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"/>
            Matched by product name: "{searchQuery}"
          </span>
        )}
        {recallSearchMode === 'identifiers' && (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-950 border border-indigo-900 text-indigo-400 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block"/>
            Matched by device identifiers (brand + mfr + code)
          </span>
        )}
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block"/>{deviceNodes.length} device types</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"/>{recallResults.length} recalls</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"/>{recallResults.filter(r=>r.recall_status==='Ongoing').length} ongoing</span>
        {selectedDevice && (
          <button onClick={() => setSelectedDevice(null)} className="ml-auto flex items-center gap-1 text-blue-400 hover:text-blue-300 border border-blue-800 px-3 py-1 rounded-full text-xs transition-colors">
            ✕ Clear: {selectedDevice.slice(0, 30)}
          </button>
        )}
      </div>

      {/* ── Manufacturer Groups Panel ──────────────────────────────────────── */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowMfrPanel(v => !v)}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-900 transition-colors text-left"
        >
          <Users className="w-4 h-4 text-zinc-500 shrink-0" />
          <span className="text-xs font-bold text-zinc-300">Manufacturer Groups</span>
          {(mfrGroups.length > 0 || suggestedGroups.length > 0) && (
            <span className="ml-1 px-2 py-0.5 rounded-full bg-indigo-950 border border-indigo-900 text-indigo-400 text-[10px] font-bold">
              {mfrGroups.length} saved{suggestedGroups.length > 0 ? ` · ${suggestedGroups.length} suggested` : ''}
            </span>
          )}
          <ChevronDown className={cn('w-3.5 h-3.5 text-zinc-600 ml-auto shrink-0 transition-transform', showMfrPanel && 'rotate-180')} />
        </button>

        {showMfrPanel && (
          <div className="border-t border-zinc-800 divide-y divide-zinc-800/60">

            {/* Auto-suggested groups */}
            {suggestedGroups.length > 0 && (
              <div className="p-4">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block animate-pulse"/>
                  Auto-detected similar names — click to save as group
                </p>
                <div className="space-y-2">
                  {suggestedGroups.map((sg, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-zinc-900 border border-indigo-900/40 rounded-lg hover:border-indigo-700 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-zinc-200 mb-1">{sg.name}</p>
                        <div className="flex flex-wrap gap-1">
                          {sg.aliases.map(a => (
                            <span key={a} className="px-2 py-0.5 text-[10px] bg-zinc-800 text-zinc-500 rounded border border-zinc-700">{a}</span>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => saveSuggestion(sg)}
                        className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-indigo-900 hover:bg-indigo-800 text-indigo-300 rounded-lg text-[10px] font-bold transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Save
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Saved groups */}
            {mfrGroups.length > 0 && (
              <div className="p-4">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3">Saved Groups</p>
                <div className="space-y-3">
                  {mfrGroups.map(g => (
                    <div key={g.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                      {editingGroupId === g.id && editDraft ? (
                        <div className="space-y-2">
                          <input
                            value={editDraft.name}
                            onChange={e => setEditDraft(d => d ? { ...d, name: e.target.value } : d)}
                            className="w-full px-2.5 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs font-semibold text-zinc-100 outline-none focus:border-indigo-500"
                            placeholder="Group name…"
                          />
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {editDraft.aliases.map(a => (
                              <span key={a} className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-zinc-800 text-zinc-400 rounded border border-zinc-700">
                                {a}
                                <button onClick={() => setEditDraft(d => d ? { ...d, aliases: d.aliases.filter(x => x !== a) } : d)} className="text-zinc-600 hover:text-red-400 ml-0.5">×</button>
                              </span>
                            ))}
                          </div>
                          <div className="flex gap-1.5 mt-1">
                            <select
                              value={newAlias}
                              onChange={e => setNewAlias(e.target.value)}
                              className="flex-1 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-zinc-300 outline-none"
                            >
                              <option value="">Add a firm name…</option>
                              {rawFirms.filter(f => !editDraft.aliases.includes(f)).map(f => (
                                <option key={f} value={f}>{f}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => { if (newAlias) { setEditDraft(d => d ? { ...d, aliases: [...d.aliases, newAlias] } : d); setNewAlias(''); } }}
                              className="px-2.5 py-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded text-xs"
                            ><Plus className="w-3 h-3" /></button>
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button onClick={commitEdit} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-900 hover:bg-emerald-800 text-emerald-300 rounded text-[10px] font-bold">
                              <CheckCheck className="w-3 h-3" /> Save
                            </button>
                            <button onClick={() => { setEditingGroupId(null); setEditDraft(null); }} className="px-3 py-1.5 text-zinc-500 hover:text-zinc-300 text-[10px]">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-zinc-200 mb-1">{g.name}
                              <span className="ml-2 text-[10px] font-normal text-zinc-600">({g.aliases.length} names)</span>
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {g.aliases.map(a => (
                                <span key={a} className="px-2 py-0.5 text-[10px] bg-zinc-800 text-zinc-500 rounded border border-zinc-700">{a}</span>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => startEditGroup(g.id)} className="p-1.5 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 rounded" title="Edit">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => onRemoveMfrGroup(g.id)} className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-950 rounded" title="Delete group">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All raw firm names found in current results */}
            {rawFirms.length > 0 && (
              <div className="p-4">
                <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider mb-2">
                  All Firms in Results ({rawFirms.length})
                </p>
                <div className="flex flex-wrap gap-1">
                  {rawFirms.map(f => {
                    const group = mfrGroups.find(g => g.aliases.includes(f));
                    return (
                      <span key={f} className={cn(
                        'px-2 py-0.5 text-[10px] rounded border',
                        group ? 'bg-indigo-950 text-indigo-400 border-indigo-900' : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                      )} title={group ? `In group: ${group.name}` : 'Not grouped'}>
                        {f}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {rawFirms.length === 0 && mfrGroups.length === 0 && suggestedGroups.length === 0 && (
              <div className="p-6 text-center text-xs text-zinc-600">
                Search for a device to see manufacturer names here.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Device → Recall connection graph ──────────────────────────────── */}
      {deviceNodes.length > 0 && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="flex items-center gap-4 px-5 py-3 border-b border-zinc-800 flex-wrap">
            <span className="text-xs font-bold text-zinc-400 tracking-wide">⬡ Device → Recall Connection Map</span>
            <div className="flex items-center gap-4 text-[10px] text-zinc-600 ml-auto">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block"/>Device Model</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"/>Recall / Firm</span>
              <span className="text-zinc-700">· Click a node to filter</span>
            </div>
          </div>
          <div className="overflow-x-auto overflow-y-auto max-h-[55vh]">
            <svg viewBox={`0 0 ${VW} ${VH}`} width={VW} height={VH} className="block">
              <defs>
                <filter id="glow-sky"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                <filter id="glow-rose-r"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
              </defs>

              <text x={LEFT_X} y={30} textAnchor="middle" fontSize={10} fontWeight="700" fill="#38bdf8" letterSpacing="2">DEVICE MODELS</text>
              <text x={RIGHT_X} y={30} textAnchor="middle" fontSize={10} fontWeight="700" fill="#f43f5e" letterSpacing="2">RECALLS / FIRMS</text>
              <line x1={VW/2} y1={15} x2={VW/2} y2={VH-10} stroke="#27272a" strokeWidth={1} strokeDasharray="4 4"/>

              {/* Edges */}
              {edges.map((edge, i) => {
                const devIdx = deviceNodes.findIndex(d => d.id === edge.devId);
                const recIdx = recallNodes.findIndex(r => r.id === edge.recId);
                if (devIdx < 0 || recIdx < 0) return null;
                const y1 = VH_BASE + devIdx * ROW_H;
                const y2 = VH_BASE + recIdx * ROW_H;
                const active = isEdgeActive(edge);
                return (
                  <path key={i}
                    d={`M ${LEFT_X} ${y1} C ${LEFT_X+150} ${y1}, ${RIGHT_X-150} ${y2}, ${RIGHT_X} ${y2}`}
                    fill="none" stroke="#818cf8"
                    strokeWidth={active ? 1.5 : 0.5}
                    opacity={active ? 0.5 : 0.04}
                    style={{ transition: 'opacity 0.2s' }}
                  />
                );
              })}

              {/* Device nodes (left) */}
              {deviceNodes.map((node, i) => {
                const y = VH_BASE + i * ROW_H;
                const r = 4 + (node.count / maxDevCount) * 7;
                const active = isDevActive(node.id);
                const sel = selectedDevice === node.id;
                return (
                  <g key={node.id} onClick={() => setSelectedDevice(sel ? null : node.id)} style={{ cursor: 'pointer', opacity: active ? 1 : 0.2, transition: 'opacity 0.2s' }}>
                    <circle cx={LEFT_X} cy={y} r={r+4} fill="transparent"/>
                    <circle cx={LEFT_X} cy={y} r={r} fill={sel ? '#38bdf8' : '#0c4a6e'} stroke={sel ? '#bae6fd' : '#38bdf8'} strokeWidth={sel ? 2 : 1} filter={sel ? 'url(#glow-sky)' : undefined}/>
                    <text x={LEFT_X - r - 6} y={y + 4} textAnchor="end" fontSize={9} fill={active ? '#d4d4d8' : '#52525b'} fontWeight={sel ? '700' : '400'}>
                      {node.label.length > 30 ? node.label.slice(0, 28) + '…' : node.label}
                    </text>
                    <text x={LEFT_X - r - 6} y={y + 13} textAnchor="end" fontSize={7} fill="#52525b">{node.count}×</text>
                  </g>
                );
              })}

              {/* Recall nodes (right) */}
              {recallNodes.map((node, i) => {
                const y = VH_BASE + i * ROW_H;
                const active = isRecActive(node.id);
                const sel = selectedDevice && edges.some(e => e.recId === node.id && e.devId === selectedDevice);
                const col = node.status === 'Ongoing' ? '#f59e0b' : node.status === 'Terminated' ? '#10b981' : '#f43f5e';
                const dimCol = node.status === 'Ongoing' ? '#78350f' : node.status === 'Terminated' ? '#064e3b' : '#4c0519';
                return (
                  <g key={node.id} style={{ opacity: active ? 1 : 0.15, transition: 'opacity 0.2s' }}>
                    <circle cx={RIGHT_X} cy={y} r={sel ? 7 : 5} fill={sel ? col : dimCol} stroke={col} strokeWidth={sel ? 2 : 1} filter={sel ? 'url(#glow-rose-r)' : undefined}/>
                    <text x={RIGHT_X + 12} y={y + 4} fontSize={9} fill={active ? '#d4d4d8' : '#52525b'} fontWeight={sel ? '700' : '400'}>
                      {node.label.length > 28 ? node.label.slice(0, 26) + '…' : node.label}
                    </text>
                    <text x={RIGHT_X + 12} y={y + 13} fontSize={7} fill={col} fontWeight="700">{node.status}</text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      )}

      {/* ── Recalls over time ────────────────────────────────────────────────── */}
      {recallTimeData.length > 0 && (
        <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
          <h3 className="text-xs font-bold text-zinc-400 mb-4 flex items-center gap-2 uppercase tracking-wide">
            <Clock className="w-3.5 h-3.5" /> Recalls Over Time
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={recallTimeData.slice(-30)} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                <XAxis dataKey="time" tickFormatter={v => String(v).substring(0, 4)} tick={{ fontSize: 10, fill: '#a1a1aa' }} />
                <YAxis tick={{ fontSize: 10, fill: '#a1a1aa' }} />
                <Tooltip labelFormatter={v => `Year: ${String(v).substring(0, 4)}`} contentStyle={{ borderRadius: '8px', backgroundColor: '#09090b', border: '1px solid #27272a', fontSize: '12px', color: '#fafafa' }} />
                <Bar dataKey="count" fill="#f43f5e" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Recall list ───────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
            {selectedDevice ? `Recalls linked to "${selectedDevice.slice(0,40)}"` : 'All Recall Records'}
            <span className="ml-2 text-zinc-600 font-normal normal-case">({filteredRecalls.length})</span>
          </h3>
        </div>

        {filteredRecalls.slice(0, 60).map((r, i) => {
          const id = r.cfres_id || r.product_res_number || String(i);
          const expanded = expandedId === id;
          const matchedDevices = deviceNodes.filter(d => {
            const words = d.label.toLowerCase().split(' ').filter(w => w.length > 3).slice(0, 3);
            const hay = `${r.product_description || ''} ${r.openfda?.device_name || ''}`.toLowerCase();
            return words.some(w => hay.includes(w));
          });
          return (
            <div key={id} className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-700 transition-colors">
              {/* Card header */}
              <button onClick={() => setExpandedId(expanded ? null : id)} className="w-full text-left p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border', statusColor(r.recall_status || ''))}>
                        {r.recall_status || 'Unknown'}
                      </span>
                      {r.product_code && <span className="font-mono text-[10px] text-zinc-600 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">Code: {r.product_code}</span>}
                      {r.event_date_initiated && <span className="text-[10px] text-zinc-600">{formatDate(r.event_date_initiated)}</span>}
                    </div>
                    <h4 className="font-bold text-sm text-zinc-100 leading-snug line-clamp-2">{r.product_description || 'Unknown Product'}</h4>
                  </div>
                  <ChevronDown className={cn('w-4 h-4 text-zinc-600 shrink-0 mt-1 transition-transform', expanded && 'rotate-180')} />
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-zinc-500"><span className="font-semibold text-zinc-400">Firm:</span> {r.recalling_firm || '—'}</span>
                  {r.root_cause_description && <span className="text-xs text-zinc-600">· {r.root_cause_description}</span>}
                  {/* Matched device pills */}
                  {matchedDevices.length > 0 && (
                    <div className="flex gap-1 flex-wrap ml-auto">
                      {matchedDevices.slice(0, 3).map(d => (
                        <span key={d.id} className="px-2 py-0.5 rounded-full bg-sky-950 border border-sky-900 text-sky-400 text-[10px] font-semibold">
                          {d.label.slice(0, 25)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </button>

              {/* Expanded detail */}
              {expanded && (
                <div className="border-t border-zinc-800 px-4 py-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-3">
                    {r.reason_for_recall && (
                      <div>
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Reason for Recall</p>
                        <p className="text-zinc-300 text-xs leading-relaxed">{r.reason_for_recall}</p>
                      </div>
                    )}
                    {r.action && (
                      <div>
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Corrective Action</p>
                        <p className="text-zinc-400 text-xs leading-relaxed">{r.action}</p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 text-xs">
                    {[
                      ['Recall #', r.product_res_number],
                      ['Res Event #', r.res_event_number],
                      ['Distribution', r.distribution_pattern],
                      ['Quantity', r.product_quantity],
                      ['Date Posted', formatDate(r.event_date_posted)],
                      ['Date Terminated', r.event_date_terminated ? formatDate(r.event_date_terminated) : null],
                      ['Lot / Serial', r.code_info],
                      ['City / State', r.city ? `${r.city}, ${r.state}` : null],
                    ].map(([label, val]) => val ? (
                      <div key={label} className="flex gap-2">
                        <span className="text-zinc-600 font-semibold shrink-0 w-32">{label}</span>
                        <span className="text-zinc-300">{val}</span>
                      </div>
                    ) : null)}
                    {r.openfda?.device_name && (
                      <div className="flex gap-2">
                        <span className="text-zinc-600 font-semibold shrink-0 w-32">Device Class</span>
                        <span className="text-zinc-300">{r.openfda.device_name} (Class {r.openfda.device_class})</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filteredRecalls.length === 0 && !loading && (
          <div className="text-center py-10 text-zinc-500 text-sm bg-zinc-950 rounded-xl border border-zinc-800">
            No recalls match the selected device. Try clicking another node.
          </div>
        )}
      </div>
    </div>
  );
}

const HISTORY_CAT_COLORS: Record<string, string> = {
  device: 'bg-blue-950 border-blue-800 text-blue-300',
  drug:   'bg-violet-950 border-violet-800 text-violet-300',
  food:   'bg-green-950 border-green-800 text-green-300',
  tobacco:'bg-amber-950 border-amber-800 text-amber-300',
};

function HistoryItemRow({ item, isSaved, onReplay, onRemove }: {
  item: import('./types').SearchHistoryItem;
  isSaved: boolean;
  onReplay: (item: import('./types').SearchHistoryItem) => void;
  onRemove: (id: string) => void;
  key?: React.Key;
}) {
  const queries = item.queries?.length ? item.queries : [item.query];
  return (
    <div className={cn(
      'group p-4 flex items-start gap-4 transition-colors',
      isSaved ? 'hover:bg-amber-950/20' : 'hover:bg-zinc-900/50'
    )}>
      <div className={cn('mt-0.5 shrink-0 w-8 h-8 rounded-lg flex items-center justify-center', isSaved ? 'bg-amber-950 border border-amber-800' : 'bg-zinc-900 border border-zinc-800')}>
        {isSaved ? <Bookmark className="w-4 h-4 text-amber-400" /> : <History className="w-4 h-4 text-zinc-500" />}
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border', HISTORY_CAT_COLORS[item.category] ?? 'bg-zinc-800 border-zinc-700 text-zinc-400')}>
            {item.category}
          </span>
          {isSaved && item.savedLabel && (
            <span className="text-sm font-semibold text-amber-300">{item.savedLabel}</span>
          )}
          <span className="text-xs text-zinc-600 ml-auto shrink-0">
            {new Date(item.timestamp).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {queries.map((q, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-800 border border-zinc-700 text-zinc-200">
              <Search className="w-2.5 h-2.5 opacity-50" />{q}
            </span>
          ))}
        </div>
        {(item.filters?.startDate || item.filters?.endDate) && (
          <div className="flex items-center gap-1.5 text-[10px] text-violet-400">
            <Calendar className="w-3 h-3" />
            {item.filters.startDate || '…'} → {item.filters.endDate || '…'}
          </div>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onReplay(item)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors"
        >↻ Replay</button>
        <button
          onClick={() => onRemove(item.id)}
          className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-950 transition-colors"
          title="Remove"
        ><X className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
}

function HistoryScreen({ store, onReplay }: {
  store: ReturnType<typeof useStore>;
  onReplay: (item: import('./types').SearchHistoryItem) => void;
}) {
  const { searchHistory, clearSearchHistory, removeHistoryItem } = store;

  const savedQueries = searchHistory.filter(h => h.saved);
  const recentHistory = searchHistory.filter(h => !h.saved);

  return (
    <div className="p-8 space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight text-zinc-100 flex items-center gap-3">
          <History className="w-8 h-8 text-zinc-100" />
          Search History
        </h2>
        {recentHistory.length > 0 && (
          <button
            onClick={clearSearchHistory}
            className="px-4 py-2 border border-zinc-800 text-red-400 rounded-lg hover:bg-red-950 hover:border-red-900 text-sm font-semibold transition-colors flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4" /> Clear History
          </button>
        )}
      </div>

      {/* Saved Queries */}
      {savedQueries.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Bookmark className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider">Saved Searches</h3>
            <span className="text-[10px] font-bold bg-amber-950 border border-amber-800 text-amber-400 px-1.5 py-0.5 rounded-full">{savedQueries.length}</span>
          </div>
          <div className="bg-zinc-950 border border-amber-900/40 rounded-xl overflow-hidden divide-y divide-zinc-800/50">
            {savedQueries.map(item => <HistoryItemRow key={item.id} item={item} isSaved={true} onReplay={onReplay} onRemove={removeHistoryItem} />)}
          </div>
        </div>
      )}

      {/* Recent History */}
      <div>
        {savedQueries.length > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-zinc-500" />
            <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider">Recent Searches</h3>
            <span className="text-[10px] font-bold bg-zinc-800 border border-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded-full">{recentHistory.length}</span>
          </div>
        )}
        {recentHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center text-zinc-500">
            <History className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg">No search history yet.</p>
            <p className="text-sm mt-1">Your searches will appear here.</p>
          </div>
        ) : (
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-800/50">
            {recentHistory.map(item => <HistoryItemRow key={item.id} item={item} isSaved={false} onReplay={onReplay} onRemove={removeHistoryItem} />)}
          </div>
        )}
      </div>
    </div>
  );
}

// 3-state filter chip group with search bar and Select All
function FilterDimGroup({
    label, options, dim, onChange, emptyLabel = 'No data in loaded results'
}: {
    label: string;
    options: string[];
    dim: { include: string[]; exclude: string[] };
    onChange: (d: { include: string[]; exclude: string[] }) => void;
    emptyLabel?: string;
}) {
    const [search, setSearch] = React.useState('');

    const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));
    const activeCount = dim.include.length + dim.exclude.length;

    // Cycle: neutral → include → exclude → neutral
    const cycle = (val: string) => {
        if (dim.include.includes(val)) {
            // include → exclude
            onChange({ include: dim.include.filter(v => v !== val), exclude: [...dim.exclude, val] });
        } else if (dim.exclude.includes(val)) {
            // exclude → neutral
            onChange({ include: dim.include, exclude: dim.exclude.filter(v => v !== val) });
        } else {
            // neutral → include
            onChange({ include: [...dim.include, val], exclude: dim.exclude });
        }
    };

    const selectAll = () => {
        onChange({ include: [...filtered], exclude: [] });
    };

    const clearAll = () => onChange({ include: [], exclude: [] });

    const stateOf = (val: string): 'include' | 'exclude' | 'neutral' => {
        if (dim.include.includes(val)) return 'include';
        if (dim.exclude.includes(val)) return 'exclude';
        return 'neutral';
    };

    return (
        <div className="space-y-2">
            {/* Header row */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{label}</span>
                    {activeCount > 0 && (
                        <span className="text-[10px] font-bold bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded-full">
                            {dim.include.length > 0 && <span className="text-blue-400">{dim.include.length}✓</span>}
                            {dim.include.length > 0 && dim.exclude.length > 0 && ' '}
                            {dim.exclude.length > 0 && <span className="text-red-400">{dim.exclude.length}✕</span>}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {filtered.length > 0 && (
                        <button
                            onClick={selectAll}
                            className="text-[10px] font-semibold text-zinc-500 hover:text-blue-400 transition-colors"
                        >
                            Include All
                        </button>
                    )}
                    {activeCount > 0 && (
                        <button onClick={clearAll} className="text-[10px] font-semibold text-zinc-500 hover:text-zinc-300 transition-colors">
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Search bar */}
            {options.length > 5 && (
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600 pointer-events-none" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder={`Search ${label.toLowerCase()}…`}
                        className="w-full pl-8 pr-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400">
                            <X className="w-3 h-3" />
                        </button>
                    )}
                </div>
            )}

            {/* Chips */}
            {options.length === 0 ? (
                <p className="text-xs text-zinc-600 italic py-1">{emptyLabel}</p>
            ) : filtered.length === 0 ? (
                <p className="text-xs text-zinc-600 italic py-1">No matches for "{search}"</p>
            ) : (
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                    {filtered.map(opt => {
                        const state = stateOf(opt);
                        return (
                            <button
                                key={opt}
                                onClick={() => cycle(opt)}
                                title={state === 'neutral' ? 'Click to include' : state === 'include' ? 'Click to exclude' : 'Click to remove'}
                                className={cn(
                                    'px-2.5 py-1 rounded-full text-xs font-semibold border transition-all flex items-center gap-1',
                                    state === 'include'
                                        ? 'bg-blue-600 border-blue-500 text-white'
                                        : state === 'exclude'
                                        ? 'bg-red-950 border-red-700 text-red-300'
                                        : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                                )}
                            >
                                {state === 'include' && <span className="text-[10px] font-bold">✓</span>}
                                {state === 'exclude' && <span className="text-[10px] font-bold">✕</span>}
                                {opt}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Legend hint — only show on first render when no filter active */}
            {activeCount === 0 && options.length > 0 && (
                <p className="text-[10px] text-zinc-700">Click once to <span className="text-blue-400">include</span> · twice to <span className="text-red-400">exclude</span> · again to clear</p>
            )}
        </div>
    );
}

// ── KeywordSearchBar ──────────────────────────────────────────────────────────
function KeywordSearchBar({
  keywordFilter, setKeywordFilter, totalResults, matchCount,
}: {
  keywordFilter: { include: string[]; exclude: string[] };
  setKeywordFilter: (kf: { include: string[]; exclude: string[] }) => void;
  totalResults: number;
  matchCount: number;
}) {
  const [input, setInput] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const { include, exclude } = keywordFilter;
  const totalChips = include.length + exclude.length;

  const commit = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const isExclude = trimmed.startsWith('-');
    const kw = isExclude ? trimmed.slice(1).trim() : trimmed;
    if (!kw) return;
    if (isExclude) {
      if (!exclude.includes(kw)) setKeywordFilter({ include, exclude: [...exclude, kw] });
    } else {
      if (!include.includes(kw)) setKeywordFilter({ include: [...include, kw], exclude });
    }
    setInput('');
  };

  const removeChip = (type: 'include' | 'exclude', kw: string) => {
    if (type === 'include') setKeywordFilter({ include: include.filter(x => x !== kw), exclude });
    else setKeywordFilter({ include, exclude: exclude.filter(x => x !== kw) });
  };

  // Toggle a chip between include ↔ exclude
  const toggleChip = (type: 'include' | 'exclude', kw: string) => {
    if (type === 'include') {
      setKeywordFilter({ include: include.filter(x => x !== kw), exclude: [...exclude, kw] });
    } else {
      setKeywordFilter({ include: [...include, kw], exclude: exclude.filter(x => x !== kw) });
    }
  };

  const isActive = totalChips > 0;
  const hasFilter = totalResults !== matchCount;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-1.5 px-3 py-2 rounded-xl border transition-colors cursor-text min-h-[42px]',
        isActive
          ? 'bg-zinc-900 border-zinc-700 ring-1 ring-zinc-700'
          : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {/* Search icon */}
      <Search className="w-3.5 h-3.5 text-zinc-600 shrink-0 self-center" />

      {/* Include chips */}
      {include.map(kw => (
        <span key={`inc-${kw}`} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-blue-950 border border-blue-800 text-blue-300 text-xs font-semibold">
          <button
            title="Click to make this an exclusion"
            onClick={e => { e.stopPropagation(); toggleChip('include', kw); }}
            className="opacity-80 hover:opacity-100 text-[10px] font-bold mr-0.5"
          >✓</button>
          {kw}
          <button onClick={e => { e.stopPropagation(); removeChip('include', kw); }} className="opacity-60 hover:opacity-100 ml-0.5 text-sm leading-none">×</button>
        </span>
      ))}

      {/* Exclude chips */}
      {exclude.map(kw => (
        <span key={`exc-${kw}`} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-red-950 border border-red-800 text-red-300 text-xs font-semibold">
          <button
            title="Click to make this an inclusion"
            onClick={e => { e.stopPropagation(); toggleChip('exclude', kw); }}
            className="opacity-80 hover:opacity-100 text-[10px] font-bold mr-0.5"
          >✕</button>
          {kw}
          <button onClick={e => { e.stopPropagation(); removeChip('exclude', kw); }} className="opacity-60 hover:opacity-100 ml-0.5 text-sm leading-none">×</button>
        </span>
      ))}

      {/* Text input */}
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
            e.preventDefault();
            commit(input);
          } else if (e.key === 'Backspace' && !input && totalChips > 0) {
            // Remove last chip
            if (exclude.length > 0) setKeywordFilter({ include, exclude: exclude.slice(0, -1) });
            else setKeywordFilter({ include: include.slice(0, -1), exclude });
          }
        }}
        placeholder={
          totalChips === 0
            ? 'Keyword search within results… (use -word to exclude, comma to add)'
            : 'Add keyword…'
        }
        className="flex-1 min-w-40 bg-transparent text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none self-center py-0.5"
      />

      {/* Right side: match count + clear */}
      <div className="ml-auto flex items-center gap-2 shrink-0">
        {hasFilter && (
          <span className="text-xs text-zinc-500 whitespace-nowrap">
            <span className="font-bold text-zinc-300">{matchCount}</span>
            <span className="text-zinc-600"> / {totalResults}</span>
          </span>
        )}
        {isActive && (
          <button
            onClick={e => { e.stopPropagation(); setKeywordFilter({ include: [], exclude: [] }); setInput(''); }}
            className="text-zinc-600 hover:text-zinc-400 transition-colors"
            title="Clear keyword filter"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── QuickFilterBar ─────────────────────────────────────────────────────────────
function QuickFilterBar({
  filters, setFilters, results, category, onOpenMore,
}: {
  filters: any;
  setFilters: (f: any) => void;
  results: any[];
  category: Category;
  onOpenMore: () => void;
}) {
  const [open, setOpen] = React.useState<string | null>(null);
  const barRef = React.useRef<HTMLDivElement>(null);
  // Lifted search state for DimPopover — prevents reset on pill click
  const [popoverSearch, setPopoverSearch] = React.useState<Record<string, string>>({});
  const getPopoverSearch = (dimKey: string) => popoverSearch[dimKey] || '';
  const setPopoverSearchFor = (dimKey: string, value: string) => setPopoverSearch(prev => ({ ...prev, [dimKey]: value }));

  // Close on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unique = (arr: (string | undefined | null)[]) =>
    Array.from(new Set(arr.filter(Boolean) as string[])).sort();

  const manufacturerOpts = category === 'drug'
    ? unique(results.flatMap(r => (r.patient?.drug || []).flatMap((d: any) => Array.isArray(d.openfda?.manufacturer_name) ? d.openfda.manufacturer_name : [])))
    : category === 'food'
    ? unique(results.flatMap(r => (r.products || []).map((p: any) => p.industry_name)))
    : unique(results.map(r => r.device?.[0]?.manufacturer_d_name));
  const deviceNameOpts = category === 'drug'
    ? unique(results.flatMap(r => (r.patient?.drug || []).map((d: any) => Array.isArray(d.openfda?.brand_name) ? d.openfda.brand_name[0] : d.medicinalproduct).filter(Boolean)))
    : category === 'food'
    ? unique(results.flatMap(r => (r.products || []).map((p: any) => p.name_brand)))
    : category === 'tobacco'
    ? unique(results.flatMap(r => r.tobacco_products || []))
    : unique(results.map(r => r.device?.[0]?.generic_name));
  const patientProblemOpts = unique(results.flatMap(r => { const p = parseReport(category, r); return (p.patientProblems ?? []) as string[]; }));
  const productProblemOpts = unique(results.flatMap(r => { const p = parseReport(category, r); return (p.deviceProblems ?? []) as string[]; }));
  const productCodeOpts = category === 'device'
    ? unique(results.map(r => r.device?.[0]?.device_report_product_code))
    : [];

  // Count active per section
  const countDim = (d: { include: string[]; exclude: string[] }) => d.include.length + d.exclude.length;
  const dateActive = (filters.startDate ? 1 : 0) + (filters.endDate ? 1 : 0);
  const totalActive = countDim(filters.manufacturers) + countDim(filters.productProblems) + countDim(filters.patientProblems) + countDim(filters.deviceNames) + countDim(filters.productCodes) + dateActive;

  type Dim = { include: string[]; exclude: string[] };

  // Chip cycling: neutral → include → exclude → neutral
  const cycleDim = (dim: Dim, opt: string): Dim => {
    if (dim.include.includes(opt)) return { include: dim.include.filter(x => x !== opt), exclude: [...dim.exclude, opt] };
    if (dim.exclude.includes(opt)) return { include: dim.include, exclude: dim.exclude.filter(x => x !== opt) };
    return { include: [...dim.include, opt], exclude: dim.exclude };
  };
  const stateOf = (dim: Dim, opt: string) =>
    dim.include.includes(opt) ? 'include' : dim.exclude.includes(opt) ? 'exclude' : 'neutral';

  // Popover for a dimension — render function (NOT a component) to preserve DOM/scroll across re-renders
  const renderDimPopover = (dimKey: string, opts: string[], dim: Dim, accent = 'blue') => {
    const search = getPopoverSearch(dimKey);
    const setSearch = (v: string) => setPopoverSearchFor(dimKey, v);
    const filtered = opts.filter(o => o.toLowerCase().includes(search.toLowerCase()));
    const accentInclude = accent === 'blue' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-violet-600 border-violet-500 text-white';
    return (
      <div className="p-3 space-y-2">
        {opts.length > 6 && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600 pointer-events-none" />
            <input
              autoFocus
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full pl-8 pr-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
            />
            {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400"><X className="w-3 h-3" /></button>}
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button onClick={() => setFilters({ ...filters, [dimKey]: { include: [...new Set([...dim.include, ...filtered])], exclude: dim.exclude.filter(e => !filtered.includes(e)) } })} className="text-[10px] text-zinc-600 hover:text-zinc-300">
              {search ? `Select visible (${filtered.length})` : 'Select all'}
            </button>
            <span className="text-zinc-700">·</span>
            <button onClick={() => setFilters({ ...filters, [dimKey]: { include: [], exclude: [] } })} className="text-[10px] text-zinc-600 hover:text-zinc-300">Clear</button>
          </div>
          <p className="text-[10px] text-zinc-700">✓ include · ✕ exclude</p>
        </div>
        <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto pr-1">
          {filtered.length === 0 && <p className="text-xs text-zinc-600 italic">No matches</p>}
          {filtered.map(opt => {
            const state = stateOf(dim, opt);
            return (
              <button key={opt}
                onClick={() => setFilters({ ...filters, [dimKey]: cycleDim(dim, opt) })}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-semibold border transition-all flex items-center gap-1',
                  state === 'include' ? accentInclude
                  : state === 'exclude' ? 'bg-red-950 border-red-700 text-red-300'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                )}>
                {state === 'include' && <span className="text-[10px] font-bold">✓</span>}
                {state === 'exclude' && <span className="text-[10px] font-bold">✕</span>}
                {opt.length > 38 ? opt.slice(0,36)+'…' : opt}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  interface QuickFilterConfig { id: string; label: string; count: number; }
  const manufacturerLabel = category === 'food' ? 'Industry' : category === 'drug' ? 'Manufacturer' : 'Manufacturer';
  const deviceNameLabel = category === 'drug' ? 'Drug' : category === 'food' ? 'Product' : category === 'tobacco' ? 'Product' : 'Device Type';
  const productProblemsLabel = category === 'drug' ? 'Seriousness' : category === 'food' ? 'Outcomes' : category === 'tobacco' ? 'Health Problems' : 'Product Problems';
  const patientProblemsLabel = category === 'drug' ? 'Reactions' : category === 'food' ? 'Reactions' : category === 'tobacco' ? 'Health Problems' : 'Patient Problems';
  const quickFilters: QuickFilterConfig[] = [
    { id: 'date',            label: 'Date',                  count: dateActive },
    { id: 'manufacturers',   label: manufacturerLabel,        count: countDim(filters.manufacturers) },
    ...(productCodeOpts.length > 0 ? [{ id: 'productCodes', label: 'Product Code', count: countDim(filters.productCodes) }] : []),
    { id: 'productProblems', label: productProblemsLabel,     count: countDim(filters.productProblems) },
    { id: 'patientProblems', label: patientProblemsLabel,     count: countDim(filters.patientProblems) },
    { id: 'deviceNames',     label: deviceNameLabel,          count: countDim(filters.deviceNames) },
  ];

  // All active chips for removal row
  const activeChips: { label: string; dimKey: string; value: string; type: 'include' | 'exclude' }[] = [
    ...(['manufacturers', 'productCodes', 'productProblems', 'patientProblems', 'deviceNames'] as const).flatMap(k =>
      [
        ...filters[k].include.map((v: string) => ({ label: v, dimKey: k, value: v, type: 'include' as const })),
        ...filters[k].exclude.map((v: string) => ({ label: v, dimKey: k, value: v, type: 'exclude' as const })),
      ]
    ),
  ];

  return (
    <div ref={barRef} className="space-y-2">
      {/* Bar */}
      <div className="flex items-center gap-1.5 flex-wrap bg-zinc-900/60 border border-zinc-800 rounded-xl px-3 py-2">
        <Filter className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
        {quickFilters.map(qf => {
          const isOpen = open === qf.id;
          const isActive = qf.count > 0;
          return (
            <div key={qf.id} className="relative">
              <button
                onClick={() => setOpen(isOpen ? null : qf.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all',
                  isOpen ? 'bg-zinc-800 border-zinc-600 text-zinc-100' :
                  isActive ? 'bg-blue-950 border-blue-800 text-blue-300' :
                  'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
                )}
              >
                {qf.id === 'date' && <Calendar className="w-3 h-3" />}
                {qf.label}
                {isActive && (
                  <span className="px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[9px] font-bold leading-none">{qf.count}</span>
                )}
                <ChevronDown className={cn('w-3 h-3 text-zinc-600 transition-transform', isOpen && 'rotate-180')} />
              </button>

              {/* Popover */}
              {isOpen && (
                <div className="absolute left-0 top-full mt-1.5 z-40 bg-zinc-950 border border-zinc-700 rounded-xl shadow-2xl min-w-[280px] max-w-[360px]">
                  {qf.id === 'date' ? (
                    <div className="p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-300">Date Range</span>
                        {(filters.startDate || filters.endDate) && (
                          <button onClick={() => setFilters({ ...filters, startDate: '', endDate: '' })} className="text-[10px] text-zinc-600 hover:text-zinc-300">Clear</button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">From</label>
                          <input type="date" value={filters.startDate}
                            onChange={e => setFilters({ ...filters, startDate: e.target.value })}
                            className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs focus:outline-none focus:border-blue-500 text-zinc-300"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">To</label>
                          <input type="date" value={filters.endDate}
                            onChange={e => setFilters({ ...filters, endDate: e.target.value })}
                            className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs focus:outline-none focus:border-blue-500 text-zinc-300"
                          />
                        </div>
                      </div>
                      {/* Quick presets */}
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { label: 'Last year', from: `${new Date().getFullYear()-1}-01-01`, to: `${new Date().getFullYear()-1}-12-31` },
                          { label: 'Last 2 yrs', from: `${new Date().getFullYear()-2}-01-01`, to: '' },
                          { label: 'Last 5 yrs', from: `${new Date().getFullYear()-5}-01-01`, to: '' },
                          { label: '2020–2024', from: '2020-01-01', to: '2024-12-31' },
                        ].map(p => (
                          <button key={p.label}
                            onClick={() => setFilters({ ...filters, startDate: p.from, endDate: p.to })}
                            className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
                          >{p.label}</button>
                        ))}
                      </div>
                    </div>
                  ) : qf.id === 'manufacturers' ? (
                    renderDimPopover('manufacturers', manufacturerOpts, filters.manufacturers)
                  ) : qf.id === 'productCodes' ? (
                    renderDimPopover('productCodes', productCodeOpts, filters.productCodes)
                  ) : qf.id === 'productProblems' ? (
                    renderDimPopover('productProblems', productProblemOpts, filters.productProblems, 'violet')
                  ) : qf.id === 'patientProblems' ? (
                    renderDimPopover('patientProblems', patientProblemOpts, filters.patientProblems, 'violet')
                  ) : (
                    renderDimPopover('deviceNames', deviceNameOpts, filters.deviceNames)
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* More filters */}
        <button
          onClick={() => { setOpen(null); onOpenMore(); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 text-xs font-semibold text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-colors ml-auto"
        >
          ··· More filters
          {(() => {
            const extra = [filters.eventTypes, filters.sexes, filters.eventLocations, filters.reportSources, filters.reporterStates].reduce((a: number, d: any) => a + d.include.length + d.exclude.length, 0) + (filters.limit !== 500 ? 1 : 0) + (filters.searchField !== 'auto' ? 1 : 0);
            return extra > 0 ? <span className="px-1.5 py-0.5 rounded-full bg-zinc-700 text-zinc-300 text-[9px] font-bold">{extra}</span> : null;
          })()}
        </button>

        {/* Clear all */}
        {totalActive > 0 && (
          <button
            onClick={() => setFilters((f: any) => ({ ...f, manufacturers: { include:[], exclude:[] }, productCodes: { include:[], exclude:[] }, productProblems: { include:[], exclude:[] }, patientProblems: { include:[], exclude:[] }, deviceNames: { include:[], exclude:[] }, startDate: '', endDate: '' }))}
            className="text-[10px] text-zinc-700 hover:text-red-400 transition-colors ml-1"
            title="Clear quick filters"
          >
            Clear ({totalActive})
          </button>
        )}
      </div>

      {/* Active chip row */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {activeChips.map((chip, i) => (
            <span key={i} className={cn(
              'flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border',
              chip.type === 'include' ? 'bg-blue-950 border-blue-800 text-blue-300' : 'bg-red-950 border-red-800 text-red-300'
            )}>
              {chip.type === 'include' ? '✓' : '✕'} {chip.label.length > 35 ? chip.label.slice(0,33)+'…' : chip.label}
              <button
                onClick={() => setFilters((f: any) => ({
                  ...f,
                  [chip.dimKey]: {
                    include: f[chip.dimKey].include.filter((x: string) => x !== chip.value),
                    exclude: f[chip.dimKey].exclude.filter((x: string) => x !== chip.value),
                  }
                }))}
                className="opacity-60 hover:opacity-100 ml-0.5"
              >×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function FiltersModal({
    filters, setFilters, onClose, results, category
}: {
    filters: any;
    setFilters: any;
    onClose: () => void;
    results: any[];
    category: Category;
}) {
    const unique = (arr: (string | undefined | null)[]) =>
        Array.from(new Set(arr.filter(Boolean) as string[])).sort();

    const eventTypeOpts = unique(results.flatMap(r => { const p = parseReport(category, r); return p.events; }));
    const manufacturerOpts = category === 'drug'
      ? unique(results.flatMap(r => (r.patient?.drug || []).flatMap((d: any) => Array.isArray(d.openfda?.manufacturer_name) ? d.openfda.manufacturer_name : [])))
      : category === 'food'
      ? unique(results.flatMap(r => (r.products || []).map((p: any) => p.industry_name)))
      : unique(results.map(r => r.device?.[0]?.manufacturer_d_name));
    const deviceNameOpts = category === 'drug'
      ? unique(results.flatMap(r => (r.patient?.drug || []).map((d: any) => Array.isArray(d.openfda?.brand_name) ? d.openfda.brand_name[0] : d.medicinalproduct).filter(Boolean)))
      : category === 'food'
      ? unique(results.flatMap(r => (r.products || []).map((p: any) => p.name_brand)))
      : category === 'tobacco'
      ? unique(results.flatMap(r => r.tobacco_products || []))
      : unique(results.map(r => r.device?.[0]?.generic_name));
    const eventLocationOpts = category === 'drug'
      ? unique(results.map(r => r.primarysourcecountry || r.occurcountry))
      : category === 'food' || category === 'tobacco'
      ? []
      : unique(results.map(r => r.event_location));
    const reportSourceOpts = category === 'drug'
      ? unique(results.map(r => { const qualMap: Record<string, string> = { '1': 'Physician', '2': 'Pharmacist', '3': 'Health Professional', '4': 'Lawyer', '5': 'Consumer' }; return qualMap[r.primarysource?.qualification] || r.primarysource?.qualification || ''; }))
      : category === 'food' || category === 'tobacco'
      ? []
      : unique(results.map(r => r.report_source_code));
    const reporterStateOpts = category === 'drug'
      ? unique(results.map(r => r.serious === '1' ? 'Serious' : 'Non-serious'))
      : category === 'tobacco'
      ? unique(results.map(r => r.nonuser_affected === 'Yes' ? 'Yes' : 'No'))
      : category === 'food'
      ? []
      : unique(results.map(r => r.reporter_state_code));
    const sexOpts = unique(results.map(r => { const p = parseReport(category, r); return p.patient?.sex; }));

    const EMPTY_FILTERS = {
        eventTypes: { include: [], exclude: [] },
        manufacturers: { include: [], exclude: [] },
        deviceNames: { include: [], exclude: [] },
        eventLocations: { include: [], exclude: [] },
        reportSources: { include: [], exclude: [] },
        reporterStates: { include: [], exclude: [] },
        sexes: { include: [], exclude: [] },
        patientProblems: { include: [], exclude: [] },
        productProblems: { include: [], exclude: [] },
        productCodes: { include: [], exclude: [] },
        searchField: 'auto',
        startDate: '', endDate: '', limit: 500,
    };

    const fieldGroups = SEARCH_FIELD_GROUPS[category] ?? {};
    const fieldGroupEntries = Object.entries(fieldGroups);

    const patientProblemOpts = unique(results.flatMap(r => { const p = parseReport(category, r); return (p.patientProblems ?? []) as string[]; }));
    const productProblemOpts = unique(results.flatMap(r => { const p = parseReport(category, r); return (p.deviceProblems ?? []) as string[]; }));
    const productCodeOpts = category === 'device'
      ? unique(results.map(r => r.device?.[0]?.device_report_product_code))
      : [];

    const dims = [filters.eventTypes, filters.manufacturers, filters.deviceNames, filters.eventLocations, filters.reportSources, filters.reporterStates, filters.sexes, filters.patientProblems, filters.productProblems, filters.productCodes];
    const activeCount = dims.reduce((a: number, d: any) => a + d.include.length + d.exclude.length, 0)
        + (filters.startDate ? 1 : 0) + (filters.endDate ? 1 : 0) + (filters.limit !== 500 ? 1 : 0)
        + (filters.searchField !== 'auto' ? 1 : 0);

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-zinc-950/70 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-zinc-950 rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-xl max-h-[90vh] overflow-hidden flex flex-col border border-zinc-800"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
                    <div className="flex items-center gap-3">
                        <Filter className="w-4 h-4 text-zinc-400" />
                        <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">Filter Results</h2>
                        {activeCount > 0 && (
                            <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{activeCount} active</span>
                        )}
                    </div>
                    <button onClick={onClose} className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Scrollable body */}
                <div className="overflow-y-auto flex-1 p-5 space-y-5">

                    {/* Search Field Selector */}
                    {fieldGroupEntries.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Search Field</label>
                                {filters.searchField !== 'auto' && (
                                    <button onClick={() => setFilters({ ...filters, searchField: 'auto' })} className="text-[10px] text-zinc-500 hover:text-zinc-300">
                                        Reset to Auto
                                    </button>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                <button
                                    onClick={() => setFilters({ ...filters, searchField: 'auto' })}
                                    className={cn('px-2.5 py-1 rounded-full text-xs font-semibold border transition-all',
                                        filters.searchField === 'auto'
                                            ? 'bg-violet-600 border-violet-500 text-white'
                                            : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                                    )}
                                >
                                    ✦ Auto-detect
                                </button>
                                {fieldGroupEntries.map(([key, { label }]) => (
                                    <button
                                        key={key}
                                        onClick={() => setFilters({ ...filters, searchField: filters.searchField === key ? 'auto' : key })}
                                        className={cn('px-2.5 py-1 rounded-full text-xs font-semibold border transition-all',
                                            filters.searchField === key
                                                ? 'bg-blue-600 border-blue-500 text-white'
                                                : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                                        )}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <p className="text-[10px] text-zinc-700 mt-1.5">
                                {filters.searchField === 'auto'
                                    ? 'Query shape is analysed automatically — long numbers → report #, short uppercase → product code, etc.'
                                    : `All queries will search the “${fieldGroups[filters.searchField]?.label}” field only.`}
                            </p>
                        </div>
                    )}

                    <div className="border-t border-zinc-800" />

                    {/* Date + Limit row */}
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Max Results</label>
                            <select
                                value={filters.limit}
                                onChange={e => setFilters({ ...filters, limit: e.target.value === 'All' ? 'All' : parseInt(e.target.value) })}
                                className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs focus:outline-none focus:border-blue-500 text-zinc-300 font-medium"
                            >
                                <option value={100}>100</option>
                                <option value={500}>500</option>
                                <option value={1000}>1,000</option>
                                <option value={2000}>2,000</option>
                                <option value="All">All</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Date From</label>
                            <input type="date" value={filters.startDate}
                                onChange={e => setFilters({ ...filters, startDate: e.target.value })}
                                className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs focus:outline-none focus:border-blue-500 text-zinc-300"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Date To</label>
                            <input type="date" value={filters.endDate}
                                onChange={e => setFilters({ ...filters, endDate: e.target.value })}
                                className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs focus:outline-none focus:border-blue-500 text-zinc-300"
                            />
                        </div>
                    </div>

                    <div className="border-t border-zinc-800" />

                    <FilterDimGroup label={category === 'drug' ? 'Reaction (MedDRA)' : category === 'food' || category === 'tobacco' ? 'Reactions / Health Problems' : 'Event Type'} options={eventTypeOpts} dim={filters.eventTypes}
                        onChange={d => setFilters({ ...filters, eventTypes: d })} />
                    <div className="border-t border-zinc-800/50" />
                    {category !== 'tobacco' && (
                      <>
                        <FilterDimGroup label="Patient Sex" options={sexOpts} dim={filters.sexes}
                            onChange={d => setFilters({ ...filters, sexes: d })} />
                        <div className="border-t border-zinc-800/50" />
                      </>
                    )}
                    {patientProblemOpts.length > 0 && (
                        <>
                        <FilterDimGroup label={category === 'drug' ? 'Reactions' : category === 'food' ? 'Reactions' : category === 'tobacco' ? 'Health Problems' : 'Patient Problems'} options={patientProblemOpts} dim={filters.patientProblems}
                            onChange={d => setFilters({ ...filters, patientProblems: d })} />
                        <div className="border-t border-zinc-800/50" />
                        </>
                    )}
                    {productProblemOpts.length > 0 && (
                        <>
                        <FilterDimGroup label={category === 'drug' ? 'Seriousness' : category === 'food' ? 'Outcomes' : category === 'tobacco' ? 'Products' : 'Product Problems'} options={productProblemOpts} dim={filters.productProblems}
                            onChange={d => setFilters({ ...filters, productProblems: d })} />
                        <div className="border-t border-zinc-800/50" />
                        </>
                    )}
                    {manufacturerOpts.length > 0 && (
                      <>
                        <FilterDimGroup label={category === 'food' ? 'Industry / Category' : 'Manufacturer'} options={manufacturerOpts} dim={filters.manufacturers}
                            onChange={d => setFilters({ ...filters, manufacturers: d })} />
                        <div className="border-t border-zinc-800/50" />
                      </>
                    )}
                    {deviceNameOpts.length > 0 && (
                      <>
                        <FilterDimGroup label={category === 'drug' ? 'Drug / Brand Name' : category === 'food' ? 'Brand Name' : category === 'tobacco' ? 'Product Type' : 'Device Type'} options={deviceNameOpts} dim={filters.deviceNames}
                            onChange={d => setFilters({ ...filters, deviceNames: d })} />
                        <div className="border-t border-zinc-800/50" />
                      </>
                    )}
                    {productCodeOpts.length > 0 && (
                      <>
                        <FilterDimGroup label="Product Code" options={productCodeOpts} dim={filters.productCodes}
                            onChange={d => setFilters({ ...filters, productCodes: d })} />
                        <div className="border-t border-zinc-800/50" />
                      </>
                    )}
                    {eventLocationOpts.length > 0 && (
                      <>
                        <FilterDimGroup label={category === 'drug' ? 'Country' : 'Event Location'} options={eventLocationOpts} dim={filters.eventLocations}
                            onChange={d => setFilters({ ...filters, eventLocations: d })} />
                        <div className="border-t border-zinc-800/50" />
                      </>
                    )}
                    {reportSourceOpts.length > 0 && (
                      <>
                        <FilterDimGroup label={category === 'drug' ? 'Reporter Qualification' : 'Report Source'} options={reportSourceOpts} dim={filters.reportSources}
                            onChange={d => setFilters({ ...filters, reportSources: d })} />
                        <div className="border-t border-zinc-800/50" />
                      </>
                    )}
                    {reporterStateOpts.length > 0 && (
                      <>
                        <FilterDimGroup label={category === 'drug' ? 'Seriousness' : category === 'tobacco' ? 'Non-user Affected' : 'Reporter State'} options={reporterStateOpts} dim={filters.reporterStates}
                            onChange={d => setFilters({ ...filters, reporterStates: d })} />
                      </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-zinc-800 flex justify-between items-center shrink-0 bg-zinc-950">
                    <button
                        onClick={() => setFilters(EMPTY_FILTERS)}
                        className="px-4 py-2 text-sm font-semibold text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                        Clear All
                    </button>
                    <button
                        onClick={onClose}
                        className="px-5 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow transition-colors"
                    >
                        Apply Filters
                    </button>
                </div>
            </div>
        </div>
    );
}

