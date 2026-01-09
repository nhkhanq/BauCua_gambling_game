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
export const MIN_BALANCE_TO_JOIN = 10000; // Tối thiểu 10k để vào phòng
export const MIN_BALANCE_TO_STAY = 5000; // Nếu dưới 5k sẽ bị kick

// PeerJS Configuration with public STUN/TURN servers for better NAT traversal
export const PEER_CONFIG = {
  config: {
    iceServers: [
      // Google's public STUN servers
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      // Cloudflare STUN server
      { urls: 'stun:stun.cloudflare.com:3478' },
    ],
    iceTransportPolicy: 'all' as RTCIceTransportPolicy,
  },
  // Using public PeerJS server (có thể thay thế bằng server riêng nếu cần)
  host: 'peerjs-server.herokuapp.com',
  port: 443,
  path: '/',
  secure: true,
  // Enable debug mode để xem logs
  debug: 0, // 0: none, 1: errors, 2: warnings, 3: all
  // Heartbeat configuration
  pingInterval: 5000,
};

// Helper to look up item details
export const getItemByKey = (key: GameItemKey): GameItem => {
  const item = GAME_ITEMS.find(i => i.key === key);
  if (!item) throw new Error(`Item ${key} not found`);
  return item;
};