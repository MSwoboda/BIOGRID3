import React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Category, SearchResult, CountResult } from './types';
import { fetchFDAData, fetchFDACounts, fetchDeviceRecalls, fetchDeviceRecallCounts, parseReport } from './lib/api';
import { useStore } from './store';
import { cn, formatDate } from './lib/utils';
import { Search, FolderOpen, PieChart, List as ListIcon, Download, Bookmark, AlertTriangle, Clock, Box, Activity, Apple, Cigarette, ChevronDown, ChevronRight, History, PanelLeftClose, PanelLeft, Filter, X, ChevronLeft } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import SavedScreen from './components/SavedScreen';

// --- Subcomponents will be separated shortly, injecting them all in App.tsx for rapid iteration ---

export default function App() {
  const [activeTab, setActiveTab] = useState<'search' | 'history' | 'saved'>('search');
  const [searchCategory, setSearchCategory] = useState<Category>('device');
  const [isDbsOpen, setIsDbsOpen] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const handleSelectCategory = (cat: Category) => {
    setSearchCategory(cat);
    setActiveTab('search');
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-50 font-sans">
      {/* Sidebar */}
      <aside className={cn("bg-zinc-950 border-r border-zinc-800 flex flex-col shadow-sm z-20 shrink-0 transition-all duration-300", isSidebarOpen ? "w-64" : "w-16 items-center")}>
        <div className={cn("p-4 border-b border-zinc-800 flex items-center justify-between tracking-tight flex-shrink-0 h-16 w-full", !isSidebarOpen && "justify-center")}>
          {isSidebarOpen && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-zinc-100 text-zinc-950 hover:bg-zinc-200 flex items-center justify-center text-zinc-50 font-bold text-xl">B</div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-100 uppercase">biogrid</h1>
            </div>
          )}
          {!isSidebarOpen && (
            <div className="w-8 h-8 rounded bg-zinc-100 text-zinc-950 hover:bg-zinc-200 flex items-center justify-center text-zinc-50 font-bold text-lg cursor-pointer" onClick={() => setIsSidebarOpen(true)}>B</div>
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
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="flex-1 overflow-y-auto">
           {activeTab === 'search' && <SearchScreen category={searchCategory} setCategory={setSearchCategory} />}
           {activeTab === 'history' && <HistoryScreen />}
           {activeTab === 'saved' && <SavedScreen />}
        </div>
      </main>
    </div>
  );
}

function SearchScreen({ category, setCategory }: { category: Category, setCategory: (c: Category) => void }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [typesData, setTypesData] = useState<CountResult[]>([]);
  const [timeData, setTimeData] = useState<CountResult[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'graph' | 'recalls'>('list');
  const [recallResults, setRecallResults] = useState<any[]>([]);
  const [recallTimeData, setRecallTimeData] = useState<CountResult[]>([]);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  
  const { searchHistory, addSearchHistory } = useStore();
  const [showSuggestions, setShowSuggestions] = useState(false);

  // New controls
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  
  const [filters, setFilters] = useState({ eventType: '', startDate: '', endDate: '', limit: 500 as number | 'All', sex: '' });
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any>(null);

  useEffect(() => {
    setQuery('');
    setResults([]);
    setTypesData([]);
    setTimeData([]);
    setRecallResults([]);
    setRecallTimeData([]);
    setHasSearched(false);
    setError('');
    setCurrentPage(1);
    setFilters({ eventType: '', startDate: '', endDate: '', limit: 500 as number | 'All', sex: '' });
  }, [category]);

  const categories: { id: Category, label: string, icon: any }[] = [
    { id: 'drug', label: 'Drugs', icon: Activity },
    { id: 'device', label: 'Devices', icon: Box },
    { id: 'food', label: 'Foods', icon: Apple },
    { id: 'tobacco', label: 'Tobacco', icon: Cigarette },
  ];

  const suggestions = searchHistory
      .filter(h => h.category === category && h.query.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 5)
      .map(h => h.query);

  const handleSearch = async (e?: React.FormEvent, explicitQuery?: string) => {
    if (e) e.preventDefault();
    const searchQuery = explicitQuery !== undefined ? explicitQuery : query;
    if (!searchQuery.trim()) return;

    setQuery(searchQuery);
    setShowSuggestions(false);
    setLoading(true);
    setError('');
    setHasSearched(true);
    setResults([]);
    setTypesData([]);
    setTimeData([]);
    setRecallResults([]);
    setRecallTimeData([]);
    setCurrentPage(1);
    
    addSearchHistory(category, searchQuery.trim());

    try {
      fetchFDACounts(category, searchQuery, 'types').then(countsTypes => {
         if (countsTypes?.results) setTypesData(countsTypes.results.slice(0, 10));
      });
      fetchFDACounts(category, searchQuery, 'time').then(countsTime => {
         if (countsTime?.results) setTimeData(countsTime.results);
      });

      if (category === 'device') {
          fetchDeviceRecallCounts(searchQuery, 'time').then(counts => {
             if (counts?.results) setRecallTimeData(counts.results);
          });
          fetchDeviceRecalls(searchQuery, 0, 100).then(recalls => {
             if (recalls?.results) setRecallResults(recalls.results);
          });
      }

      let fetchedResults: any[] = [];
      let skip = 0;
      let limitToFetch = filters.limit === 'All' ? Infinity : (filters.limit as number);

      while (skip < limitToFetch) {
         let toFetch = Math.min(500, limitToFetch - skip);
         const resData = await fetchFDAData(category, searchQuery, skip, toFetch);
         
         if (resData?.results) {
             fetchedResults = [...fetchedResults, ...resData.results];
             setResults(fetchedResults);
             
             if (resData.results.length < toFetch) {
                 break;
             }
             if (skip === 0 && resData.meta?.results?.total) {
                limitToFetch = Math.min(limitToFetch, resData.meta.results.total);
             }
         } else {
             break;
         }
         skip += toFetch;
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
     link.setAttribute("download", `biogrid_${category}_${query}.csv`);
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
  };

  const filteredResults = results.filter(r => {
      const parsed = parseReport(category, r);
      if (filters.eventType && !parsed.events.some(e => e.toLowerCase().includes(filters.eventType.toLowerCase()))) return false;
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
      if (filters.sex && parsed.patient?.sex?.toLowerCase() !== filters.sex.toLowerCase()) return false;
      return true;
  });

  const totalPages = Math.ceil(filteredResults.length / rowsPerPage);
  const paginatedResults = filteredResults.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Top Search Header */}
      <div className="bg-zinc-950 border-b border-zinc-800 p-8 shadow-sm z-10 sticky top-0 flex flex-col gap-6">
        <div className="flex items-start justify-between">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-100">Global Database Search</h2>
        </div>
        
        <form onSubmit={e => handleSearch(e)} className="flex items-center w-full max-w-5xl relative">
            <div className="flex-1 relative flex items-center shadow-sm">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-zinc-500 pointer-events-none" />
                
                <input 
                    type="text" 
                    value={query}
                    onChange={e => {
                        setQuery(e.target.value);
                        setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    placeholder={`Search ${categories.find(c => c.id === category)?.label} by name...`}
                    className="w-full pl-14 pr-32 py-4 bg-zinc-900 border border-zinc-800 rounded-full text-lg focus:outline-none focus:ring-2 focus:ring-zinc-700 text-zinc-100 block transition-all placeholder:text-zinc-500"
                />
                
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2 z-10">
                    <button 
                         type="button" 
                         onClick={() => setShowFiltersModal(true)} 
                         className="p-2.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-full transition-colors flex items-center justify-center relative"
                         title="Filters"
                    >
                        <Filter className="w-5 h-5" />
                        {(filters.eventType || filters.startDate || filters.endDate || filters.sex || filters.limit !== 500) && (
                            <span className="w-2 h-2 rounded-full bg-zinc-100 absolute top-1.5 right-1.5"></span>
                        )}
                    </button>
                    {query.length > 0 && (
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-full transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center"
                        >
                            <Search className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Suggestions Dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden z-20">
                        {suggestions.map((suggestion, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleSearch(undefined, suggestion);
                                }}
                                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-zinc-800 transition-colors border-b border-zinc-800 last:border-b-0"
                            >
                                <History className="w-4 h-4 text-zinc-500" />
                                <span className="text-zinc-100 font-medium">{suggestion}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </form>
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
                {/* View Mode Tabs */}
                <div className="flex bg-zinc-900/50 w-max p-1.5 rounded-xl border border-zinc-800 shadow-sm mx-auto mb-6">
                    <button onClick={() => setViewMode('list')} className={cn("flex items-center gap-2 px-8 py-2 rounded-lg text-sm font-medium transition-all duration-200", viewMode === 'list' ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50')}>
                        <ListIcon className="w-4 h-4" /> List View
                    </button>
                    <button onClick={() => setViewMode('graph')} className={cn("flex items-center gap-2 px-8 py-2 rounded-lg text-sm font-medium transition-all duration-200", viewMode === 'graph' ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50')}>
                        <PieChart className="w-4 h-4" /> Analytics & Graphs
                    </button>
                    {category === 'device' && (
                        <button onClick={() => setViewMode('recalls')} className={cn("flex items-center gap-2 px-8 py-2 rounded-lg text-sm font-medium transition-all duration-200", viewMode === 'recalls' ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50')}>
                            <AlertTriangle className="w-4 h-4" /> Device Recalls
                        </button>
                    )}
                </div>
               {/* Controls Bar */}
               <div className="flex items-center justify-between bg-zinc-950 px-4 py-3 rounded-lg shadow-sm border border-zinc-800 sticky top-0 z-10">
                  <div className="flex items-center gap-3 px-2 text-sm">
                     {loading && <div className="w-4 h-4 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin"></div>}
                     <span>
                        <span className="font-bold text-zinc-100">{filteredResults.length}</span> 
                        <span className="text-zinc-500 ml-1">reports for "<span className="text-zinc-100 font-semibold">{query}</span>"</span>
                     </span>
                  </div>
                  
                  <div className="flex items-center gap-4">
                      {viewMode === 'list' && (
                          <div className="flex items-center gap-2">
                             <span className="text-xs font-semibold text-zinc-500">Rows:</span>
                             <select value={rowsPerPage} onChange={e => {setRowsPerPage(parseInt(e.target.value)); setCurrentPage(1);}} className="bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1 text-xs text-zinc-300 outline-none">
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                             </select>
                          </div>
                      )}
                      
                      <button onClick={exportAsCSV} className="flex items-center gap-2 px-3 py-1.5 border border-zinc-800 text-zinc-400 rounded hover:bg-zinc-950 text-xs font-semibold shadow-sm">
                          <Download className="w-3.5 h-3.5" /> Export
                      </button>
                      
                  </div>
               </div>

               {/* Results Views */}
               {viewMode === 'list' && (
                   <div className="space-y-4">
                       <div className="grid grid-cols-1 gap-4">
                           {paginatedResults.map((r, i) => (
                               <ReportCard key={i} rawReport={r} category={category} onClick={() => setSelectedReport(r)} />
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
                       <div className="bg-zinc-950 p-4 rounded-lg shadow-sm border border-zinc-800">
                           <h3 className="text-sm font-bold text-zinc-100 mb-4 flex items-center gap-2">
                               <AlertTriangle className="w-4 h-4 text-amber-500" />
                               Top Reported Issues
                           </h3>
                           <div className="h-64">
                               <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={typesData} layout="vertical" margin={{ left: 10, right: 30, top: 0, bottom: 0 }}>
                                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#27272a" />
                                      <XAxis type="number" tick={{fontSize: 11, fill: '#a1a1aa'}} />
                                      <YAxis dataKey="term" type="category" width={150} tick={{fontSize: 11, fill: '#a1a1aa'}} />
                                      <Tooltip contentStyle={{ borderRadius: '6px', backgroundColor: '#09090b', border: '1px solid #27272a', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)', fontSize: '12px', color: '#fafaed' }} />
                                      <Bar dataKey="count" fill="#2563eb" radius={[0, 2, 2, 0]}>
                                        {typesData.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={`hsl(217, 91%, ${50 + (index * 4)}%)`} />
                                        ))}
                                      </Bar>
                                  </BarChart>
                               </ResponsiveContainer>
                           </div>
                       </div>
                       
                       <div className="bg-zinc-950 p-4 rounded-lg shadow-sm border border-zinc-800">
                           <h3 className="text-sm font-bold text-zinc-100 mb-4 flex items-center gap-2">
                               <Clock className="w-4 h-4 text-zinc-100" />
                               Reports Over Time
                           </h3>
                           <div className="h-64">
                               <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={timeData.slice(-30)} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                                      <XAxis dataKey="time" tickFormatter={(v) => String(v).substring(0,4)} tick={{fontSize: 11, fill: '#a1a1aa'}} />
                                      <YAxis tick={{fontSize: 11, fill: '#a1a1aa'}} />
                                      <Tooltip labelFormatter={(v) => `Date: ${v}`} contentStyle={{ borderRadius: '6px', backgroundColor: '#09090b', border: '1px solid #27272a', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)', fontSize: '12px', color: '#fafaed' }} />
                                      <Bar dataKey="count" fill="#10b981" radius={[2, 2, 0, 0]} />
                                  </BarChart>
                               </ResponsiveContainer>
                           </div>
                       </div>
                   </div>
               )}
               {viewMode === 'recalls' && (
                   <div className="space-y-6">
                       <div className="bg-zinc-950 p-4 rounded-lg shadow-sm border border-zinc-800">
                           <h3 className="text-sm font-bold text-zinc-100 mb-4 flex items-center gap-2">
                               <Clock className="w-4 h-4 text-zinc-100" />
                               Recalls Over Time (When Issued)
                           </h3>
                           <div className="h-64">
                               <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={recallTimeData.slice(-30)} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                                      <XAxis dataKey="time" tickFormatter={(v) => String(v).substring(0,4)} tick={{fontSize: 11, fill: '#a1a1aa'}} />
                                      <YAxis tick={{fontSize: 11, fill: '#a1a1aa'}} />
                                      <Tooltip labelFormatter={(v) => `Date: ${v}`} contentStyle={{ borderRadius: '6px', backgroundColor: '#09090b', border: '1px solid #27272a', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)', fontSize: '12px', color: '#fafaed' }} />
                                      <Bar dataKey="count" fill="#f43f5e" radius={[2, 2, 0, 0]} />
                                  </BarChart>
                               </ResponsiveContainer>
                           </div>
                       </div>
                       <div className="grid grid-cols-1 gap-4">
                           <h3 className="text-sm font-bold text-zinc-100 mb-2 flex items-center gap-2">
                               Latest Recall Documents
                           </h3>
                           {recallResults.slice(0, 50).map((r, i) => (
                               <div key={i} className="bg-zinc-950 border border-zinc-800 rounded-lg p-5 shadow-sm text-left hover:border-zinc-700 transition">
                                   <div className="flex gap-2 items-start justify-between mb-3">
                                        <h3 className="font-bold text-zinc-100 text-base">{r.product_description || 'Unknown Product'}</h3>
                                        <span className={cn("px-2 py-1 rounded text-xs font-bold uppercase tracking-wider shrink-0", 
                                            r.recall_status === 'Ongoing' ? "bg-amber-950 text-amber-500 border border-amber-900" 
                                            : r.recall_status === 'Terminated' ? "bg-emerald-950 text-emerald-500 border border-emerald-900"
                                            : "bg-zinc-900 text-zinc-400 border border-zinc-700"
                                        )}>
                                            {r.recall_status || 'Unknown'}
                                        </span>
                                   </div>
                                   <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                                       <div><span className="text-zinc-500 font-semibold uppercase text-xs tracking-wider">Recalling Firm:</span> <span className="text-zinc-300">{r.recalling_firm}</span></div>
                                       <div><span className="text-zinc-500 font-semibold uppercase text-xs tracking-wider">Date Initiated:</span> <span className="text-zinc-300">{formatDate(r.event_date_initiated)}</span></div>
                                   </div>
                                   <div>
                                       <span className="text-zinc-500 font-semibold uppercase text-xs tracking-wider block mb-1">Reason for Recall:</span>
                                       <p className="text-zinc-300 text-sm leading-relaxed">{r.reason_for_recall || 'No reason provided'}</p>
                                   </div>
                               </div>
                           ))}
                           {recallResults.length === 0 && !loading && (
                               <div className="text-center py-10 text-zinc-500 font-medium bg-zinc-950 rounded-lg border border-zinc-800">No recalls found matching your filters.</div>
                           )}
                       </div>
                   </div>
               )}
            </div>
         )}
         
         {showFiltersModal && <FiltersModal filters={filters} setFilters={setFilters} onClose={() => setShowFiltersModal(false)} />}
         {selectedReport && <ReportModal rawReport={selectedReport} category={category} onClose={() => setSelectedReport(null)} />}
      </div>
    </div>
  );
}

const ReportCard: React.FC<{ rawReport: any, category: Category, onClick?: () => void }> = ({ rawReport, category, onClick }) => {
    const { saveReport, folders } = useStore();
    const parsed = parseReport(category, rawReport);
    const [isSaved, setIsSaved] = useState(false);
    
    const handleSave = () => {
        saveReport({
            id: parsed.id,
            category,
            title: parsed.title,
            summary: parsed.description.substring(0, 200),
            rawData: rawReport,
            notes: '',
            folderId: null
        });
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
    };

    return (
        <div onClick={onClick} className="bg-zinc-950 border text-sm border-zinc-800 hover:border-zinc-600 rounded-lg p-4 shadow-sm hover:shadow transition-all group group-hover:scale-[1.002] cursor-pointer">
            <div className="flex justify-between items-start mb-3">
               <div>
                 <div className="flex items-center gap-2 mb-1">
                     <span className="font-mono text-xs text-zinc-100 font-medium">{parsed.id}</span>
                     <span className="text-zinc-500 text-xs">· {formatDate(parsed.date)}</span>
                 </div>
                 <h4 className="text-base font-bold text-zinc-50 capitalize">{parsed.title}</h4>
               </div>
               
               <button 
                   onClick={(e) => { e.stopPropagation(); handleSave(); }}
                   className={cn(
                       "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-colors",
                       isSaved ? "bg-emerald-950 text-emerald-400 border border-emerald-900" : "bg-zinc-950 border border-zinc-800 text-zinc-400 hover:bg-zinc-950 hover:text-zinc-100"
                   )}
               >
                   <Bookmark className={cn("w-3.5 h-3.5", isSaved && "fill-current")} />
                   {isSaved ? 'Saved' : 'Save'}
               </button>
            </div>
            
            <p className="text-zinc-400 mb-4 line-clamp-2 leading-relaxed text-sm">
                {parsed.description}
            </p>
            
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

function HistoryScreen() {
    const { searchHistory, clearSearchHistory } = useStore();

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-bold tracking-tight text-zinc-100 flex items-center gap-3">
                    <History className="w-8 h-8 text-zinc-100" />
                    Search Database History
                </h2>
                {searchHistory.length > 0 && (
                    <button
                        onClick={clearSearchHistory}
                        className="px-4 py-2 border border-zinc-800 text-red-400 rounded-lg hover:bg-red-950 hover:border-red-900 text-sm font-semibold transition-colors flex items-center gap-2"
                    >
                        <AlertTriangle className="w-4 h-4" /> Clear History
                    </button>
                )}
            </div>

            {searchHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-16 text-center text-zinc-500">
                     <History className="w-16 h-16 mb-4 opacity-20" />
                     <p className="text-lg">No search history available.</p>
                     <p className="text-sm mt-1">Your recent searches will appear here.</p>
                </div>
            ) : (
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl shadow-sm overflow-hidden">
                    <div className="divide-y divide-zinc-100">
                        {searchHistory.map((item, idx) => (
                            <div key={idx} className="p-4 hover:bg-zinc-950 flex items-center justify-between transition-colors">
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-zinc-100 uppercase tracking-widest">{item.category}</span>
                                        <span className="text-xs text-zinc-500">· {new Date(item.timestamp).toLocaleString()}</span>
                                    </div>
                                    <span className="text-lg font-medium text-zinc-50">"{item.query}"</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function FiltersModal({ 
    filters, setFilters, onClose 
}: { 
    filters: any, setFilters: any, onClose: () => void 
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-zinc-950 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-zinc-800">
                    <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                         <Filter className="w-5 h-5 text-zinc-100" /> Filter Results
                    </h2>
                    <button onClick={onClose} className="p-2 text-zinc-500 hover:text-zinc-400 bg-zinc-950 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Max API Results Limit</label>
                        <select 
                            value={filters.limit} 
                            onChange={e => setFilters({...filters, limit: e.target.value === 'All' ? 'All' : parseInt(e.target.value)})}
                            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-blue-500 text-zinc-300 font-medium"
                        >
                            <option value={100}>100</option>
                            <option value={500}>500</option>
                            <option value={1000}>1000</option>
                            <option value={2000}>2000</option>
                            <option value="All">All</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Patient Sex</label>
                          <select 
                              value={filters.sex} 
                              onChange={e => setFilters({...filters, sex: e.target.value})}
                              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-blue-500 text-zinc-300 font-medium"
                          >
                              <option value="">Any</option>
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                          </select>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Event Type Contains</label>
                          <input 
                              type="text" 
                              value={filters.eventType} 
                              onChange={e => setFilters({...filters, eventType: e.target.value})}
                              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                              placeholder="e.g. malfunction"
                          />
                      </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Start Date (YYYYMMDD)</label>
                        <input 
                            type="text" 
                            value={filters.startDate} 
                            onChange={e => setFilters({...filters, startDate: e.target.value})}
                            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                            placeholder="e.g. 2023-01-01"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">End Date (YYYYMMDD)</label>
                        <input 
                            type="text" 
                            value={filters.endDate} 
                            onChange={e => setFilters({...filters, endDate: e.target.value})}
                            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                            placeholder="e.g. 2023-12-31"
                        />
                    </div>
                </div>
                <div className="p-5 border-t border-zinc-800 flex justify-end gap-3 bg-zinc-950">
                    <button onClick={() => setFilters({eventType: '', startDate: '', endDate: '', limit: 500, sex: ''})} className="px-4 py-2 text-sm font-semibold text-zinc-400 hover:bg-zinc-800 rounded-lg transition-colors">
                        Clear All
                    </button>
                    <button onClick={onClose} className="px-5 py-2 text-sm font-semibold text-zinc-50 bg-zinc-100 text-zinc-950 hover:bg-zinc-200 hover:bg-zinc-200 rounded-lg shadow-sm transition-colors">
                        Apply Filters
                    </button>
                </div>
            </div>
        </div>
    )
}

function ReportModal({ rawReport, category, onClose }: { rawReport: any, category: Category, onClose: () => void }) {
    const parsed = parseReport(category, rawReport);
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-zinc-950 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-6 border-b border-zinc-800 bg-zinc-950">
                    <div>
                         <div className="flex items-center gap-2 mb-1">
                             <span className="font-mono text-xs text-zinc-100 font-bold bg-zinc-800 px-2 py-0.5 rounded">{parsed.id}</span>
                             <span className="text-zinc-500 text-xs">· {formatDate(parsed.date)}</span>
                         </div>
                         <h2 className="text-xl font-bold text-zinc-100">{parsed.title}</h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-zinc-500 hover:text-zinc-400 hover:bg-zinc-800 rounded-lg transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto space-y-6">
                    <div>
                        <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-widest mb-3">Narrative & Description</h3>
                        <div className="bg-zinc-950 p-4 rounded-lg text-sm text-zinc-300 leading-relaxed border border-zinc-800 whitespace-pre-wrap">
                            {parsed.narrative || parsed.description}
                        </div>
                    </div>
                    {(parsed.patientProblems?.length > 0) && (
                        <div>
                            <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-widest mb-3">Patient Problems</h3>
                            <div className="flex flex-wrap gap-2">
                                {parsed.patientProblems.map((e, idx) => (
                                    <span key={idx} className="bg-rose-950 text-rose-400 px-3 py-1.5 rounded-full text-xs font-semibold border border-rose-900">
                                        {e}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                    {(parsed.deviceProblems?.length > 0) && (
                        <div>
                            <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-widest mb-3">Device Problems</h3>
                            <div className="flex flex-wrap gap-2">
                                {parsed.deviceProblems.map((e, idx) => (
                                    <span key={idx} className="bg-amber-950 text-amber-400 px-3 py-1.5 rounded-full text-xs font-semibold border border-amber-900">
                                        {e}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                    {parsed.events.length > 0 && (
                        <div>
                            <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-widest mb-3">Event Categories</h3>
                            <div className="flex flex-wrap gap-2">
                                {parsed.events.map((e, idx) => (
                                    <span key={idx} className="bg-zinc-900 text-zinc-300 px-3 py-1.5 rounded-md text-xs font-semibold border border-zinc-800">
                                        {e}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                    <div>
                        <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-widest mb-3">Patient Data</h3>
                        <div className="flex flex-wrap gap-4 text-sm bg-zinc-950 p-4 rounded-lg border border-zinc-800">
                            <div><span className="font-semibold text-zinc-500">Sex:</span> {parsed.patient?.sex || 'Unknown'}</div>
                            {parsed.patient?.age && <div><span className="font-semibold text-zinc-500">Age:</span> {parsed.patient.age}</div>}
                            {parsed.patient?.weight && <div><span className="font-semibold text-zinc-500">Weight:</span> {parsed.patient.weight}</div>}
                        </div>
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-widest mb-3">Raw Data Source</h3>
                        <div className="bg-zinc-900 p-4 rounded-lg text-xs font-mono text-zinc-400 overflow-x-auto border border-zinc-800 max-h-64">
                            <pre>{JSON.stringify(rawReport, null, 2)}</pre>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}


