import React, { useEffect, useState } from 'react';
import { GameItem, GameItemKey } from '../types';
import { GAME_ITEMS } from '../constants';

interface BettingBoardProps {
  bets: Record<GameItemKey, number>;
  globalBets: Record<GameItemKey, number>;
  onPlaceBet: (key: GameItemKey) => void;
  disabled: boolean;
}

// Sub-component to handle individual item animations
const BettingItem: React.FC<{
  item: GameItem;
  myBet: number;
  globalBet: number;
  onPlaceBet: () => void;
  disabled: boolean;
}> = ({ item, myBet, globalBet, onPlaceBet, disabled }) => {
  const [animateGlobal, setAnimateGlobal] = useState(false);

  // Trigger animation when globalBet increases
  useEffect(() => {
    if (globalBet > 0) {
      setAnimateGlobal(true);
      const timer = setTimeout(() => setAnimateGlobal(false), 300);
      return () => clearTimeout(timer);
    }
  }, [globalBet]);

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return (amount / 1000000).toFixed(1) + 'M';
    if (amount >= 1000) return (amount / 1000).toFixed(0) + 'k';
    return amount.toString();
  };

  const formatMyBet = (amount: number) => {
     return new Intl.NumberFormat('vi-VN').format(amount);
  }

  return (
    <button
      onClick={onPlaceBet}
      disabled={disabled}
      className={`
        relative group flex flex-col items-center p-2 rounded-2xl border-2 transition-all duration-200
        ${disabled ? 'opacity-70 cursor-not-allowed grayscale' : 'cursor-pointer hover:-translate-y-1 hover:shadow-xl active:scale-95'}
        ${myBet > 0 ? 'bg-yellow-50 border-tet-gold' : 'bg-red-50 border-red-200 hover:border-red-400'}
      `}
    >
      {/* Image / Emoji Area */}
      <div className={`
        w-full aspect-square bg-white rounded-xl flex items-center justify-center mb-2 shadow-sm overflow-hidden relative transition-transform
        ${animateGlobal ? 'scale-105 ring-4 ring-yellow-400 ring-opacity-50' : ''}
      `}>
         {/* Pattern background */}
         <div className={`absolute inset-0 opacity-10 ${item.color}`}></div>
         <span className="text-5xl md:text-7xl transform group-hover:scale-110 transition-transform">{item.emoji}</span>
      </div>

      <div className="w-full flex flex-col items-center">
        <span className="font-display text-tet-red text-lg md:text-xl uppercase tracking-wide leading-none mb-1">{item.name}</span>
        
        {/* Global Bet Indicator (Now more prominent below name) */}
        {globalBet > 0 && (
          <div className={`
            flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full transition-colors
            ${animateGlobal ? 'bg-yellow-400 text-red-900' : 'bg-gray-200 text-gray-600'}
          `}>
             <span>👥</span>
             <span>{formatCurrency(globalBet)}</span>
          </div>
        )}
      </div>
      
      {/* My Bet Chip (Top Right - Floating) */}
      {myBet > 0 && (
        <div className="absolute -top-3 -right-2 bg-tet-gold text-red-900 font-black px-3 py-1 rounded-full shadow-lg border-2 border-white animate-pop text-sm z-10 flex flex-col items-center leading-none">
          <span className="text-[10px] text-red-800 opacity-80 font-sans">Cược</span>
          {formatMyBet(myBet)}
        </div>
      )}
    </button>
  );
};

const BettingBoard: React.FC<BettingBoardProps> = ({ bets, globalBets, onPlaceBet, disabled }) => {
  return (
    <div className="grid grid-cols-3 gap-2 md:gap-4 w-full max-w-2xl mx-auto p-2">
      {GAME_ITEMS.map((item) => (
        <BettingItem
          key={item.key}
          item={item}
          myBet={bets[item.key] || 0}
          globalBet={globalBets[item.key] || 0}
          onPlaceBet={() => onPlaceBet(item.key)}
          disabled={disabled}
        />
      ))}
    </div>
  );
};

export default BettingBoard;