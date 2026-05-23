import React, { useState } from 'react';
import { TransactionLog } from '../types';
import { Terminal, RefreshCw, Layers, ZoomIn, Search } from 'lucide-react';

interface TransactionLedgerProps {
  logs: TransactionLog[];
  onClearLogs: () => void;
}

export const TransactionLedger: React.FC<TransactionLedgerProps> = ({ logs, onClearLogs }) => {
  const [filter, setFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredLogs = logs.filter((log) => {
    const matchesFilter = filter === 'All' || log.event === filter;
    const matchesSearch = 
      log.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getEventBadge = (event: TransactionLog['event']) => {
    switch (event) {
      case 'Deposit':
        return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
      case 'Withdraw':
        return 'bg-sky-500/15 text-sky-400 border border-sky-500/30';
      case 'Borrow':
        return 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
      case 'Repay':
        return 'bg-blue-500/15 text-blue-400 border border-blue-500/30';
      case 'Liquidate':
        return 'bg-red-500/15 text-red-400 border border-red-500/40 font-bold animate-pulse';
      case 'InterestAccrued':
        return 'bg-purple-500/15 text-purple-400 border border-purple-500/30';
      case 'OracleUpdate':
        return 'bg-zinc-500/15 text-zinc-400 border border-zinc-500/30';
      default:
        return 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20';
    }
  };

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-xl" id="transaction-ledger">
      {/* Header */}
      <div className="px-4 py-3 bg-zinc-900 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300 font-mono">EVM Event Log / Block Explorer</span>
        </div>
        <button
          onClick={onClearLogs}
          className="text-[10px] text-zinc-400 hover:text-zinc-200 uppercase tracking-widest border border-zinc-800 rounded px-2 py-1 transition-colors cursor-pointer"
        >
          Clear Memory
        </button>
      </div>

      {/* Filter and search panel */}
      <div className="p-3 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap gap-1">
          {['All', 'Deposit', 'Borrow', 'Repay', 'Liquidate', 'InterestAccrued'].map((evt) => (
            <button
              key={evt}
              onClick={() => setFilter(evt)}
              className={`px-2 py-1 rounded text-[11px] font-mono cursor-pointer transition-colors ${
                filter === evt
                  ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-305 border border-transparent'
              }`}
            >
              {evt}
            </button>
          ))}
        </div>

        {/* Search Input Box */}
        <div className="relative w-44">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search address/logs"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded pl-8 pr-2.5 py-1.5 text-zinc-300 focus:outline-none focus:border-indigo-600 font-mono"
          />
        </div>
      </div>

      {/* Logs Window */}
      <div className="h-[210px] overflow-y-auto p-2 font-mono text-[11px] flex flex-col-reverse gap-1.5 custom-scrollbar bg-black/40">
        {filteredLogs.length === 0 ? (
          <div className="text-center text-zinc-600 py-10">
            No contract logs generated yet
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className="p-2 bg-zinc-900/40 rounded border border-zinc-900 hover:border-zinc-800 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {/* Block metadata */}
                <div className="flex items-center gap-1 text-zinc-500 text-[10px]">
                  <Layers className="w-3 h-3 text-zinc-650" />
                  <span>#{log.block}</span>
                </div>

                {/* Event badge */}
                <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-medium uppercase ${getEventBadge(log.event)}`}>
                  {log.event}
                </span>

                {/* Log details */}
                <span className="text-zinc-300 select-all font-sans leading-relaxed">{log.details}</span>
              </div>

              {/* Timestamp & Account */}
              <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] shrink-0">
                <span className="bg-zinc-900/90 text-zinc-400 px-1.5 py-0.5 rounded font-mono select-all">
                  {log.user === '0x00...0000' || log.user === 'Oracle'
                    ? log.user
                    : `${log.user.slice(0, 6)}...${log.user.slice(-4)}`}
                </span>
                <span>• {log.timestamp}</span>
              </div>
            </div>
          ))
        )}
      </div>
      
      <div className="px-4 py-1.5 bg-zinc-900/60 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-550 font-mono">
        <span>Accumulated Transactions: {logs.length}</span>
        <span>EVM Environment: HyperLocal Simulator</span>
      </div>
    </div>
  );
};
