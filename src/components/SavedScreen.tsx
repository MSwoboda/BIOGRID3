import React from 'react';
import { useState } from 'react';
import { useStore } from '../store';
import { formatDate, cn } from '../lib/utils';
import { FolderOpen, Plus, Trash2, FileText, ChevronRight, X, Bookmark, MoveRight } from 'lucide-react';

export default function SavedScreen() {
    const { folders, savedReports, addFolder, removeFolder, updateReportNotes, moveReport, removeReport } = useStore();
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
    const [newFolderName, setNewFolderName] = useState('');
    const [activeReportId, setActiveReportId] = useState<string | null>(null);

    const handleAddFolder = (e: React.FormEvent) => {
        e.preventDefault();
        if (newFolderName.trim()) {
            addFolder(newFolderName.trim());
            setNewFolderName('');
        }
    };

    const activeReports = savedReports.filter(r => 
        selectedFolderId === 'unfiled' ? r.folderId === null : r.folderId === selectedFolderId
    );
    const activeReport = savedReports.find(r => r.id === activeReportId);

    return (
        <div className="flex h-full bg-zinc-950 overflow-hidden flex-col md:flex-row">
            {/* Folders Sidebar */}
            <div className={cn(
                "md:w-64 bg-zinc-950 border-r border-zinc-800 flex-col z-10 shrink-0",
                selectedFolderId !== null || activeReportId !== null ? "hidden md:flex" : "flex flex-1 md:flex-none"
            )}>
                <div className="p-6 border-b border-zinc-800 bg-zinc-950/50">
                    <h2 className="text-xl font-bold tracking-tight text-zinc-100">Workspace</h2>
                </div>
                
                <div className="p-4 border-b border-zinc-800">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">My Folders</h3>
                    <form onSubmit={handleAddFolder} className="flex gap-2">
                        <input 
                            type="text" 
                            value={newFolderName}
                            onChange={e => setNewFolderName(e.target.value)}
                            placeholder="New folder..." 
                            className="flex-1 px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                        <button type="submit" className="px-2 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded transition-colors">
                            <Plus className="w-4 h-4" />
                        </button>
                    </form>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-1">
                    <button 
                         onClick={() => { setSelectedFolderId('unfiled'); setActiveReportId(null); }}
                         className={cn(
                             "w-full flex items-center justify-between px-3 py-2 rounded text-sm font-semibold transition-all group",
                             selectedFolderId === 'unfiled' ? "bg-zinc-900 text-zinc-100" : "hover:bg-zinc-950 text-zinc-400 font-medium"
                         )}
                     >
                         <div className="flex items-center gap-2">
                             <FileText className="w-4 h-4" />
                             Unfiled Reports
                         </div>
                         <span className={cn("text-[10px] py-0.5 px-1.5 rounded", selectedFolderId === 'unfiled' ? "bg-zinc-800" : "bg-zinc-900 group-hover:bg-zinc-800")}>
                             {savedReports.filter(r => r.folderId === null).length}
                         </span>
                     </button>

                    {folders.map(folder => {
                        const count = savedReports.filter(r => r.folderId === folder.id).length;
                        return (
                            <button 
                                key={folder.id}
                                onClick={() => { setSelectedFolderId(folder.id); setActiveReportId(null); }}
                                className={cn(
                                    "w-full flex items-center justify-between px-3 py-2 rounded text-sm font-semibold transition-all group",
                                    selectedFolderId === folder.id ? "bg-zinc-900 text-zinc-100" : "hover:bg-zinc-950 text-zinc-400 font-medium"
                                )}
                            >
                                <div className="flex items-center gap-2">
                                    <FolderOpen className="w-4 h-4" />
                                    {folder.name}
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className={cn("text-[10px] py-0.5 px-1.5 rounded", selectedFolderId === folder.id ? "bg-zinc-800" : "bg-zinc-900 group-hover:bg-zinc-800")}>
                                        {count}
                                    </span>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); removeFolder(folder.id); }}
                                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-500 hover:bg-red-950 rounded"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Reports List */}
            <div className={cn(
                "md:w-72 lg:w-80 bg-zinc-950 border-r border-zinc-800 flex-col shrink-0 flex-1 md:flex-none",
                (selectedFolderId !== null && activeReportId === null) ? "flex" : "hidden md:flex",
                selectedFolderId === null ? "md:hidden" : ""
            )}>
                <div className="p-4 border-b border-zinc-800 bg-zinc-950/50 flex items-center justify-between">
                     <div className="flex items-center gap-2">
                         <button onClick={() => setSelectedFolderId(null)} className="md:hidden p-1.5 bg-zinc-950 border rounded text-zinc-400">
                             <ChevronRight className="w-4 h-4 rotate-180" />
                         </button>
                         <h3 className="font-semibold text-zinc-100 line-clamp-1">
                             {selectedFolderId && selectedFolderId !== 'unfiled' ? folders.find(f => f.id === selectedFolderId)?.name : 'Unfiled Reports'}
                         </h3>
                     </div>
                     <span className="text-xs text-zinc-500 font-medium shrink-0">{activeReports.length} items</span>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3 space-y-2 relative">
                    {activeReports.map(report => (
                        <button 
                             key={report.id}
                             onClick={() => setActiveReportId(report.id)}
                             className={cn(
                                 "w-full text-left p-3 rounded-lg border transition-all relative block group",
                                 activeReportId === report.id ? "bg-zinc-900/50 border-zinc-700 shadow-sm" : "bg-zinc-950 border-zinc-800 hover:border-zinc-300 shadow-sm"
                             )}
                        >
                             <div className="flex justify-between items-start mb-1">
                                <span className="font-mono text-[10px] font-semibold text-zinc-100 uppercase tracking-widest">{report.id}</span>
                                <span className="text-[10px] text-zinc-500 font-medium">{formatDate(report.savedAt)}</span>
                             </div>
                             <h4 className="font-bold text-sm text-zinc-100 line-clamp-1 mb-1 mt-1">{report.title}</h4>
                             <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">{report.summary}</p>
                             
                             <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex">
                                <button
                                    onClick={(e) => { e.stopPropagation(); removeReport(report.id); }}
                                    className="p-1 text-zinc-500 hover:text-red-500 hover:bg-red-950 rounded"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                             </div>
                        </button>
                    ))}
                    
                    {activeReports.length === 0 && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-zinc-500">
                             <Bookmark className="w-12 h-12 mb-3 text-zinc-200" />
                             <p className="text-sm">No reports saved in this folder.</p>
                             <p className="text-xs mt-1">Search the database and click "Save" to add reports.</p>
                        </div>
                    )}
                </div>
            </div>

            <div className={cn(
                "flex-1 bg-zinc-950 flex-col relative overflow-hidden flex-1 lg:flex-auto",
                activeReportId !== null ? "flex" : "hidden md:flex"
            )}>
                 {activeReport ? (
                    <div className="flex-1 overflow-y-auto">
                        <div className="max-w-3xl mx-auto p-4 md:p-8 lg:p-12">
                            {/* Actions Header */}
                            <div className="flex items-center justify-between mb-8 pb-6 border-b border-zinc-800">
                                <div className="flex flex-col gap-2">
                                    <button onClick={() => setActiveReportId(null)} className="md:hidden flex items-center gap-1 text-sm text-zinc-500 mb-2">
                                        <ChevronRight className="w-4 h-4 rotate-180" /> Back to list
                                    </button>
                                    <h2 className="text-xl md:text-2xl font-bold text-zinc-50 leading-tight mb-2">{activeReport.title}</h2>
                                    <div className="flex items-center gap-3 text-sm font-medium">
                                        <span className="text-xs font-bold text-zinc-100 uppercase tracking-wider">
                                            {activeReport.category}
                                        </span>
                                        <span className="text-zinc-500 font-mono text-xs">
                                            {activeReport.id}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                     <div className="relative group">
                                         <button className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs font-semibold text-zinc-400 hover:bg-zinc-950 shadow-sm transition-colors">
                                            <FolderOpen className="w-3.5 h-3.5" /> Move
                                         </button>
                                         <div className="absolute right-0 top-full mt-1 w-48 bg-zinc-950 border border-zinc-800 shadow-sm rounded py-1 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-1 pointer-events-none group-hover:pointer-events-auto transition-all z-20">
                                            <button onClick={() => moveReport(activeReport.id, null)} className="w-full text-left px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-950 flex items-center gap-2 font-medium">
                                                <FileText className="w-3.5 h-3.5" /> Unfiled
                                            </button>
                                            {folders.map(f => (
                                                <button key={f.id} onClick={() => moveReport(activeReport.id, f.id)} className="w-full text-left px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-950 flex items-center gap-2 font-medium">
                                                    <FolderOpen className="w-3.5 h-3.5" /> {f.name}
                                                </button>
                                            ))}
                                         </div>
                                     </div>
                                     <button onClick={() => removeReport(activeReport.id)} className="p-1.5 text-zinc-500 hover:text-red-500 hover:bg-red-950 bg-zinc-950 border border-zinc-800 shadow-sm hover:border-red-900 rounded transition-colors">
                                         <Trash2 className="w-3.5 h-3.5" />
                                     </button>
                                </div>
                            </div>
                            
                            {/* Notes Section */}
                            <div className="mb-8">
                                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Investigator Notes</h3>
                                <textarea
                                     value={activeReport.notes}
                                     onChange={(e) => updateReportNotes(activeReport.id, e.target.value)}
                                     placeholder="Add your investigation notes, hypothesis, or follow-up tasks here..."
                                     className="w-full h-40 p-4 border border-zinc-800 rounded bg-zinc-950 shadow-inner focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:bg-zinc-950 outline-none resize-none text-zinc-300 text-sm leading-relaxed transition-all"
                                />
                            </div>
                            
                            {/* Original Data Content */}
                            <div>
                                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Raw Report Summary</h3>
                                <div className="p-5 bg-zinc-950 border border-zinc-800 rounded shadow-sm text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap">
                                    {activeReport.summary}
                                </div>
                            </div>
                            
                            <div className="mt-8 pt-8 border-t border-zinc-800">
                                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                   Technical Source <span className="text-[10px] bg-zinc-900 text-zinc-500 px-1.5 py-0.5 rounded font-mono">JSON</span>
                                </h3>
                                <div className="bg-zinc-900 border border-zinc-800 text-zinc-400 p-4 rounded font-mono text-xs overflow-x-auto shadow-inner">
                                   <pre>{JSON.stringify(activeReport.rawData, null, 2)}</pre>
                                </div>
                            </div>
                        </div>
                    </div>
                 ) : (
                     <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-zinc-500 bg-zinc-950/50">
                         <div className="w-16 h-16 bg-zinc-950 border border-zinc-800 rounded flex items-center justify-center mb-4 shadow-sm">
                             <FileText className="w-8 h-8 text-zinc-300" />
                         </div>
                         <p className="text-base font-bold text-zinc-100">No report selected</p>
                         <p className="max-w-sm mt-2 text-sm leading-relaxed">Select a report from the list to view its details, raw data, and to manage your investigator notes.</p>
                     </div>
                 )}
            </div>
        </div>
    )
}
