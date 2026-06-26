import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { parseReport } from '../lib/api';
import type { Category } from '../types';
import { cn } from '../lib/utils';
import { Sparkles, Key, X, Send, Trash2, ArrowRight, ExternalLink, Loader2, Settings, Copy, Check, Bookmark, ArrowDownCircle } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  truncated?: boolean;
}

interface ReportPill {
  reportId: string;
  rawReport: any;
}

interface AiInsightsViewProps {
  results: any[];
  category: Category;
  onSelectReport: (report: any) => void;
  chatMessages: ChatMessage[];
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  savedReportIds: Set<string>;
}

// ── Constants ────────────────────────────────────────────────────────────────
const API_KEY_STORAGE_KEY = 'biogrid_gemini_api_key';
const MODEL_NAME = 'gemini-2.5-flash';

// ── Helpers ──────────────────────────────────────────────────────────────────
function getApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE_KEY) || '';
}
function saveApiKey(key: string) {
  if (key) localStorage.setItem(API_KEY_STORAGE_KEY, key);
  else localStorage.removeItem(API_KEY_STORAGE_KEY);
}

/** Serialize filtered results into a compact context string for the LLM */
function buildReportContext(results: any[], category: Category): string {
  const maxReports = 800;
  const maxNarrativeChars = 600;
  const reports = results.slice(0, maxReports);
  const truncated = results.length > maxReports;

  const lines = reports.map((r, i) => {
    const p = parseReport(category, r);
    const narrative = (p.narrative || '').slice(0, maxNarrativeChars);
    const parts = [
      `Title: ${p.title}`,
      `Date: ${p.date}`,
      p.events.length > 0 ? `Events: ${p.events.join(', ')}` : null,
      p.deviceProblems.length > 0 ? `Problems: ${(p.deviceProblems as string[]).join(', ')}` : null,
      p.patientProblems.length > 0 ? `Patient Issues: ${(p.patientProblems as string[]).join(', ')}` : null,
      p.description ? `Description: ${p.description}` : null,
      narrative ? `Narrative: ${narrative}` : null,
      p.patient?.sex ? `Patient Sex: ${p.patient.sex}` : null,
      p.patient?.age ? `Patient Age: ${p.patient.age}` : null,
    ].filter(Boolean);
    return `[Report ID: ${p.id}] ${parts.join(' | ')}`;
  });

  let context = lines.join('\n\n');
  if (truncated) {
    context += `\n\n[NOTE: Showing ${maxReports} of ${results.length} total reports. User should apply filters to narrow the dataset for more complete analysis.]`;
  }
  return context;
}

function buildSystemPrompt(results: any[], category: Category): string {
  const reportContext = buildReportContext(results, category);
  const categoryLabel = { drug: 'Drug (FAERS)', device: 'Device (MAUDE/MDR)', food: 'Food (CAERS)', tobacco: 'Tobacco' }[category];

  return `You are a regulatory safety analyst. You have been given ${results.length} FDA ${categoryLabel} adverse event reports. Answer the user's questions based ONLY on these reports.

CRITICAL RULES:
- ALWAYS cite specific report IDs using this EXACT syntax: [[REPORT:12345678]] — this is rendered as a clickable pill. Never write bare IDs.
- Every single time you mention a report ID, you MUST use [[REPORT:ID]] format. Examples: [[REPORT:10000000]], [[REPORT:10003304]], [[REPORT:2032227-2020-110169]].
- Do NOT write "#12345678" or "Report 12345678" or "MDR 12345678" — always use [[REPORT:ID]] syntax.
- When listing reports, include: report ID (in [[REPORT:ID]] format), date, device/drug name, and key details.
- Be precise about counts — count the actual data, don't estimate.
- If the data doesn't contain enough information to answer, say so clearly.
- Format responses with markdown: use headers (##), bullet lists, **bold** for emphasis, and tables when comparing data.
- Keep answers focused and well-structured. Use sections for complex answers.
- When asked to summarize, organize by themes/categories rather than listing every report.

REPORT DATA (${results.length} reports):
${reportContext}`;
}

/** Build a Set of all known report IDs from results for auto-detection */
function collectReportIds(results: any[], category: Category): Set<string> {
  const ids = new Set<string>();
  for (const r of results) {
    const p = parseReport(category, r);
    if (p.id) ids.add(String(p.id));
  }
  return ids;
}

/**
 * Normalize raw report ID references in LLM output into [[REPORT:ID]] format.
 * Catches patterns like: #12345678, **#12345678**, MDR #12345, Report 12345,
 * **Report 12345**, etc. Also strips surrounding bold/italic markdown markers.
 * Only converts IDs that exist in the known set.
 */
function normalizeReportReferences(text: string, knownIds: Set<string>): string {
  if (knownIds.size === 0) return text;

  // Protect existing [[REPORT:...]] markers from double-wrapping
  const placeholders: string[] = [];
  let result = text.replace(/\[\[REPORT:[^\]]+\]\]/g, (m) => {
    placeholders.push(m);
    return `__PILL_${placeholders.length - 1}__`;
  });

  // Sort IDs by length descending so longer IDs match first
  const sortedIds = [...knownIds].sort((a, b) => b.length - a.length);

  for (const id of sortedIds) {
    const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Match the ID with optional surrounding markdown (**,*) and common prefixes (#, MDR, Report, etc.)
    // Pattern: optional **/* + optional prefix + ID + optional **/* 
    const pattern = new RegExp(
      '(\\*{1,2})?' +                    // optional opening bold/italic
      '(?:#|MDR\\s*#?|FAERS\\s*#?|Report(?:\\s+(?:ID|Number|#))?\\s*#?|report\\s*#?)?' +  // optional prefix
      '\\s*' +
      '(' + escapedId + ')' +            // the actual ID
      '(\\*{1,2})?' +                    // optional closing bold/italic
      '(?=\\s|[.,;:!?)\\]\\n]|$)',       // followed by delimiter or end
      'g'
    );

    result = result.replace(pattern, (...args) => {
      const match = args[0];
      const offset = args[args.length - 2];
      // Check we're not inside an already-placed pill
      const before = result.slice(Math.max(0, offset - 12), offset);
      if (before.includes('REPORT:') || before.includes('__PILL_')) return match;
      return `[[REPORT:${id}]]`;
    });
  }

  // Restore protected markers
  result = result.replace(/__PILL_(\d+)__/g, (_, idx) => placeholders[parseInt(idx)]);

  // Clean up any double-wrapping
  result = result.replace(/\[\[REPORT:\[\[REPORT:([^\]]+)\]\]\]\]/g, '[[REPORT:$1]]');
  
  // Clean up orphaned bold markers adjacent to pills (e.g., "**[[REPORT:123]]**" → "[[REPORT:123]]")
  result = result.replace(/\*{1,2}\[\[REPORT:([^\]]+)\]\]\*{0,2}/g, '[[REPORT:$1]]');
  result = result.replace(/\[\[REPORT:([^\]]+)\]\]\*{1,2}/g, '[[REPORT:$1]]');

  return result;
}

/** Parse [[REPORT:ID]] markers from text and split into segments */
function parseReportReferences(text: string, results: any[], category: Category): (string | ReportPill)[] {
  // First, normalize any raw report ID mentions into [[REPORT:ID]] format
  const knownIds = collectReportIds(results, category);
  const normalized = normalizeReportReferences(text, knownIds);

  const regex = /\[\[REPORT:([^\]]+)\]\]/g;
  const segments: (string | ReportPill)[] = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(normalized)) !== null) {
    if (match.index > lastIndex) {
      segments.push(normalized.slice(lastIndex, match.index));
    }
    const reportId = match[1].trim();
    const rawReport = results.find(r => {
      const parsed = parseReport(category, r);
      return parsed.id === reportId || String(parsed.id) === reportId;
    });
    segments.push({ reportId, rawReport: rawReport || null });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < normalized.length) {
    segments.push(normalized.slice(lastIndex));
  }

  return segments.length > 0 ? segments : [normalized];
}

// ── Suggested Questions ──────────────────────────────────────────────────────
const SUGGESTED_QUESTIONS: Record<Category, string[]> = {
  device: [
    "How many reports mention device malfunctions vs. injuries?",
    "Which device types have the most serious adverse events?",
    "Summarize all reports involving power failures or electrical issues",
    "List all fatal events with their report IDs and descriptions",
    "What are the most common product problems across these reports?",
  ],
  drug: [
    "How many reports involve serious adverse events?",
    "What are the most common drug reactions across these reports?",
    "List all fatal cases with their report IDs and drug names",
    "Which drugs are most frequently reported as suspect?",
    "Summarize reports involving hospitalization",
  ],
  food: [
    "What are the most common adverse reactions in these reports?",
    "How many reports resulted in hospitalization or ER visits?",
    "Which product categories have the most reports?",
    "Summarize the most severe outcomes across all reports",
    "List reports involving allergic reactions",
  ],
  tobacco: [
    "What are the most frequently reported health problems?",
    "How many reports involve non-users being affected?",
    "Which product types have the most health complaints?",
    "Summarize reports involving respiratory issues",
    "How many different product types appear in these reports?",
  ],
};

// ── Simple Markdown Renderer ─────────────────────────────────────────────────
function renderMarkdown(text: string): string {
  let html = text
    .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre class="bg-zinc-900 border border-zinc-700 rounded-lg p-3 my-2 overflow-x-auto text-xs"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-zinc-800 px-1.5 py-0.5 rounded text-xs text-emerald-400">$1</code>')
    .replace(/^#### (.+)$/gm, '<h4 class="text-sm font-bold text-zinc-200 mt-4 mb-1">$1</h4>')
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-bold text-zinc-100 mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-base font-bold text-zinc-100 mt-5 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-lg font-bold text-zinc-100 mt-5 mb-2">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-zinc-100 font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^[-*] (.+)$/gm, '<li class="ml-4 list-disc text-zinc-300">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-zinc-300">$1</li>')
    .replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, '<ul class="my-2 space-y-1">$1</ul>')
    .replace(/^---$/gm, '<hr class="border-zinc-700 my-3" />')
    .replace(/\n\n/g, '</p><p class="my-2 text-zinc-300 text-sm leading-relaxed">')
    .replace(/\n/g, '<br />');

  return `<p class="my-2 text-zinc-300 text-sm leading-relaxed">${html}</p>`;
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function AiInsightsView({ results, category, onSelectReport, chatMessages, setChatMessages, savedReportIds }: AiInsightsViewProps) {
  const [apiKey, setApiKeyState] = useState(getApiKey());
  const [keyInput, setKeyInput] = useState('');
  const [showKeySetup, setShowKeySetup] = useState(!apiKey);
  const [showKeyEditor, setShowKeyEditor] = useState(false);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, streamingContent]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const doSaveKey = () => {
    const trimmed = keyInput.trim();
    if (!trimmed) return;
    saveApiKey(trimmed);
    setApiKeyState(trimmed);
    setKeyInput('');
    setShowKeySetup(false);
    setShowKeyEditor(false);
  };

  const removeKey = () => {
    saveApiKey('');
    setApiKeyState('');
    setShowKeySetup(true);
    setShowKeyEditor(false);
  };

  const clearChat = () => {
    setChatMessages([]);
    setStreamingContent('');
    setError('');
  };

  const copyMessage = (content: string, id: string) => {
    const clean = content.replace(/\[\[REPORT:([^\]]+)\]\]/g, '#$1');
    navigator.clipboard.writeText(clean);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const sendMessage = useCallback(async (messageText?: string) => {
    const text = (messageText || input).trim();
    if (!text || isStreaming || !apiKey) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    setChatMessages(prev => [...prev, userMsg]);
    setInput('');
    setError('');
    setIsStreaming(true);
    setStreamingContent('');

    try {
      const ai = new GoogleGenAI({ apiKey });
      const systemPrompt = buildSystemPrompt(results, category);
      const history = [...chatMessages, userMsg];

      const contents = history.map(msg => ({
        role: msg.role === 'user' ? 'user' as const : 'model' as const,
        parts: [{ text: msg.content }],
      }));

      let fullResponse = '';

      const response = await ai.models.generateContentStream({
        model: MODEL_NAME,
        contents,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.3,
          maxOutputTokens: 65536,
        },
      });

      let lastFinishReason = '';
      for await (const chunk of response) {
        const chunkText = chunk.text || '';
        fullResponse += chunkText;
        setStreamingContent(fullResponse);
        // Track finish reason from candidates
        const fr = (chunk as any).candidates?.[0]?.finishReason;
        if (fr) lastFinishReason = fr;
      }

      const wasTruncated = lastFinishReason === 'MAX_TOKENS' || lastFinishReason === 'LENGTH';

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: fullResponse,
        timestamp: Date.now(),
        truncated: wasTruncated,
      };

      setChatMessages(prev => [...prev, assistantMsg]);
      setStreamingContent('');
    } catch (err: any) {
      console.error('Gemini API error:', err);
      const errorMsg = err?.message || 'Unknown error';
      if (errorMsg.includes('API_KEY_INVALID') || errorMsg.includes('401')) {
        setError('Invalid API key. Please check your Gemini API key and try again.');
      } else if (errorMsg.includes('429') || errorMsg.includes('RATE_LIMIT')) {
        setError('Rate limit exceeded. Please wait a moment and try again.');
      } else if (errorMsg.includes('context') || errorMsg.includes('too large')) {
        setError('Too much data for a single query. Try applying filters to narrow your results.');
      } else {
        setError(`Error: ${errorMsg}`);
      }
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, apiKey, results, category, chatMessages, setChatMessages]);

  // ── Continue generating a truncated response ──────────────────────────────
  const handleContinue = useCallback(async (truncatedMsgId: string) => {
    if (isStreaming || !apiKey) return;

    setIsStreaming(true);
    setError('');

    try {
      const ai = new GoogleGenAI({ apiKey });
      const systemPrompt = buildSystemPrompt(results, category);

      // Build history up to and including the truncated message
      const history = chatMessages.map(msg => ({
        role: msg.role === 'user' ? 'user' as const : 'model' as const,
        parts: [{ text: msg.content }],
      }));

      // Add a continuation prompt
      history.push({
        role: 'user' as const,
        parts: [{ text: 'Continue exactly where you left off. Do not repeat anything you already said. Pick up from the exact point your previous response was cut off.' }],
      });

      const contents = history;

      let fullContinuation = '';
      let lastFinishReason = '';

      const response = await ai.models.generateContentStream({
        model: MODEL_NAME,
        contents,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.3,
          maxOutputTokens: 65536,
        },
      });

      // Find the truncated message to show live preview of combined content
      const truncatedMsg = chatMessages.find(m => m.id === truncatedMsgId);
      const existingContent = truncatedMsg?.content || '';

      for await (const chunk of response) {
        const chunkText = chunk.text || '';
        fullContinuation += chunkText;
        setStreamingContent(existingContent + fullContinuation);
        const fr = (chunk as any).candidates?.[0]?.finishReason;
        if (fr) lastFinishReason = fr;
      }

      const stillTruncated = lastFinishReason === 'MAX_TOKENS' || lastFinishReason === 'LENGTH';

      // Merge continuation into the original message
      setChatMessages(prev => prev.map(msg =>
        msg.id === truncatedMsgId
          ? { ...msg, content: msg.content + fullContinuation, truncated: stillTruncated }
          : msg
      ));
      setStreamingContent('');
    } catch (err: any) {
      console.error('Gemini continue error:', err);
      setError(`Error continuing: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsStreaming(false);
    }
  }, [isStreaming, apiKey, results, category, chatMessages, setChatMessages]);

  // ── Render a message with clickable report pills ─────────────────────────
  const renderMessageContent = (content: string) => {
    const segments = parseReportReferences(content, results, category);
    
    return segments.map((seg, i) => {
      if (typeof seg === 'string') {
        return <span key={i} dangerouslySetInnerHTML={{ __html: renderMarkdown(seg) }} />;
      }
      const pill = seg as ReportPill;
      const isSaved = savedReportIds.has(pill.reportId);
      return (
        <button
          key={i}
          onClick={() => pill.rawReport && onSelectReport(pill.rawReport)}
          disabled={!pill.rawReport}
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded-full text-[11px] font-mono font-semibold border transition-all',
            pill.rawReport
              ? isSaved
                ? 'bg-amber-950 border-amber-700 text-amber-300 hover:bg-amber-900 hover:border-amber-500 cursor-pointer'
                : 'bg-blue-950 border-blue-700 text-blue-300 hover:bg-blue-900 hover:border-blue-500 cursor-pointer'
              : 'bg-zinc-800 border-zinc-700 text-zinc-500 cursor-not-allowed'
          )}
          title={pill.rawReport ? (isSaved ? 'Saved · Click to view report' : 'Click to view report') : 'Report not found in current results'}
        >
          {isSaved ? <Bookmark className="w-2.5 h-2.5 fill-current" /> : <ExternalLink className="w-2.5 h-2.5" />}
          #{pill.reportId}
        </button>
      );
    });
  };

  // ── API Key Setup Screen ─────────────────────────────────────────────────
  if (showKeySetup) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="max-w-md w-full bg-zinc-900/80 border border-zinc-800 rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600/20 to-blue-600/20 border border-violet-500/20">
              <Sparkles className="w-7 h-7 text-violet-400" />
            </div>
            <h2 className="text-xl font-bold text-zinc-100">AI Insights</h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Ask questions about your search results using Google's Gemini AI. 
              You'll need your own API key to get started.
            </p>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Gemini API Key</label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
              <input
                type="password"
                value={keyInput}
                onChange={e => setKeyInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doSaveKey()}
                placeholder="AIza..."
                className="w-full pl-10 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 font-mono"
              />
            </div>
            <button
              onClick={doSaveKey}
              disabled={!keyInput.trim()}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-white text-sm font-semibold transition-all hover:from-violet-500 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-violet-600/20"
            >
              Save & Start
            </button>
          </div>

          <div className="text-center">
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Get a free API key from Google AI Studio
            </a>
          </div>

          <p className="text-[10px] text-zinc-600 text-center leading-relaxed">
            Your API key is stored only in your browser's local storage. 
            Report data is sent directly to Google's Gemini API — no data passes through BIOGRID servers.
          </p>
        </div>
      </div>
    );
  }

  // ── Main Chat Interface ──────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-280px)] min-h-[500px] bg-zinc-950/50 rounded-2xl border border-zinc-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 bg-zinc-900/50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600/20 to-blue-600/20 border border-violet-500/20">
            <Sparkles className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-100">AI Insights</h3>
            <p className="text-[10px] text-zinc-500">
              Analyzing {results.length} {category} report{results.length !== 1 ? 's' : ''}
              {results.length === 0 && ' — run a search first'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {chatMessages.length > 0 && (
            <button
              onClick={clearChat}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] text-zinc-500 hover:text-red-400 hover:bg-zinc-800/50 border border-transparent hover:border-zinc-700 transition-all"
              title="Clear conversation"
            >
              <Trash2 className="w-3 h-3" /> Clear
            </button>
          )}
          <button
            onClick={() => setShowKeyEditor(!showKeyEditor)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] border transition-all',
              showKeyEditor
                ? 'bg-zinc-800 border-zinc-700 text-zinc-300'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 border-transparent hover:border-zinc-700'
            )}
            title="API key settings"
          >
            <Settings className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* API Key Editor (inline) */}
      {showKeyEditor && (
        <div className="px-5 py-3 border-b border-zinc-800 bg-zinc-900/30 flex items-center gap-3">
          <Key className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
          <input
            type="password"
            value={keyInput}
            onChange={e => setKeyInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSaveKey()}
            placeholder="Enter new API key..."
            className="flex-1 bg-transparent text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none font-mono"
          />
          {keyInput.trim() && (
            <button onClick={doSaveKey} className="text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold">Save</button>
          )}
          <button onClick={removeKey} className="text-[10px] text-red-400 hover:text-red-300 font-semibold">Remove Key</button>
          <button onClick={() => { setShowKeyEditor(false); setKeyInput(''); }} className="text-zinc-600 hover:text-zinc-400">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Empty state with suggestions */}
        {chatMessages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full space-y-8">
            <div className="text-center space-y-3">
              <Sparkles className="w-10 h-10 text-violet-400/30 mx-auto" />
              <h3 className="text-lg font-semibold text-zinc-400">Ask anything about your results</h3>
              <p className="text-xs text-zinc-600 max-w-sm mx-auto">
                {results.length > 0
                  ? `${results.length} reports loaded. Try one of the suggestions below or ask your own question.`
                  : 'Run a search first to load reports, then ask questions here.'}
              </p>
            </div>

            {results.length > 0 && (
              <div className="grid gap-2 w-full max-w-lg">
                {SUGGESTED_QUESTIONS[category].map((q, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(q)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-900/50 border border-zinc-800 text-left text-sm text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 hover:bg-zinc-900 transition-all group"
                  >
                    <ArrowRight className="w-3.5 h-3.5 text-zinc-700 group-hover:text-violet-400 transition-colors shrink-0" />
                    <span>{q}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Chat messages */}
        {chatMessages.map(msg => (
          <div
            key={msg.id}
            className={cn(
              'flex gap-3',
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600/20 to-blue-600/20 border border-violet-500/20 flex items-center justify-center shrink-0 mt-1">
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              </div>
            )}
            <div
              className={cn(
                'max-w-[85%] rounded-2xl px-4 py-3 text-sm',
                msg.role === 'user'
                  ? 'bg-blue-600/20 border border-blue-500/30 text-zinc-200'
                  : 'bg-zinc-900/80 border border-zinc-800 text-zinc-300'
              )}
            >
              {msg.role === 'user' ? (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              ) : (
                <div className="ai-message-content">
                  {renderMessageContent(msg.content)}
                </div>
              )}
              {msg.role === 'assistant' && (
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-800/50">
                  <div>
                    {msg.truncated && (
                      <button
                        onClick={() => handleContinue(msg.id)}
                        disabled={isStreaming}
                        className="flex items-center gap-1.5 text-[11px] font-medium text-violet-400 hover:text-violet-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ArrowDownCircle className="w-3.5 h-3.5" />
                        Continue generating
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => copyMessage(msg.content, msg.id)}
                    className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
                  >
                    {copiedId === msg.id ? <><Check className="w-2.5 h-2.5 text-emerald-400" /> Copied</> : <><Copy className="w-2.5 h-2.5" /> Copy</>}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Streaming response */}
        {isStreaming && streamingContent && (
          <div className="flex gap-3 justify-start">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600/20 to-blue-600/20 border border-violet-500/20 flex items-center justify-center shrink-0 mt-1 animate-pulse">
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <div className="max-w-[85%] rounded-2xl px-4 py-3 text-sm bg-zinc-900/80 border border-zinc-800 text-zinc-300">
              <div className="ai-message-content">
                {renderMessageContent(streamingContent)}
              </div>
              <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-zinc-800/50">
                <Loader2 className="w-3 h-3 text-violet-400 animate-spin" />
                <span className="text-[10px] text-zinc-600">Generating...</span>
              </div>
            </div>
          </div>
        )}

        {/* Loading indicator (before first content arrives) */}
        {isStreaming && !streamingContent && (
          <div className="flex gap-3 justify-start">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600/20 to-blue-600/20 border border-violet-500/20 flex items-center justify-center shrink-0 mt-1 animate-pulse">
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <div className="rounded-2xl px-4 py-3 bg-zinc-900/80 border border-zinc-800 flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
              <span className="text-xs text-zinc-500">Analyzing {results.length} reports...</span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-950/30 border border-red-800/30">
            <span className="text-red-400 text-sm">⚠️</span>
            <div>
              <p className="text-sm text-red-300">{error}</p>
              <button onClick={() => setError('')} className="text-[10px] text-red-400 hover:text-red-300 mt-1">Dismiss</button>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div className="px-5 py-3 border-t border-zinc-800 bg-zinc-900/30 shrink-0">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={results.length > 0 ? "Ask about your results..." : "Run a search first to load reports..."}
              disabled={results.length === 0 || isStreaming}
              rows={1}
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 resize-none disabled:opacity-40 disabled:cursor-not-allowed"
            />
          </div>
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isStreaming || results.length === 0}
            className="flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-white transition-all hover:from-violet-500 hover:to-blue-500 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-violet-600/20"
          >
            {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[10px] text-zinc-700 mt-1.5 text-center">
          Powered by Gemini 2.0 Flash · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
