import React, { useState } from 'react';
import { solidityContracts } from '../data/solidityContracts';
import { FileCode, Copy, Check, Download, Info, Zap } from 'lucide-react';

export const SolidityCodeViewer: React.FC = () => {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);

  const contract = solidityContracts[activeTab];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(contract.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([contract.code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = contract.filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Basic Solidity Syntax Highlighting
  const highlightSolidity = (code: string) => {
    const lines = code.split('\n');
    return lines.map((line, index) => {
      // Highlight single line comments
      if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')) {
        return (
          <span key={index} className="text-zinc-500 italic block">
            {line}
          </span>
        );
      }

      // Simple keyword replacements with styled spans
      const parts = line.split(/(\s+|,|\(|\)|\{|\}|;|=|\+|-|\*|\/)/);
      const elements = parts.map((part, pIdx) => {
        const trimmed = part.trim();
        // Types
        if (['address', 'uint256', 'mapping', 'bool', 'string', 'immutable', 'payable', 'constant', 'public', 'external', 'private', 'view', 'pure', 'returns', 'payable', 'event', 'constructor', 'require', 'indexed', 'return', 'if'].includes(trimmed)) {
          return <span key={pIdx} className="text-pink-400 font-semibold">{part}</span>;
        }
        // Core keywords
        if (['contract', 'import', 'pragma', 'solidity', 'struct', 'modifier', 'emit', 'receive', 'transfer', 'transferFrom'].includes(trimmed)) {
          return <span key={pIdx} className="text-sky-300 font-medium">{part}</span>;
        }
        // Custom variables/functions we want to notice
        if (['getHealthFactor', 'getBorrowedBalance', 'accrueInterest', 'borrow', 'repay', 'liquidate', 'depositCollateral', 'withdrawCollateral'].includes(trimmed)) {
          return <span key={pIdx} className="text-yellow-200 font-medium font-mono">{part}</span>;
        }
        // Numbers
        if (/^\d+(\.\d+)?(e\d+)?$/.test(trimmed)) {
          return <span key={pIdx} className="text-amber-200 font-mono">{part}</span>;
        }
        // Strings
        if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
          return <span key={pIdx} className="text-emerald-300">{part}</span>;
        }
        return part;
      });

      return (
        <div key={index} className="table-row">
          <span className="table-cell text-zinc-600 select-none text-right pr-4 text-xs font-mono w-8">{index + 1}</span>
          <span className="table-cell whitespace-pre font-mono text-zinc-100 text-[13px]">{elements}</span>
        </div>
      );
    });
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl flex flex-col h-[650px] md:h-[720px]" id="solidity-code-viewer">
      {/* File Explorer Header */}
      <div className="bg-zinc-950 border-b border-zinc-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileCode className="w-5 h-5 text-indigo-400" />
          <h3 className="font-semibold text-zinc-200 text-sm tracking-tight">Solidity Reference Library</h3>
        </div>
        
        {/* Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-300 bg-zinc-850 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors cursor-pointer"
            title="Copy Smart Contract Code"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-300 bg-zinc-850 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors cursor-pointer"
            title="Download Solidity Source File"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 bg-zinc-950 px-2 overflow-x-auto scrollbar-none">
        {solidityContracts.map((cnt, idx) => (
          <button
            key={cnt.filename}
            onClick={() => setActiveTab(idx)}
            className={`px-4 py-2 text-xs font-medium cursor-pointer border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === idx
                ? 'border-indigo-500 text-indigo-300 bg-zinc-900/50'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Zap className={`w-3.5 h-3.5 ${activeTab === idx ? 'text-indigo-400' : 'text-zinc-500'}`} />
            {cnt.filename}
          </button>
        ))}
      </div>

      {/* File Description */}
      <div className="bg-indigo-950/40 border-b border-zinc-800 px-4 py-2.5 flex gap-2 items-start text-xs text-indigo-200/90 leading-relaxed font-sans">
        <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <p>{contract.description}</p>
      </div>

      {/* Code Editor Body */}
      <div className="flex-1 overflow-auto bg-zinc-950 p-4 font-mono select-text custom-scrollbar">
        <div className="table w-full select-text">
          {highlightSolidity(contract.code)}
        </div>
      </div>
    </div>
  );
};
