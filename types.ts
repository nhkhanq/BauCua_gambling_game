export type GameItemKey = 'NAI' | 'BAU' | 'GA' | 'CA' | 'CUA' | 'TOM';

export interface GameItem {
  key: GameItemKey;
  name: string;
  emoji: string; // Using emoji as placeholder/icon
  color: string;
}

export interface PlayerInfo {
  id: string;
  name: string;
  balance: number;
  isHost: boolean;
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
  | { type: 'PLACE_BET'; key: GameItemKey; amount: number } // Client sends to Host
  | { type: 'RESET_BETS' } // Client requests Host to clear their bets
  | { type: 'UPDATE_GLOBAL_BETS'; bets: Record<GameItemKey, number> } // Host broadcasts total bets
  | { type: 'PLAYER_UPDATE'; info: PlayerInfo } // Client sends their info (balance/name) to Host
  | { type: 'LEADERBOARD_UPDATE'; players: PlayerInfo[] } // Host broadcasts list of all players
  | { type: 'PLAYER_JOINED'; playerName: string } // Host broadcasts when player joins
  | { type: 'PLAYER_LEFT'; playerName: string } // Host broadcasts when player leaves
  | { type: 'KICKED_NO_MONEY' } // Host sends to specific client to kick them
  | { type: 'JOIN_REQUEST'; playerInfo: PlayerInfo } // Client sends initial join request
  | { type: 'JOIN_ACCEPTED'; roomState: { globalBets: Record<GameItemKey, number>; players: PlayerInfo[] } } // Host confirms join
  | { type: 'JOIN_REJECTED'; reason: string }; // Host rejects join (e.g., insufficient balance)