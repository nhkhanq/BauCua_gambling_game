import React from 'react';
import { PlayerRole } from '../types';

interface DebugPanelProps {
  enabled: boolean;
  onToggle: () => void;
  role: PlayerRole;
  roomId: string | null;
  myId: string;
  connectionsCount: number;
  logs: string[];
}

const DebugPanel: React.FC<DebugPanelProps> = ({
  enabled,
  onToggle,
  role,
  roomId,
  myId,
  connectionsCount,
  logs,
}) => {
  return (
    <div className="fixed bottom-2 left-2 z-50 text-xs">
      <button
        onClick={onToggle}
        className={`px-2 py-1 rounded-md border text-[10px] font-mono ${
          enabled
            ? 'bg-green-700/90 text-white border-green-400'
            : 'bg-black/60 text-gray-200 border-gray-500'
        }`}
      >
        {enabled ? 'DEBUG: ON' : 'DEBUG: OFF'}
      </button>

      {enabled && (
        <div className="mt-1 w-72 max-h-52 bg-black/80 text-green-300 border border-gray-600 rounded-md overflow-hidden shadow-lg">
          <div className="px-2 py-1 border-b border-gray-700 flex justify-between gap-1">
            <span className="font-bold">Debug Info</span>
            <span className="text-[10px] text-gray-400">
              {role} {roomId ? `| room=${roomId}` : ''} | conns={connectionsCount}
            </span>
          </div>
          <div className="px-2 py-1 border-b border-gray-700 text-[10px] text-gray-300 break-all">
            <div>myId: {myId || '(chưa có)'}</div>
          </div>
          <div className="max-h-32 overflow-y-auto px-2 py-1 font-mono text-[10px] leading-relaxed space-y-0.5">
            {logs.length === 0 ? (
              <div className="text-gray-500">No logs yet...</div>
            ) : (
              logs
                .slice(-40)
                .reverse()
                .map((line, idx) => (
                  <div key={idx} className="whitespace-pre-wrap">
                    {line}
                  </div>
                ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DebugPanel;


