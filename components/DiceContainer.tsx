import React from 'react';
import { GameItemKey } from '../types';
import { getItemByKey } from '../constants';

interface DiceContainerProps {
  isShaking: boolean;
  results: GameItemKey[];
}

const DiceContainer: React.FC<DiceContainerProps> = ({ isShaking, results }) => {
  return (
    <div className="relative w-full max-w-md mx-auto p-4 flex justify-center items-center min-h-[160px]">
      {/* Decorative Plate Background */}
      <div className="absolute inset-0 bg-tet-cream rounded-full opacity-10 blur-xl scale-75"></div>
      
      <div className={`
        relative z-10 flex gap-4 p-6 bg-red-800 rounded-3xl border-4 border-tet-gold shadow-[0_10px_30px_rgba(0,0,0,0.5)]
        ${isShaking ? 'animate-shake' : ''}
      `}>
        {results.map((key, index) => {
          const item = getItemByKey(key);
          return (
            <div 
              key={index} 
              className={`
                w-20 h-20 md:w-24 md:h-24 bg-white rounded-xl flex flex-col items-center justify-center shadow-inner border-2 border-gray-200
                transition-transform duration-500
                ${isShaking ? 'rotate-12 scale-90' : 'rotate-0 scale-100 animate-pop'}
              `}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <span className="text-5xl md:text-6xl filter drop-shadow-md">{item.emoji}</span>
              <span className="text-xs font-bold text-gray-600 mt-1 uppercase">{item.name}</span>
            </div>
          );
        })}
      </div>
      
      {/* Tet Decoration */}
      <div className="absolute -top-4 -right-4 text-4xl animate-bounce" style={{ animationDuration: '3s' }}>🧧</div>
      <div className="absolute -bottom-4 -left-4 text-4xl animate-bounce" style={{ animationDuration: '2.5s' }}>🌸</div>
    </div>
  );
};

export default DiceContainer;