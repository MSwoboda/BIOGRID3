import React, { useRef, useState } from 'react';
import { X, Copy, Check, Link } from 'lucide-react';

interface ShareLinkDialogProps {
  url: string;
  onClose: () => void;
}

export default function ShareLinkDialog({ url, onClose }: ShareLinkDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      // Try clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback: select + execCommand
        inputRef.current?.select();
        document.execCommand('copy');
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // If all else fails, just select so user can Cmd+C
      inputRef.current?.select();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-5 space-y-4 animate-in fade-in zoom-in-95"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Link className="w-4.5 h-4.5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-100">Share Link</h3>
              <p className="text-[11px] text-zinc-500">Anyone with this link and a BioGrid account can access it</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* URL field */}
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            readOnly
            value={url}
            onFocus={e => e.target.select()}
            className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-xs text-zinc-300 font-mono outline-none focus:ring-2 focus:ring-blue-500/40 select-all"
          />
          <button
            onClick={handleCopy}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            {copied ? <><Check className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
          </button>
        </div>

        <p className="text-[10px] text-zinc-600 text-center">
          Recipients must be logged in to view shared content
        </p>
      </div>
    </div>
  );
}
