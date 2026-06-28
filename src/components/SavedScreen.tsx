import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useStore } from '../store';
import { formatDate, cn } from '../lib/utils';
import {
    FolderOpen, Plus, Trash2, FileText, Bookmark,
    Archive, Pencil, Check, X, AlertTriangle, ChevronDown,
    ChevronLeft, ChevronRight, PanelLeftClose, PanelLeft,
    Download, Share2,
} from 'lucide-react';
import ReportModal from './ReportModal';
import { exportSingleReportToPDF, exportSingleReportToDOCX, exportFolderToXLSX, exportFolderToPDF, exportFolderToDOCX } from '../lib/export';
import { createShareLink, copyToClipboard } from '../lib/share';
import ShareLinkDialog from './ShareLinkDialog';

// ── Special folder constant ────────────────────────────────────────────────────
const ARCHIVE_ID = 'archive';
const DEFAULT_FOLDER_W = 220;
const DEFAULT_LIST_W = 268;
const MIN_W = 120;          // minimum usable width before snap-collapse
const SNAP_THRESHOLD = 60;  // below this, snap to collapsed

// ── Tiny confirmation dialog ───────────────────────────────────────────────────
function ConfirmDialog({
    message, onConfirm, onCancel,
}: { message: string; onConfirm: () => void; onCancel: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm" onClick={onCancel}>
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl p-6 w-80 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
                <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-zinc-200 leading-relaxed">{message}</p>
                </div>
                <div className="flex gap-2 justify-end">
                    <button onClick={onCancel} className="px-4 py-1.5 text-sm font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button onClick={onConfirm} className="px-4 py-1.5 text-sm font-semibold bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors">
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Drag-resize divider ────────────────────────────────────────────────────────
function ResizeDivider({
    onDragStart,
    collapsed,
    onToggle,
    side = 'right',
}: {
    onDragStart: (e: React.MouseEvent) => void;
    collapsed: boolean;
    onToggle: () => void;
    side?: 'right' | 'left';
}) {
    const [hovered, setHovered] = useState(false);
    return (
        <div
            className="relative shrink-0 flex items-center justify-center z-20"
            style={{ width: 0 }}
        >
            {/* Invisible wide grab zone */}
            <div
                className="absolute inset-y-0 cursor-col-resize"
                style={{ left: -6, width: 12 }}
                onMouseDown={onDragStart}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
            />

            {/* Visual highlight on hover */}
            <div
                className="absolute inset-y-0 w-px transition-all duration-150 pointer-events-none"
                style={{
                    background: hovered ? '#3b82f6' : '#27272a',
                    left: 0,
                }}
            />

            {/* Collapse / expand toggle button — sits in the middle of the divider */}
            <button
                onClick={onToggle}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                className={cn(
                    'absolute z-30 flex items-center justify-center w-5 h-8 rounded border transition-all duration-150',
                    hovered || collapsed
                        ? 'bg-zinc-800 border-zinc-600 text-zinc-300 opacity-100'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-600 opacity-0 hover:opacity-100',
                )}
                style={{ left: -10 }}
                title={collapsed ? 'Expand panel' : 'Collapse panel'}
            >
                {collapsed
                    ? (side === 'right' ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />)
                    : (side === 'right' ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />)
                }
            </button>
        </div>
    );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function SavedScreen({ store, uid, showToast }: { store: ReturnType<typeof useStore>; uid?: string | null; showToast?: (msg: string, type: 'success' | 'error' | 'info') => void }) {
    const { folders, savedReports, addFolder, removeFolder, renameFolder, updateReportNotes, moveReport, removeReport } = store;
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
    const [newFolderName, setNewFolderName] = useState('');
    const [activeReportId, setActiveReportId] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [lastClickedId, setLastClickedId] = useState<string | null>(null);
    const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
    const [archiveOpen, setArchiveOpen] = useState(false);
    const [renaming, setRenaming] = useState<{ id: string; draft: string } | null>(null);
    const renameInputRef = useRef<HTMLInputElement>(null);
    const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const [confirmBulkDelete, setConfirmBulkDelete] = useState<string[] | null>(null);

    // ── Panel widths (desktop only) ──────────────────────────────────────────
    const [folderW, setFolderW] = useState(DEFAULT_FOLDER_W);
    const [listW, setListW] = useState(DEFAULT_LIST_W);
    // Track "last open" width so toggle can restore it
    const prevFolderW = useRef(DEFAULT_FOLDER_W);
    const prevListW = useRef(DEFAULT_LIST_W);

    const folderCollapsed = folderW === 0;
    const listCollapsed = listW === 0;

    const toggleFolder = () => {
        if (folderCollapsed) {
            setFolderW(prevFolderW.current || DEFAULT_FOLDER_W);
        } else {
            prevFolderW.current = folderW;
            setFolderW(0);
        }
    };
    const toggleList = () => {
        if (listCollapsed) {
            setListW(prevListW.current || DEFAULT_LIST_W);
        } else {
            prevListW.current = listW;
            setListW(0);
        }
    };

    // Drag-resize: folder divider
    const startResizeFolder = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        const startX = e.clientX;
        const startW = folderW || DEFAULT_FOLDER_W;
        const onMove = (ev: MouseEvent) => {
            const newW = Math.max(0, startW + ev.clientX - startX);
            if (newW < SNAP_THRESHOLD) {
                setFolderW(0);
            } else {
                setFolderW(Math.min(400, Math.max(MIN_W, newW)));
            }
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, [folderW]);

    // Drag-resize: list divider
    const startResizeList = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        const startX = e.clientX;
        const startW = listW || DEFAULT_LIST_W;
        const onMove = (ev: MouseEvent) => {
            const newW = Math.max(0, startW + ev.clientX - startX);
            if (newW < SNAP_THRESHOLD) {
                setListW(0);
            } else {
                setListW(Math.min(500, Math.max(MIN_W, newW)));
            }
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, [listW]);

    // ── Drag-and-drop ─────────────────────────────────────────────────────────
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
    const dragCounter = useRef<Record<string, number>>({});

    // ── Move and auto-advance ─────────────────────────────────────────────────
    const moveAndAdvance = useCallback((reportIds: string[], targetFolderId: string | null) => {
        // Find next report to select after move
        const currentReports = savedReports.filter(r =>
            selectedFolderId === ARCHIVE_ID ? r.folderId === ARCHIVE_ID
            : selectedFolderId === 'unfiled' ? r.folderId === null
            : r.folderId === selectedFolderId
        );
        const movingSet = new Set(reportIds);
        const remaining = currentReports.filter(r => !movingSet.has(r.id));
        // Pick next: prefer the one after the last selected, else the one before
        const currentIdx = currentReports.findIndex(r => r.id === activeReportId);
        let nextId: string | null = null;
        if (remaining.length > 0) {
            // Find the next remaining report after current position
            for (let i = currentIdx + 1; i < currentReports.length; i++) {
                if (!movingSet.has(currentReports[i].id)) { nextId = currentReports[i].id; break; }
            }
            // If nothing after, try before
            if (!nextId) {
                for (let i = currentIdx - 1; i >= 0; i--) {
                    if (!movingSet.has(currentReports[i].id)) { nextId = currentReports[i].id; break; }
                }
            }
        }
        // Perform the moves
        for (const id of reportIds) moveReport(id, targetFolderId);
        setActiveReportId(nextId);
        setSelectedIds(new Set());
    }, [savedReports, selectedFolderId, activeReportId, moveReport]);

    // ── Delete key handler ────────────────────────────────────────────────────
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger if user is typing in an input/textarea
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

            if (e.key === 'Delete' || e.key === 'Backspace') {
                const ids = selectedIds.size > 0 ? [...selectedIds]
                    : activeReportId ? [activeReportId] : [];
                if (ids.length > 0) {
                    e.preventDefault();
                    setConfirmBulkDelete(ids);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedIds, activeReportId]);

    const handleAddFolder = (e: React.FormEvent) => {
        e.preventDefault();
        if (newFolderName.trim()) { addFolder(newFolderName.trim()); setNewFolderName(''); }
    };

    const startRename = (id: string, name: string) => {
        setRenaming({ id, draft: name });
        setTimeout(() => renameInputRef.current?.select(), 30);
    };
    const commitRename = () => {
        if (renaming?.draft.trim()) renameFolder(renaming.id, renaming.draft.trim());
        setRenaming(null);
    };

    const askDeleteFolder = (id: string, name: string) => setConfirmDelete({ id, name });
    const confirmDeleteFolder = () => {
        if (confirmDelete) {
            removeFolder(confirmDelete.id);
            if (selectedFolderId === confirmDelete.id) setSelectedFolderId(null);
            setConfirmDelete(null);
        }
    };

    const activeReports = savedReports.filter(r =>
        selectedFolderId === ARCHIVE_ID ? r.folderId === ARCHIVE_ID
        : selectedFolderId === 'unfiled' ? r.folderId === null
        : r.folderId === selectedFolderId
    );
    const activeReport = savedReports.find(r => r.id === activeReportId);
    const archiveCount = savedReports.filter(r => r.folderId === ARCHIVE_ID).length;

    const folderName = (folderId: string | null) =>
        folderId === ARCHIVE_ID ? 'Archive' : !folderId ? 'Uncategorized'
        : folders.find(f => f.id === folderId)?.name ?? 'Uncategorized';

    const onDragStart = (e: React.DragEvent, reportId: string) => {
        // If dragging a selected report, drag all selected; otherwise just this one
        const dragIds = selectedIds.has(reportId) && selectedIds.size > 1
            ? [...selectedIds] : [reportId];
        setDraggingId(reportId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify(dragIds));
        // Show count badge if multi-dragging
        if (dragIds.length > 1) {
            const badge = document.createElement('div');
            badge.textContent = `${dragIds.length} reports`;
            badge.style.cssText = 'padding:4px 12px;background:#3b82f6;color:white;border-radius:8px;font-size:12px;font-weight:600;position:fixed;top:-100px';
            document.body.appendChild(badge);
            e.dataTransfer.setDragImage(badge, 40, 16);
            requestAnimationFrame(() => document.body.removeChild(badge));
        }
    };
    const onDragEnd = () => { setDraggingId(null); setDragOverTarget(null); dragCounter.current = {}; };
    const onFolderDragEnter = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        dragCounter.current[targetId] = (dragCounter.current[targetId] || 0) + 1;
        setDragOverTarget(targetId);
    };
    const onFolderDragLeave = (_e: React.DragEvent, targetId: string) => {
        dragCounter.current[targetId] = (dragCounter.current[targetId] || 1) - 1;
        if (dragCounter.current[targetId] <= 0) {
            dragCounter.current[targetId] = 0;
            setDragOverTarget(prev => prev === targetId ? null : prev);
        }
    };
    const onFolderDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
    const onFolderDrop = (e: React.DragEvent, targetFolderId: string | null) => {
        e.preventDefault();
        const raw = e.dataTransfer.getData('text/plain');
        let ids: string[] = [];
        try { ids = JSON.parse(raw); } catch { ids = raw ? [raw] : []; }
        if (ids.length > 0) moveAndAdvance(ids, targetFolderId);
        setDraggingId(null); setDragOverTarget(null); dragCounter.current = {};
    };
    const isOver = (id: string) => dragOverTarget === id && draggingId !== null;

    const FolderDropZone = ({ targetId, children }: { targetId: string; children: React.ReactNode }) => (
        <div
            onDragEnter={e => onFolderDragEnter(e, targetId)}
            onDragLeave={e => onFolderDragLeave(e, targetId)}
            onDragOver={onFolderDragOver}
            onDrop={e => onFolderDrop(e, targetId === 'unfiled' ? null : targetId)}
            className={cn('rounded-lg transition-all duration-150', isOver(targetId) && 'ring-2 ring-blue-500 ring-offset-1 ring-offset-zinc-950 bg-blue-950/30 scale-[1.02]')}
        >
            {children}
        </div>
    );

    // ── Collapsed stub strip ──────────────────────────────────────────────────
    const CollapsedStrip = ({ label, onExpand, onResizeStart }: { label: string; onExpand: () => void; onResizeStart: (e: React.MouseEvent) => void }) => (
        <div className="hidden md:flex flex-col items-center bg-zinc-950 border-r border-zinc-800 shrink-0 select-none" style={{ width: 28 }}>
            <button
                onClick={onExpand}
                className="flex-1 w-full flex flex-col items-center justify-center gap-1 hover:bg-zinc-900 transition-colors group"
                title={`Expand ${label}`}
            >
                <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-300" />
                <span className="text-[9px] font-bold text-zinc-700 group-hover:text-zinc-400 uppercase tracking-widest"
                    style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                    {label}
                </span>
            </button>
            {/* Resize handle still available on collapsed strip */}
            <div
                className="absolute inset-y-0 right-0 w-1 cursor-col-resize hover:bg-blue-500/30"
                onMouseDown={onResizeStart}
            />
        </div>
    );

    return (
        <>
            {confirmDelete && (
                <ConfirmDialog
                    message={`Delete folder "${confirmDelete.name}"? Reports inside will become Uncategorized.`}
                    onConfirm={confirmDeleteFolder}
                    onCancel={() => setConfirmDelete(null)}
                />
            )}

            <div className="flex h-full bg-zinc-950 overflow-hidden flex-col md:flex-row">

                {/* ── Folders Sidebar ────────────────────────────────────────── */}
                {folderCollapsed ? (
                    <CollapsedStrip label="Folders" onExpand={toggleFolder} onResizeStart={startResizeFolder} />
                ) : (
                    <div
                        className={cn(
                            "bg-zinc-950 border-r border-zinc-800 flex-col z-10 shrink-0 overflow-hidden",
                            selectedFolderId !== null || activeReportId !== null ? "hidden md:flex" : "flex flex-1 md:flex-none",
                        )}
                        style={{ width: folderW, minWidth: folderW, transition: 'width 0.15s ease' }}
                    >
                        <div className="p-4 border-b border-zinc-800 flex items-center justify-between shrink-0">
                            <h2 className="text-sm font-bold tracking-tight text-zinc-100 truncate">Workspace</h2>
                            {draggingId && <span className="text-[10px] text-blue-400 animate-pulse font-bold shrink-0">Drop →</span>}
                        </div>

                        <div className="p-3 border-b border-zinc-800 shrink-0">
                            <form onSubmit={handleAddFolder} className="flex gap-1.5">
                                <input
                                    type="text" value={newFolderName}
                                    onChange={e => setNewFolderName(e.target.value)}
                                    placeholder="New folder…"
                                    className="flex-1 min-w-0 px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs focus:outline-none focus:border-blue-500 text-zinc-300 placeholder:text-zinc-700"
                                />
                                <button type="submit" className="px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg transition-colors shrink-0">
                                    <Plus className="w-3.5 h-3.5" />
                                </button>
                            </form>
                        </div>

                        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                            <FolderDropZone targetId="unfiled">
                                <button
                                    onClick={() => { setSelectedFolderId('unfiled'); setActiveReportId(null); }}
                                    className={cn(
                                        "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-all group",
                                        selectedFolderId === 'unfiled' ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200",
                                        isOver('unfiled') && 'text-blue-300'
                                    )}
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <FileText className={cn("w-3.5 h-3.5 shrink-0", isOver('unfiled') && 'text-blue-400')} />
                                        <span className="truncate">{isOver('unfiled') ? 'Drop here' : 'Uncategorized'}</span>
                                    </div>
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-500 shrink-0 ml-1">
                                        {savedReports.filter(r => r.folderId === null).length}
                                    </span>
                                </button>
                            </FolderDropZone>

                            {folders.map(folder => {
                                const count = savedReports.filter(r => r.folderId === folder.id).length;
                                const over = isOver(folder.id);
                                const isRenaming = renaming?.id === folder.id;
                                return (
                                    <React.Fragment key={folder.id}>
                                    <FolderDropZone targetId={folder.id}>
                                        <div className={cn(
                                            "flex items-center gap-1 px-2.5 py-2 rounded-lg transition-all group",
                                            selectedFolderId === folder.id ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200",
                                            over && 'text-blue-300'
                                        )}>
                                            <FolderOpen className={cn("w-3.5 h-3.5 shrink-0", over && 'text-blue-400')} />
                                            {isRenaming ? (
                                                <input
                                                    ref={renameInputRef} value={renaming.draft}
                                                    onChange={e => setRenaming(r => r ? { ...r, draft: e.target.value } : r)}
                                                    onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(null); }}
                                                    onBlur={commitRename} autoFocus
                                                    className="flex-1 min-w-0 bg-zinc-800 text-zinc-100 text-xs px-1.5 py-0.5 rounded outline-none ring-1 ring-blue-500"
                                                />
                                            ) : (
                                                <button onClick={() => { setSelectedFolderId(folder.id); setActiveReportId(null); }}
                                                    className="flex-1 min-w-0 text-left text-xs font-medium truncate">
                                                    {over ? 'Drop here' : folder.name}
                                                </button>
                                            )}
                                            <div className="flex items-center gap-0.5 shrink-0 ml-auto">
                                                {isRenaming ? (
                                                    <>
                                                        <button onClick={commitRename} className="p-1 text-emerald-400 hover:bg-emerald-950 rounded"><Check className="w-3 h-3" /></button>
                                                        <button onClick={() => setRenaming(null)} className="p-1 text-zinc-500 hover:bg-zinc-800 rounded"><X className="w-3 h-3" /></button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-500">{count}</span>
                                                        <button onClick={e => { e.stopPropagation(); startRename(folder.id, folder.name); }}
                                                            className="opacity-0 group-hover:opacity-100 p-1 hover:text-zinc-200 hover:bg-zinc-800 rounded" title="Rename">
                                                            <Pencil className="w-3 h-3" />
                                                        </button>
                                                        <button onClick={e => { e.stopPropagation(); askDeleteFolder(folder.id, folder.name); }}
                                                            className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 hover:bg-red-950 rounded" title="Delete">
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </FolderDropZone>
                                    </React.Fragment>
                                );
                            })}

                            <div className="pt-2 mt-2 border-t border-zinc-800/60">
                                <FolderDropZone targetId={ARCHIVE_ID}>
                                    <button
                                        onClick={() => { if (archiveCount > 0) { setArchiveOpen(v => !v); setSelectedFolderId(ARCHIVE_ID); setActiveReportId(null); } }}
                                        className={cn(
                                            "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-all group",
                                            selectedFolderId === ARCHIVE_ID ? "bg-zinc-800 text-zinc-300" : "text-zinc-600 hover:bg-zinc-900 hover:text-zinc-400",
                                            isOver(ARCHIVE_ID) && 'text-blue-300 ring-2 ring-blue-500 ring-inset'
                                        )}
                                    >
                                        <Archive className={cn("w-3.5 h-3.5 shrink-0", isOver(ARCHIVE_ID) && 'text-blue-400')} />
                                        <span className="flex-1 text-left truncate">{isOver(ARCHIVE_ID) ? 'Drop to archive' : 'Archive'}</span>
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-600 shrink-0">{archiveCount}</span>
                                        {archiveCount > 0 && <ChevronDown className={cn("w-3 h-3 shrink-0 transition-transform", archiveOpen && 'rotate-180')} />}
                                    </button>
                                </FolderDropZone>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Divider 1: between folders and list ──────────────────── */}
                <ResizeDivider
                    onDragStart={startResizeFolder}
                    collapsed={folderCollapsed}
                    onToggle={toggleFolder}
                    side="right"
                />

                {/* ── Reports List ──────────────────────────────────────────── */}
                {listCollapsed ? (
                    <CollapsedStrip label="Reports" onExpand={toggleList} onResizeStart={startResizeList} />
                ) : (
                    <div
                        className={cn(
                            "bg-zinc-950 border-r border-zinc-800 flex-col shrink-0 overflow-hidden",
                            (selectedFolderId !== null && activeReportId === null) ? "flex" : "hidden md:flex",
                            selectedFolderId === null ? "md:hidden" : "",
                        )}
                        style={{ width: listW, minWidth: listW, transition: 'width 0.15s ease' }}
                    >
                        <div className="p-3 border-b border-zinc-800 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <button onClick={() => setSelectedFolderId(null)} className="md:hidden p-1.5 border border-zinc-800 rounded text-zinc-400">
                                    <ChevronRight className="w-4 h-4 rotate-180" />
                                </button>
                                <h3 className="font-semibold text-zinc-100 line-clamp-1 text-xs">
                                    {selectedFolderId === ARCHIVE_ID ? 'Archive'
                                        : selectedFolderId === 'unfiled' ? 'Uncategorized'
                                        : folders.find(f => f.id === selectedFolderId)?.name ?? ''}
                                </h3>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="text-xs text-zinc-500 shrink-0">
                                    {selectedIds.size > 0 && <span className="text-blue-400 font-bold">{selectedIds.size} selected · </span>}
                                    {activeReports.length}
                                </span>

                                {/* Share folder */}
                                {uid && activeReports.length > 0 && selectedFolderId && selectedFolderId !== 'unfiled' && selectedFolderId !== ARCHIVE_ID && (
                                    <button
                                        onClick={async () => {
                                            const folder = folders.find(f => f.id === selectedFolderId);
                                            if (!folder || !uid) return;
                                            try {
                                                const url = await createShareLink(uid, 'folder', { folder: { folder, reports: activeReports } });
                                                setShareUrl(url);
                                            } catch (err) { console.error('Share folder failed:', err); showToast?.('Failed to share folder', 'info'); }
                                        }}
                                        className="p-1 text-zinc-600 hover:text-blue-400 rounded transition-colors"
                                        title="Share folder"
                                    >
                                        <Share2 className="w-3.5 h-3.5" />
                                    </button>
                                )}

                                {/* Export folder */}
                                {activeReports.length > 0 && (
                                    <div className="relative group">
                                        <button className="p-1 text-zinc-600 hover:text-emerald-400 rounded transition-colors" title="Export folder">
                                            <Download className="w-3.5 h-3.5" />
                                        </button>
                                        <div className="absolute right-0 top-full pt-1 w-36 z-50 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all">
                                            <div className="bg-zinc-900 border border-zinc-700 shadow-xl rounded-lg py-1">
                                                <button onClick={() => { const fn = folderName(selectedFolderId); exportFolderToXLSX(activeReports, fn); }} className="w-full text-left px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">Excel (.xlsx)</button>
                                                <button onClick={() => { const fn = folderName(selectedFolderId); exportFolderToPDF(activeReports, fn); }} className="w-full text-left px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">PDF</button>
                                                <button onClick={() => { const fn = folderName(selectedFolderId); exportFolderToDOCX(activeReports, fn); }} className="w-full text-left px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">Word (.docx)</button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-2 space-y-1.5 relative">
                            {activeReports.length === 0 && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-zinc-600">
                                    <Bookmark className="w-8 h-8 mb-2" />
                                    <p className="text-xs font-semibold text-zinc-500">No reports here</p>
                                    <p className="text-[10px] mt-1">Drag cards or save from search.</p>
                                </div>
                            )}

                            {activeReports.map((report, idx) => {
                                const isDragging = draggingId === report.id;
                                const isSelected = selectedIds.has(report.id);
                                const isMultiDragging = isDragging && selectedIds.has(report.id) && selectedIds.size > 1;
                                const handleClick = (e: React.MouseEvent) => {
                                    if (e.metaKey || e.ctrlKey) {
                                        // Toggle selection
                                        setSelectedIds(prev => {
                                            const next = new Set(prev);
                                            if (next.has(report.id)) next.delete(report.id);
                                            else next.add(report.id);
                                            return next;
                                        });
                                        setLastClickedId(report.id);
                                    } else if (e.shiftKey && lastClickedId) {
                                        // Range select
                                        const startIdx = activeReports.findIndex(r => r.id === lastClickedId);
                                        const endIdx = idx;
                                        const [lo, hi] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
                                        const rangeIds = activeReports.slice(lo, hi + 1).map(r => r.id);
                                        setSelectedIds(prev => new Set([...prev, ...rangeIds]));
                                    } else {
                                        // Normal click — clear multi-select, set active
                                        setSelectedIds(new Set());
                                        setActiveReportId(report.id);
                                        setLastClickedId(report.id);
                                    }
                                };
                                return (
                                    <div
                                        key={report.id}
                                        draggable
                                        onDragStart={e => onDragStart(e, report.id)}
                                        onDragEnd={onDragEnd}
                                        className={cn(
                                            'rounded-lg border transition-all duration-150 relative group select-none',
                                            isSelected ? 'bg-blue-950/40 border-blue-800' :
                                            activeReportId === report.id ? 'bg-zinc-900/60 border-zinc-700' : 'bg-zinc-950 border-zinc-800 hover:border-zinc-600',
                                            (isDragging || (isMultiDragging && isSelected)) && 'opacity-40 scale-95 cursor-grabbing border-blue-700',
                                            !isDragging && 'cursor-grab active:cursor-grabbing'
                                        )}
                                    >
                                        {/* Selection checkbox / drag dots */}
                                        <div className="absolute left-1 top-1/2 -translate-y-1/2 flex flex-col gap-0.5 pointer-events-none">
                                            {isSelected ? (
                                                <div className="w-3.5 h-3.5 rounded bg-blue-600 flex items-center justify-center">
                                                    <Check className="w-2.5 h-2.5 text-white" />
                                                </div>
                                            ) : (
                                                <div className="opacity-0 group-hover:opacity-30">
                                                    {[0,1,2].map(i => <div key={i} className="flex gap-0.5"><div className="w-0.5 h-0.5 rounded-full bg-zinc-400"/><div className="w-0.5 h-0.5 rounded-full bg-zinc-400"/></div>)}
                                                </div>
                                            )}
                                        </div>

                                        <button onClick={handleClick} className="w-full text-left p-2.5 pl-5 block">
                                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                                <span className="font-mono text-[9px] font-bold text-zinc-500 uppercase tracking-widest">{report.category}</span>
                                                <span className="text-[9px] text-zinc-600">{formatDate(report.savedAt)}</span>
                                            </div>
                                            <h4 className="font-bold text-xs text-zinc-100 line-clamp-2 leading-snug">{report.title}</h4>
                                            <p className="text-[10px] text-zinc-500 line-clamp-2 leading-relaxed mt-1">{report.summary}</p>
                                        </button>

                                        {/* Single ⋯ → inline Archive / Delete prompt */}
                                        {confirmRemoveId === report.id ? (
                                            <div className="absolute inset-0 bg-zinc-900/95 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center gap-2 p-2 z-10">
                                                <p className="text-[10px] font-semibold text-zinc-300">Remove this report?</p>
                                                <div className="flex gap-1.5">
                                                    <button onClick={() => { moveAndAdvance([report.id], ARCHIVE_ID); setConfirmRemoveId(null); }}
                                                        className="flex items-center gap-1 px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-[10px] font-semibold">
                                                        <Archive className="w-2.5 h-2.5" /> Archive
                                                    </button>
                                                    <button onClick={() => { removeReport(report.id); if (activeReportId === report.id) setActiveReportId(null); setConfirmRemoveId(null); }}
                                                        className="flex items-center gap-1 px-2.5 py-1.5 bg-red-950 hover:bg-red-900 text-red-400 rounded-lg text-[10px] font-semibold border border-red-900">
                                                        <Trash2 className="w-2.5 h-2.5" /> Delete
                                                    </button>
                                                    <button onClick={() => setConfirmRemoveId(null)}
                                                        className="p-1.5 text-zinc-600 hover:text-zinc-400 rounded-lg">
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={e => { e.stopPropagation(); setConfirmRemoveId(report.id); }}
                                                className="absolute right-1.5 top-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 rounded"
                                                title="Remove…"
                                            >
                                                <span className="text-xs leading-none font-bold">⋯</span>
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── Divider 2: between list and detail ───────────────────── */}
                <ResizeDivider
                    onDragStart={startResizeList}
                    collapsed={listCollapsed}
                    onToggle={toggleList}
                    side="left"
                />

                {/* ── Report Detail ─────────────────────────────────────────── */}
                <div className={cn(
                    "flex-1 bg-zinc-950 flex-col relative overflow-hidden min-w-0",
                    activeReportId !== null ? "flex" : "hidden md:flex"
                )}>
                    {activeReport ? (
                        <div className="flex-1 overflow-y-auto">
                            <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2.5 bg-zinc-950/90 backdrop-blur border-b border-zinc-800">
                                <button onClick={() => setActiveReportId(null)} className="md:hidden flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200">
                                    <ChevronRight className="w-4 h-4 rotate-180" /> Back
                                </button>

                                {/* Quick panel-toggle icons in detail header */}
                                <div className="hidden md:flex items-center gap-1 mr-1">
                                    <button onClick={toggleFolder} title={folderCollapsed ? 'Show folders' : 'Hide folders'}
                                        className="p-1 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors">
                                        {folderCollapsed ? <PanelLeft className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
                                    </button>
                                </div>

                                <div className="flex items-center gap-2 ml-auto">
                                    {(() => {
                                        // Collect IDs to move: selected reports or just the active one
                                        const moveIds = selectedIds.size > 0 ? [...selectedIds] :
                                            activeReport ? [activeReport.id] : [];
                                        const moveCount = moveIds.length;
                                        return (
                                            <>
                                            <div className="relative group">
                                                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs font-semibold text-zinc-400 hover:bg-zinc-800 transition-colors">
                                                    <FolderOpen className="w-3.5 h-3.5" /> Move{moveCount > 1 ? ` (${moveCount})` : ''}
                                                </button>
                                                <div className="absolute right-0 top-full pt-1 w-52 z-20 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all">
                                                  <div className="bg-zinc-900 border border-zinc-800 shadow-xl rounded-lg py-1">
                                                    <button onClick={() => moveAndAdvance(moveIds, null)} className="w-full text-left px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 flex items-center gap-2">
                                                        <FileText className="w-3.5 h-3.5" /> Uncategorized
                                                    </button>
                                                    {folders.map(f => (
                                                        <button key={f.id} onClick={() => moveAndAdvance(moveIds, f.id)} className="w-full text-left px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 flex items-center gap-2">
                                                            <FolderOpen className="w-3.5 h-3.5" /> {f.name}
                                                        </button>
                                                    ))}
                                                    <div className="border-t border-zinc-800 mt-1 pt-1">
                                                        <button onClick={() => moveAndAdvance(moveIds, ARCHIVE_ID)} className="w-full text-left px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-800 flex items-center gap-2">
                                                            <Archive className="w-3.5 h-3.5" /> Archive
                                                        </button>
                                                    </div>
                                                  </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => { removeReport(activeReport.id); setActiveReportId(null); setSelectedIds(new Set()); }}
                                                className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-950 border border-zinc-800 hover:border-red-900 rounded transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>

                                            {/* Share report */}
                                            {uid && (
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            const url = await createShareLink(uid, 'report', { report: activeReport });
                                                            setShareUrl(url);
                                                        } catch (err) { console.error('Share failed:', err); showToast?.('Failed to share', 'info'); }
                                                    }}
                                                    className="p-1.5 text-zinc-500 hover:text-blue-400 hover:bg-blue-950 border border-zinc-800 hover:border-blue-900 rounded transition-colors"
                                                    title="Share report"
                                                >
                                                    <Share2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}

                                            {/* Export report */}
                                            <div className="relative group">
                                                <button className="p-1.5 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-950 border border-zinc-800 hover:border-emerald-900 rounded transition-colors" title="Export report">
                                                    <Download className="w-3.5 h-3.5" />
                                                </button>
                                                <div className="absolute right-0 top-full pt-1 w-36 z-50 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all">
                                                    <div className="bg-zinc-900 border border-zinc-700 shadow-xl rounded-lg py-1">
                                                        <button onClick={() => exportSingleReportToPDF(activeReport)} className="w-full text-left px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">PDF</button>
                                                        <button onClick={() => exportSingleReportToDOCX(activeReport)} className="w-full text-left px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">Word (.docx)</button>
                                                    </div>
                                                </div>
                                            </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>

                            <div className="px-4 pt-2 pb-1 flex items-center gap-1.5 text-[10px] text-zinc-600">
                                <FolderOpen className="w-3 h-3" />
                                <span>{folderName(activeReport.folderId)}</span>
                            </div>

                            <div className="px-4 py-3 border-b border-zinc-800/50">
                                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Investigator Notes</label>
                                <textarea
                                    value={activeReport.notes}
                                    onChange={e => updateReportNotes(activeReport.id, e.target.value)}
                                    placeholder="Add notes, hypotheses or follow-up tasks…"
                                    className="w-full h-20 px-3 py-2.5 border border-zinc-800 rounded-lg bg-zinc-900/50 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none text-zinc-300 text-sm leading-relaxed transition-all placeholder:text-zinc-700"
                                />
                            </div>

                            {activeReport.rawData ? (
                                <ReportModal rawReport={activeReport.rawData} category={activeReport.category} onClose={() => setActiveReportId(null)} store={store} embedded />
                            ) : (
                                <div className="px-4 py-6">
                                    <h2 className="text-xl font-bold text-zinc-100 mb-1">{activeReport.title}</h2>
                                    <p className="text-zinc-400 text-sm leading-relaxed">{activeReport.summary}</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                            <div className="w-14 h-14 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center mb-4">
                                <FileText className="w-7 h-7 text-zinc-600" />
                            </div>
                            <p className="text-sm font-bold text-zinc-300">No report selected</p>
                            <p className="max-w-xs mt-2 text-xs text-zinc-600 leading-relaxed">
                                Select a report to view its details. Drag the dividers ← → to resize panels.
                            </p>
                        </div>
                    )}
                </div>
            </div>
            {shareUrl && <ShareLinkDialog url={shareUrl} onClose={() => setShareUrl(null)} />}

            {/* Bulk delete / archive confirmation modal */}
            {confirmBulkDelete && confirmBulkDelete.length > 0 && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setConfirmBulkDelete(null)} />
                    <div className="relative bg-zinc-900 border border-zinc-700/80 rounded-2xl w-full max-w-sm shadow-2xl p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-red-950/60 border border-red-900/60 flex items-center justify-center">
                                <Trash2 className="w-5 h-5 text-red-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-zinc-100">
                                    {confirmBulkDelete.length === 1 ? 'Remove Report?' : `Remove ${confirmBulkDelete.length} Reports?`}
                                </h3>
                                <p className="text-xs text-zinc-500 mt-0.5">Archive to keep, or delete permanently.</p>
                            </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={() => setConfirmBulkDelete(null)}
                                className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    moveAndAdvance(confirmBulkDelete, ARCHIVE_ID);
                                    setConfirmBulkDelete(null);
                                    showToast?.(`${confirmBulkDelete.length} report${confirmBulkDelete.length > 1 ? 's' : ''} archived`, 'info');
                                }}
                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl transition-all"
                            >
                                <Archive className="w-3.5 h-3.5" />
                                Archive
                            </button>
                            <button
                                onClick={() => {
                                    for (const id of confirmBulkDelete) removeReport(id);
                                    if (activeReportId && confirmBulkDelete.includes(activeReportId)) setActiveReportId(null);
                                    setSelectedIds(new Set());
                                    setConfirmBulkDelete(null);
                                    showToast?.(`${confirmBulkDelete.length} report${confirmBulkDelete.length > 1 ? 's' : ''} deleted`, 'success');
                                }}
                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-red-400 bg-red-950/60 hover:bg-red-900/60 border border-red-900/60 rounded-xl transition-all"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
