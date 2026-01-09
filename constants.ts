import { GameItem, GameItemKey } from './types';

export const GAME_ITEMS: GameItem[] = [
  { key: 'NAI', name: 'Nai', emoji: '🦌', color: 'bg-stone-600' },
  { key: 'BAU', name: 'Bầu', emoji: '🥒', color: 'bg-green-600' },
  { key: 'GA', name: 'Gà', emoji: '🐓', color: 'bg-orange-600' },
  { key: 'CA', name: 'Cá', emoji: '🐟', color: 'bg-blue-600' },
  { key: 'CUA', name: 'Cua', emoji: '🦀', color: 'bg-red-600' },
  { key: 'TOM', name: 'Tôm', emoji: '🦐', color: 'bg-teal-600' },
];

export const BET_INCREMENT = 5000;
export const INITIAL_BALANCE = 100000;
export const SHAKE_DURATION = 1500; // ms

// Helper to look up item details
export const getItemByKey = (key: GameItemKey): GameItem => {
  const item = GAME_ITEMS.find(i => i.key === key);
  if (!item) throw new Error(`Item ${key} not found`);
  return item;
};