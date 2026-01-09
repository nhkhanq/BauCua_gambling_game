import React from 'react';
import { GameItem, GameItemKey } from '../types';
import { GAME_ITEMS } from '../constants';

interface BettingBoardProps {
  bets: Record<GameItemKey, number>;
  onPlaceBet: (key: GameItemKey) => void;
  disabled: boolean;
}

const BettingBoard: React.FC<BettingBoardProps> = ({ bets, onPlaceBet, disabled }) => {
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 w-full max-w-2xl mx-auto p-2">
      {GAME_ITEMS.map((item: GameItem) => {
        const currentBet = bets[item.key] || 0;
        
        return (
          <button
            key={item.key}
            onClick={() => onPlaceBet(item.key)}
            disabled={disabled}
            className={`
              relative group flex flex-col items-center p-3 rounded-2xl border-2 transition-all duration-200
              ${disabled ? 'opacity-70 cursor-not-allowed grayscale' : 'cursor-pointer hover:-translate-y-1 hover:shadow-xl active:scale-95'}
              bg-red-50 border-red-200 hover:border-tet-gold
            `}
          >
            {/* Image Placeholder using Emoji and SVG background */}
            <div className="w-full aspect-square bg-white rounded-xl flex items-center justify-center mb-2 shadow-sm overflow-hidden relative">
               {/* Pattern background */}
               <div className={`absolute inset-0 opacity-10 ${item.color}`}></div>
               <span className="text-6xl md:text-7xl transform group-hover:scale-110 transition-transform">{item.emoji}</span>
            </div>

            <span className="font-display text-tet-red text-xl uppercase tracking-wide">{item.name}</span>
            
            {/* Bet Chip */}
            {currentBet > 0 && (
              <div className="absolute -top-2 -right-2 bg-tet-gold text-red-900 font-bold px-3 py-1 rounded-full shadow-lg border-2 border-white animate-pop text-xs md:text-sm">
                {formatCurrency(currentBet)}
              </div>
            )}
            
            {/* Hint text */}
            {!disabled && (
              <span className="text-[10px] text-gray-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                Nhấn để cược thêm
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default BettingBoard;