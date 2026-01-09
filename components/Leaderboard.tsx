import React from 'react';
import { PlayerInfo } from '../types';

interface LeaderboardProps {
  players: PlayerInfo[];
  currentUserId: string;
}

const formatMoney = (amount: number) => 
  new Intl.NumberFormat('vi-VN', { notation: "compact", compactDisplay: "short" }).format(amount).replace('T', 'Tr');

const Leaderboard: React.FC<LeaderboardProps> = ({ players, currentUserId }) => {
  // Sort players by balance (descending)
  const sortedPlayers = [...players].sort((a, b) => b.balance - a.balance);

  return (
    <div className="w-full max-w-sm bg-tet-darkRed/90 border-2 border-tet-gold rounded-xl overflow-hidden shadow-lg mt-4">
      <div className="bg-tet-gold/20 p-2 text-center border-b border-tet-gold/30">
        <h3 className="text-tet-gold font-display text-lg uppercase tracking-wider">🌟 Bảng Vàng 🌟</h3>
      </div>
      
      <div className="max-h-40 overflow-y-auto p-2 space-y-2 custom-scrollbar">
        {sortedPlayers.map((player, index) => {
          const isMe = player.id === currentUserId;
          const rankEmoji = index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;
          
          return (
            <div 
              key={player.id}
              className={`flex items-center justify-between p-2 rounded-lg text-sm transition-colors ${
                isMe ? 'bg-yellow-900/50 border border-yellow-500/50' : 'bg-black/20'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-6 text-center font-bold text-lg">{rankEmoji}</span>
                <div className="flex flex-col">
                  <span className={`font-bold ${isMe ? 'text-yellow-300' : 'text-white'}`}>
                    {player.name} {isMe && '(Bạn)'}
                  </span>
                  {player.isHost && (
                    <span className="text-[10px] bg-red-600 text-white px-1 rounded w-fit">NHÀ CÁI</span>
                  )}
                </div>
              </div>
              
              <div className="font-mono text-tet-gold font-bold">
                {formatMoney(player.balance)}
              </div>
            </div>
          );
        })}
        
        {players.length === 0 && (
          <div className="text-center text-gray-400 text-xs py-2">Đang đợi người chơi...</div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;