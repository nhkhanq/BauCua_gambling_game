export type GameItemKey = 'NAI' | 'BAU' | 'GA' | 'CA' | 'CUA' | 'TOM';

export interface GameItem {
  key: GameItemKey;
  name: string;
  emoji: string; // Using emoji as placeholder/icon
  color: string;
}

export interface GameState {
  balance: number;
  bets: Record<GameItemKey, number>;
  isShaking: boolean;
  diceResult: GameItemKey[];
  lastWinAmount: number;
  message: string;
}

// --- Network Types ---

export type PlayerRole = 'HOST' | 'CLIENT' | 'OFFLINE';

export type NetworkMessage = 
  | { type: 'SHAKE_START' }
  | { type: 'SHAKE_RESULT'; results: GameItemKey[] }
  | { type: 'PLAYER_JOINED'; count: number }
  | { type: 'PLACE_BET'; key: GameItemKey; amount: number } // Client sends to Host
  | { type: 'RESET_BETS' } // Client requests Host to clear their bets
  | { type: 'UPDATE_GLOBAL_BETS'; bets: Record<GameItemKey, number> }; // Host broadcasts total bets