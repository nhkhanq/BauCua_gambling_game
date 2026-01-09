import React, { useEffect, useState } from 'react';
import { GameItemKey } from '../types';
import { getItemByKey } from '../constants';

interface ResultOverlayProps {
  winAmount: number;
  totalBet: number;
  results: GameItemKey[];
  onClose: () => void;
}

const ResultOverlay: React.FC<ResultOverlayProps> = ({ winAmount, totalBet, results, onClose }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    setTimeout(() => setVisible(true), 50);
  }, []);

  const isWin = winAmount > 0;
  const isLoss = totalBet > 0 && winAmount <= 0; // Bet but lost (or win = 0 which is loss of bet usually, logic depends on game rule, here winAmount includes refund)
  // In App.tsx logic: calculateWinnings returns total return (refund + profit). 
  // Profit = winAmount - totalBet.
  const profit = winAmount - totalBet;
  const isProfit = profit > 0;
  const isBreakeven = totalBet > 0 && profit === 0;
  const isNoBet = totalBet === 0;

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300); // Wait for exit animation
  };

  const formatMoney = (n: number) => new Intl.NumberFormat('vi-VN').format(n);

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center transition-all duration-300 ${visible ? 'bg-black/80 backdrop-blur-sm opacity-100' : 'opacity-0 pointer-events-none'}`}>
      
      {/* Confetti / Background Effects */}
      {isProfit && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-2 h-2 bg-yellow-400 rounded-full animate-ping" style={{ animationDuration: '1s' }}></div>
          <div className="absolute top-10 left-3/4 w-3 h-3 bg-red-500 rounded-full animate-ping" style={{ animationDuration: '1.5s' }}></div>
          <div className="absolute top-1/2 left-1/2 w-full h-full bg-[radial-gradient(circle,_rgba(255,215,0,0.3)_0%,_transparent_70%)] animate-pulse"></div>
        </div>
      )}

      <div 
        className={`
          relative w-[90%] max-w-sm rounded-3xl p-6 text-center shadow-2xl border-4 transform transition-all duration-500
          ${visible ? 'scale-100 translate-y-0' : 'scale-50 translate-y-20'}
          ${isProfit ? 'bg-gradient-to-b from-red-600 to-red-900 border-yellow-400' : 
            isLoss ? 'bg-gray-800 border-gray-600' : 'bg-white border-tet-gold'}
        `}
      >
        {/* Header Title */}
        <h2 className={`font-display text-4xl mb-4 drop-shadow-md ${isProfit ? 'text-yellow-300' : isLoss ? 'text-gray-400' : 'text-tet-red'}`}>
          {isProfit ? '🎉 THẮNG LỚN! 🎉' : isLoss ? '😢 THUA RỒI' : isBreakeven ? 'HÒA VỐN' : 'KẾT QUẢ'}
        </h2>

        {/* Dice Result Display */}
        <div className="flex justify-center gap-4 mb-6">
          {results.map((key, idx) => (
            <div key={idx} className="bg-white p-2 rounded-xl shadow-inner animate-pop" style={{ animationDelay: `${idx * 150}ms` }}>
              <div className="text-4xl">{getItemByKey(key).emoji}</div>
            </div>
          ))}
        </div>

        {/* Money Changes */}
        {!isNoBet && (
          <div className="mb-8">
            <p className={`text-lg font-bold uppercase tracking-wider ${isProfit || isLoss ? 'text-white/80' : 'text-gray-500'}`}>
              {isProfit ? 'Bạn nhận được' : 'Bạn đã mất'}
            </p>
            <div className={`text-5xl font-display mt-2 ${isProfit ? 'text-yellow-400' : 'text-gray-300'}`}>
              {isProfit ? `+${formatMoney(profit)}` : isLoss ? `-${formatMoney(totalBet)}` : `${formatMoney(winAmount)}`}
            </div>
          </div>
        )}

        {/* Close Button */}
        <button 
          onClick={handleClose}
          className={`
            w-full py-4 rounded-xl font-bold text-xl uppercase tracking-widest shadow-lg transition-transform active:scale-95
            ${isProfit 
              ? 'bg-yellow-400 text-red-900 hover:bg-yellow-300' 
              : 'bg-tet-red text-white hover:bg-red-600'}
          `}
        >
          {isProfit ? 'Hốt Bạc!' : 'Chơi Tiếp'}
        </button>

      </div>
    </div>
  );
};

export default ResultOverlay;