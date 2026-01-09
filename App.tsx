import React, { useState, useCallback, useEffect, useRef } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { GameItemKey, NetworkMessage, PlayerRole } from './types';
import { GAME_ITEMS, BET_INCREMENT, INITIAL_BALANCE, SHAKE_DURATION } from './constants';
import DiceContainer from './components/DiceContainer';
import BettingBoard from './components/BettingBoard';
import RoomControl from './components/RoomControl';

// Utility for formatting money
const formatMoney = (amount: number) => 
  new Intl.NumberFormat('vi-VN').format(amount) + 'đ';

// PeerJS ID Prefix to avoid public ID collisions
const APP_PREFIX = 'baucuatet2025-';

const App: React.FC = () => {
  // --- Game State ---
  const [balance, setBalance] = useState<number>(INITIAL_BALANCE);
  const [bets, setBets] = useState<Record<GameItemKey, number>>({
    NAI: 0, BAU: 0, GA: 0, CA: 0, CUA: 0, TOM: 0
  });
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [diceResult, setDiceResult] = useState<GameItemKey[]>(['NAI', 'BAU', 'GA']);
  const [lastWin, setLastWin] = useState<number>(0);
  const [message, setMessage] = useState<string>("Chúc Mừng Năm Mới! Hãy đặt cược để lấy hên!");
  
  // --- Network State ---
  const [roomId, setRoomId] = useState<string | null>(null);
  const [role, setRole] = useState<PlayerRole>('OFFLINE');
  const [playerCount, setPlayerCount] = useState<number>(1);

  // Refs for managing Peer lifecycle without re-renders
  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<DataConnection[]>([]);

  // --- Initialization Effect ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');

    if (roomParam) {
      joinRoomAsClient(roomParam);
    }

    // Cleanup on unmount
    return () => {
      if (peerRef.current) {
        peerRef.current.destroy();
      }
    };
  }, []);

  // --- Network Functions ---

  const initHostPeer = (attemptId: string) => {
    // If a peer already exists, destroy it first
    if (peerRef.current) peerRef.current.destroy();

    const fullId = APP_PREFIX + attemptId;
    const peer = new Peer(fullId);
    
    peer.on('open', (id) => {
      console.log('HOST Connected with ID:', id);
      setRole('HOST');
      setRoomId(attemptId);
      peerRef.current = peer;
      setMessage("Phòng đã tạo! Hãy mời bạn bè.");

      // Safe URL update: Use relative path and try-catch to avoid SecurityError in sandboxes/blobs
      try {
        const newPath = `?room=${attemptId}`;
        window.history.pushState({}, '', newPath);
      } catch (e) {
        console.warn('URL update skipped (environment restriction):', e);
      }
    });

    peer.on('connection', (conn) => {
      console.log('Client connected:', conn.peer);
      connectionsRef.current.push(conn);
      setPlayerCount(prev => prev + 1);

      conn.on('open', () => {
        // Optional: Send current game state to new player
      });
      
      conn.on('close', () => {
        connectionsRef.current = connectionsRef.current.filter(c => c !== conn);
        setPlayerCount(prev => Math.max(1, prev - 1));
      });
    });

    peer.on('error', (err) => {
      console.error('Peer Error:', err);
      if (err.type === 'unavailable-id') {
        // Retry with a new ID if taken
        const newId = Math.random().toString(36).substring(2, 8).toUpperCase();
        initHostPeer(newId);
      } else {
        setMessage("Lỗi kết nối mạng. Vui lòng thử lại.");
      }
    });
  };

  const joinRoomAsClient = (targetRoomId: string) => {
    if (peerRef.current) peerRef.current.destroy();

    // Client needs no specific ID
    const peer = new Peer();

    peer.on('open', (myId) => {
      console.log('CLIENT Me:', myId);
      setRole('CLIENT');
      setRoomId(targetRoomId);
      peerRef.current = peer;
      setMessage("Đang kết nối tới chủ phòng...");

      const conn = peer.connect(APP_PREFIX + targetRoomId);

      conn.on('open', () => {
        setMessage("Đã vào phòng! Chờ chủ phòng lắc.");
      });

      conn.on('data', (data: unknown) => {
        handleNetworkMessage(data as NetworkMessage);
      });

      conn.on('close', () => {
        setMessage("Chủ phòng đã thoát.");
        setRole('OFFLINE');
      });
      
      conn.on('error', (err) => {
         console.error("Connection Error", err);
         setMessage("Không thể kết nối tới phòng này.");
      });
    });

    peer.on('error', (err) => {
      console.error('Client Peer Error:', err);
      setMessage("Lỗi mạng client.");
    });
  };

  const handleCreateRoomAction = () => {
    setMessage("Đang tạo phòng...");
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    initHostPeer(newRoomId);
  };

  const handleCopyLink = () => {
    if (roomId) {
      // Robust link generation
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('room', roomId);
        navigator.clipboard.writeText(url.toString());
        alert('Đã sao chép link!');
      } catch (e) {
        // Fallback for simple copy
        navigator.clipboard.writeText(window.location.href);
        alert('Đã sao chép link!');
      }
    }
  };

  const broadcast = (msg: NetworkMessage) => {
    connectionsRef.current.forEach(conn => {
      if (conn.open) {
        conn.send(msg);
      }
    });
  };

  const handleNetworkMessage = (msg: NetworkMessage) => {
    if (msg.type === 'SHAKE_START') {
      setIsShaking(true);
      setMessage("Chủ phòng đang lắc...");
      setLastWin(0);
    } else if (msg.type === 'SHAKE_RESULT') {
      setIsShaking(false);
      setDiceResult(msg.results);
      calculateWinnings(msg.results);
    }
  };

  // --- Game Logic ---

  const calculateWinnings = (results: GameItemKey[]) => {
    let totalWinnings = 0;
    const counts: Record<string, number> = {};
    results.forEach(x => { counts[x] = (counts[x] || 0) + 1; });

    let hasBet = false;
    let currentTotalBet = 0;
    
    (Object.keys(bets) as GameItemKey[]).forEach(key => {
      const betAmount = bets[key];
      const appearances = counts[key] || 0;
      currentTotalBet += betAmount;

      if (betAmount > 0) {
        hasBet = true;
        if (appearances > 0) {
           const profit = betAmount * appearances;
           const refund = betAmount;
           totalWinnings += (refund + profit);
        }
      }
    });

    setBalance(prev => prev + totalWinnings);
    setLastWin(totalWinnings);
    setBets({ NAI: 0, BAU: 0, GA: 0, CA: 0, CUA: 0, TOM: 0 });

    if (hasBet) {
      if (totalWinnings > 0) {
         setMessage(`Thắng ${formatMoney(totalWinnings)}!`);
      } else {
         setMessage(`Thua ${formatMoney(currentTotalBet)}.`);
      }
    } else {
      setMessage(`Kết quả: ${results.map(k => GAME_ITEMS.find(i=>i.key===k)?.name).join(', ')}.`);
    }
  };

  const handlePlaceBet = (key: GameItemKey) => {
    if (isShaking) return;
    if (balance < BET_INCREMENT) {
      setMessage("Không đủ tiền!");
      return;
    }
    setBalance(prev => prev - BET_INCREMENT);
    setBets((prev) => ({ ...prev, [key]: (prev[key] || 0) + BET_INCREMENT }));
  };

  const handleResetBets = () => {
    if (isShaking) return;
    let totalBets = 0;
    (Object.keys(bets) as GameItemKey[]).forEach(key => {
      totalBets += bets[key];
    });
    setBalance(prev => prev + totalBets);
    setBets({ NAI: 0, BAU: 0, GA: 0, CA: 0, CUA: 0, TOM: 0 });
    setMessage("Đã hoàn tiền.");
  };

  const handleHostShake = useCallback(() => {
    if (role === 'CLIENT') return;
    
    setIsShaking(true);
    setMessage("Đang lắc...");
    setLastWin(0);

    broadcast({ type: 'SHAKE_START' });

    setTimeout(() => {
      const newResults: GameItemKey[] = [];
      for (let i = 0; i < 3; i++) {
        const randomIndex = Math.floor(Math.random() * GAME_ITEMS.length);
        newResults.push(GAME_ITEMS[randomIndex].key);
      }

      setDiceResult(newResults);
      setIsShaking(false);
      broadcast({ type: 'SHAKE_RESULT', results: newResults });
      calculateWinnings(newResults);
    }, SHAKE_DURATION);
  }, [bets, role]);

  const currentTotalBet = (Object.values(bets) as number[]).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-[url('https://www.transparenttextures.com/patterns/red-paper.png')] bg-fixed flex flex-col items-center pb-12 relative">
      
      {/* Room Control */}
      <RoomControl 
        currentRoomId={roomId} 
        onCreateRoom={handleCreateRoomAction}
        onCopyLink={handleCopyLink}
      />

      {/* Network Status Pill */}
      {roomId && (
        <div className="absolute top-4 left-4 z-40 bg-black/50 backdrop-blur text-white px-3 py-1 rounded-full text-xs flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${role === 'OFFLINE' ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`}></div>
          {role === 'HOST' ? `Chủ phòng (${playerCount})` : role === 'CLIENT' ? 'Đã tham gia' : 'Mất kết nối'}
        </div>
      )}

      {/* Header */}
      <header className="w-full bg-tet-red border-b-4 border-tet-gold shadow-lg pt-6 pb-4 px-4 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-yellow-300 via-red-600 to-red-900"></div>
        <h1 className="font-display text-4xl md:text-6xl text-tet-gold drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)] relative z-10">
          BẦU CUA TẾT
        </h1>
        <p className="text-tet-cream font-sans mt-2 opacity-90 relative z-10">
          {role === 'CLIENT' ? 'Chế độ người chơi' : 'Vận may đầu năm'}
        </p>
      </header>

      {/* Main Game Area */}
      <main className="flex-1 w-full max-w-4xl px-4 py-6 flex flex-col items-center gap-6">
        
        {/* Dice Section */}
        <section className="w-full">
          <DiceContainer isShaking={isShaking} results={diceResult} />
        </section>

        {/* Status Message */}
        <div className="bg-tet-cream/90 text-tet-darkRed border-2 border-tet-gold rounded-xl px-6 py-3 text-center font-bold shadow-md w-full max-w-md min-h-[3.5rem] flex items-center justify-center transition-all">
          {message}
        </div>

        {/* Betting Board */}
        <section className="w-full">
           <BettingBoard bets={bets} onPlaceBet={handlePlaceBet} disabled={isShaking} />
        </section>

        {/* Controls */}
        <section className="w-full max-w-2xl bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-tet-gold/30 shadow-2xl sticky bottom-4 z-50">
           <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              
              <div className="flex flex-col items-center md:items-start">
                 <span className="text-tet-gold text-sm uppercase font-bold tracking-wider">Tài khoản</span>
                 <div className="text-3xl font-display text-white drop-shadow-md">
                    {formatMoney(balance)}
                 </div>
                 {currentTotalBet > 0 && (
                   <span className="text-red-200 text-xs">Đang cược: {formatMoney(currentTotalBet)}</span>
                 )}
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                 <button 
                   onClick={handleResetBets}
                   disabled={isShaking || currentTotalBet === 0}
                   className="flex-1 md:flex-none px-4 py-3 rounded-xl bg-gray-600 hover:bg-gray-500 text-white font-bold transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg border-b-4 border-gray-800 active:border-b-0 active:translate-y-1"
                 >
                   Hủy
                 </button>
                 
                 {role === 'CLIENT' ? (
                   <button 
                     disabled={true}
                     className="flex-[2] md:flex-none px-8 py-3 rounded-xl bg-gray-400 text-gray-800 font-display text-xl uppercase tracking-wider cursor-not-allowed opacity-80 border-b-4 border-gray-600"
                   >
                     {isShaking ? 'Đang Lắc...' : 'Chờ Chủ Phòng'}
                   </button>
                 ) : (
                   <button 
                     onClick={handleHostShake}
                     disabled={isShaking}
                     className="flex-[2] md:flex-none px-8 py-3 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-300 hover:to-yellow-500 text-red-900 font-display text-xl uppercase tracking-wider transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg border-b-4 border-yellow-700 active:border-b-0 active:translate-y-1 animate-pulse"
                   >
                     {isShaking ? 'Đang Lắc...' : 'Lắc Ngay!'}
                   </button>
                 )}
              </div>
           </div>
        </section>

      </main>

      <footer className="w-full text-center py-4 text-red-300 text-xs">
         © 2025 Game Bầu Cua Online - Kết nối PeerJS
      </footer>
    </div>
  );
};

export default App;