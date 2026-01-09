import React, { useState, useCallback, useEffect, useRef } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { GameItemKey, NetworkMessage, PlayerRole } from './types';
import { GAME_ITEMS, BET_INCREMENT, INITIAL_BALANCE, SHAKE_DURATION } from './constants';
import DiceContainer from './components/DiceContainer';
import BettingBoard from './components/BettingBoard';
import RoomControl from './components/RoomControl';
import ResultOverlay from './components/ResultOverlay';

// Utility for formatting money
const formatMoney = (amount: number) => 
  new Intl.NumberFormat('vi-VN').format(amount) + 'đ';

// PeerJS ID Prefix to avoid public ID collisions
const APP_PREFIX = 'baucuatet2025-';

// Helper to get empty bets object
const getEmptyBets = (): Record<GameItemKey, number> => ({
  NAI: 0, BAU: 0, GA: 0, CA: 0, CUA: 0, TOM: 0
});

const App: React.FC = () => {
  // --- Game State (Local Player) ---
  const [balance, setBalance] = useState<number>(INITIAL_BALANCE);
  const [bets, setBets] = useState<Record<GameItemKey, number>>(getEmptyBets());
  
  // --- Shared State (Room Info) ---
  const [globalBets, setGlobalBets] = useState<Record<GameItemKey, number>>(getEmptyBets());
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [diceResult, setDiceResult] = useState<GameItemKey[]>(['NAI', 'BAU', 'GA']);
  const [message, setMessage] = useState<string>("Chúc Mừng Năm Mới! Hãy đặt cược để lấy hên!");
  
  // Result Overlay State
  const [resultState, setResultState] = useState<{
    show: boolean;
    winAmount: number;
    totalBet: number;
    results: GameItemKey[];
  } | null>(null);

  // --- Network State ---
  const [roomId, setRoomId] = useState<string | null>(null);
  const [role, setRole] = useState<PlayerRole>('OFFLINE');
  const [playerCount, setPlayerCount] = useState<number>(1); // Host counts as 1

  // Refs for Network Logic (avoid stale closures)
  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<DataConnection[]>([]);
  
  // HOST ONLY: Track bets from ALL players (Map<PeerID, Bets>)
  // 'HOST' key is used for the Host's own bets
  const allPlayersBetsRef = useRef<Map<string, Record<GameItemKey, number>>>(new Map());

  // --- Initialization ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');

    if (roomParam) {
      joinRoomAsClient(roomParam);
    }

    return () => {
      if (peerRef.current) peerRef.current.destroy();
    };
  }, []);

  // --- Helpers for Host Logic ---

  // Calculate total bets from the Map (Always fresh data)
  const calculateGlobalBetsFromRef = useCallback(() => {
    const newGlobalBets = getEmptyBets();
    allPlayersBetsRef.current.forEach((playerBets) => {
      (Object.keys(playerBets) as GameItemKey[]).forEach((key) => {
        newGlobalBets[key] += playerBets[key];
      });
    });
    return newGlobalBets;
  }, []);

  const broadcast = useCallback((msg: NetworkMessage) => {
    connectionsRef.current.forEach(conn => {
      if (conn.open) {
        conn.send(msg);
      }
    });
  }, []);

  const updateAndBroadcastGlobalBets = useCallback(() => {
    const freshGlobalBets = calculateGlobalBetsFromRef();
    setGlobalBets(freshGlobalBets); // Update Host UI
    broadcast({ type: 'UPDATE_GLOBAL_BETS', bets: freshGlobalBets }); // Send to Clients
  }, [broadcast, calculateGlobalBetsFromRef]);


  // --- Network Setup Functions ---

  const initHostPeer = (attemptId: string) => {
    if (peerRef.current) peerRef.current.destroy();
    connectionsRef.current = [];
    allPlayersBetsRef.current.clear();
    
    // Initialize Host's empty bets in the map
    allPlayersBetsRef.current.set('HOST', getEmptyBets());

    const fullId = APP_PREFIX + attemptId;
    const peer = new Peer(fullId);
    
    peer.on('open', (id) => {
      console.log('HOST Connected with ID:', id);
      setRole('HOST');
      setRoomId(attemptId);
      peerRef.current = peer;
      setMessage("Phòng đã tạo! Hãy mời bạn bè.");

      try {
        const newPath = `?room=${attemptId}`;
        window.history.pushState({}, '', newPath);
      } catch (e) {
        // ignore
      }
    });

    peer.on('connection', (conn) => {
      console.log('Client connected:', conn.peer);
      connectionsRef.current.push(conn);
      setPlayerCount(prev => prev + 1);
      
      // Initialize new client's bets
      allPlayersBetsRef.current.set(conn.peer, getEmptyBets());

      conn.on('data', (data) => {
        handleHostReceivedMessage(data as NetworkMessage, conn.peer);
      });
      
      conn.on('open', () => {
         // IMPORTANT: Calculate fresh global bets right now to send to the new guy
         const freshGlobal = calculateGlobalBetsFromRef();
         conn.send({ type: 'UPDATE_GLOBAL_BETS', bets: freshGlobal });
         
         // If a shake was in progress or finished, we could sync that too, 
         // but for now let's just sync the bets.
      });
      
      conn.on('close', () => {
        console.log('Client disconnected:', conn.peer);
        connectionsRef.current = connectionsRef.current.filter(c => c !== conn);
        setPlayerCount(prev => Math.max(1, prev - 1));
        allPlayersBetsRef.current.delete(conn.peer);
        updateAndBroadcastGlobalBets();
      });
    });

    peer.on('error', (err) => {
      console.error('Peer Error:', err);
      if (err.type === 'unavailable-id') {
        const newId = Math.random().toString(36).substring(2, 8).toUpperCase();
        initHostPeer(newId);
      } else {
        setMessage("Lỗi tạo phòng. Hãy thử lại.");
      }
    });
  };

  const joinRoomAsClient = (targetRoomId: string) => {
    if (peerRef.current) peerRef.current.destroy();
    connectionsRef.current = [];

    const peer = new Peer();

    peer.on('open', (myId) => {
      console.log('CLIENT Me:', myId);
      setRole('CLIENT');
      setRoomId(targetRoomId);
      peerRef.current = peer;
      setMessage("Đang kết nối...");

      const conn = peer.connect(APP_PREFIX + targetRoomId);
      connectionsRef.current = [conn];

      conn.on('open', () => {
        setMessage("Đã vào phòng! Hãy đặt cược.");
      });

      conn.on('data', (data: unknown) => {
        handleClientReceivedMessage(data as NetworkMessage);
      });

      conn.on('close', () => {
        setMessage("Mất kết nối với chủ phòng.");
        setRole('OFFLINE');
      });
      
      conn.on('error', (err) => {
         console.error("Connection Error", err);
         setMessage("Không tìm thấy phòng này.");
      });
    });
  };

  // --- Message Handlers ---

  // HOST: Handle messages from Clients
  const handleHostReceivedMessage = (msg: NetworkMessage, peerId: string) => {
    if (msg.type === 'PLACE_BET') {
      const playerBets = allPlayersBetsRef.current.get(peerId) || getEmptyBets();
      playerBets[msg.key] += msg.amount;
      allPlayersBetsRef.current.set(peerId, playerBets);
      
      // Update everyone about the new total
      updateAndBroadcastGlobalBets();
    } 
    else if (msg.type === 'RESET_BETS') {
      allPlayersBetsRef.current.set(peerId, getEmptyBets());
      updateAndBroadcastGlobalBets();
    }
  };

  // CLIENT: Handle messages from Host
  const handleClientReceivedMessage = (msg: NetworkMessage) => {
    if (msg.type === 'SHAKE_START') {
      setIsShaking(true);
      setResultState(null); 
      setMessage("Chủ phòng đang lắc...");
    } else if (msg.type === 'SHAKE_RESULT') {
      setIsShaking(false);
      setDiceResult(msg.results);
      calculateWinnings(msg.results);
    } else if (msg.type === 'UPDATE_GLOBAL_BETS') {
      setGlobalBets(msg.bets);
    }
  };

  // --- Game Actions ---

  const calculateWinnings = (results: GameItemKey[]) => {
    let totalReturn = 0; 
    const counts: Record<string, number> = {};
    results.forEach(x => { counts[x] = (counts[x] || 0) + 1; });

    let currentTotalBet = 0;
    
    // Calculate based on LOCAL bets
    (Object.keys(bets) as GameItemKey[]).forEach(key => {
      const betAmount = bets[key];
      const appearances = counts[key] || 0;
      currentTotalBet += betAmount;

      if (betAmount > 0 && appearances > 0) {
           const profit = betAmount * appearances;
           const refund = betAmount;
           totalReturn += (refund + profit);
      }
    });

    // Update Wallet
    setBalance(prev => prev + totalReturn);

    // Show Result Overlay
    setResultState({
      show: true,
      winAmount: totalReturn,
      totalBet: currentTotalBet,
      results: results
    });

    // Clear LOCAL bets for next round
    setBets(getEmptyBets());
    
    // UI Feedback
    if (currentTotalBet > 0) {
      if (totalReturn > currentTotalBet) {
         setMessage(`Thắng +${formatMoney(totalReturn - currentTotalBet)}!`);
      } else if (totalReturn > 0) {
         setMessage(`Hòa vốn.`);
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
      setMessage("Hết tiền rồi!");
      return;
    }
    
    // 1. Update LOCAL state immediately (Optimistic UI)
    setBalance(prev => prev - BET_INCREMENT);
    setBets((prev) => ({ ...prev, [key]: (prev[key] || 0) + BET_INCREMENT }));

    // 2. Network Sync
    if (role === 'CLIENT') {
      // Send to Host
      const conn = connectionsRef.current[0];
      if (conn && conn.open) {
        conn.send({ type: 'PLACE_BET', key, amount: BET_INCREMENT });
      } else {
        // Fallback if offline? For now just allow local play but warn
        // setMessage("Đang chơi offline (không sync)");
      }
    } else if (role === 'HOST') {
      // Host updates their own record in the Map
      const hostBets = allPlayersBetsRef.current.get('HOST') || getEmptyBets();
      hostBets[key] += BET_INCREMENT;
      allPlayersBetsRef.current.set('HOST', hostBets);
      
      // Update everyone
      updateAndBroadcastGlobalBets();
    }
  };

  const handleResetBets = () => {
    if (isShaking) return;
    
    // Refund Local
    let totalBets = 0;
    (Object.keys(bets) as GameItemKey[]).forEach(key => {
      totalBets += bets[key];
    });
    setBalance(prev => prev + totalBets);
    setBets(getEmptyBets());
    setMessage("Đã hoàn tiền.");

    // Network Sync
    if (role === 'CLIENT') {
      const conn = connectionsRef.current[0];
      if (conn && conn.open) {
        conn.send({ type: 'RESET_BETS' });
      }
    } else if (role === 'HOST') {
      allPlayersBetsRef.current.set('HOST', getEmptyBets());
      updateAndBroadcastGlobalBets();
    }
  };

  const handleHostShake = useCallback(() => {
    if (role !== 'HOST') return;
    
    setIsShaking(true);
    setResultState(null); 
    setMessage("Đang lắc...");

    broadcast({ type: 'SHAKE_START' });

    setTimeout(() => {
      // 1. Determine Results
      const newResults: GameItemKey[] = [];
      for (let i = 0; i < 3; i++) {
        const randomIndex = Math.floor(Math.random() * GAME_ITEMS.length);
        newResults.push(GAME_ITEMS[randomIndex].key);
      }

      setDiceResult(newResults);
      setIsShaking(false);
      
      // 2. Broadcast Results
      broadcast({ type: 'SHAKE_RESULT', results: newResults });
      
      // 3. Host calculates their own winnings locally
      calculateWinnings(newResults);
      
      // 4. Reset Global Bets Tracking for next round
      // Important: Keep the keys (players) but reset their values to 0
      Array.from(allPlayersBetsRef.current.keys()).forEach(peerId => {
        allPlayersBetsRef.current.set(peerId, getEmptyBets());
      });
      
      // 5. Sync the clean board to everyone
      updateAndBroadcastGlobalBets();

    }, SHAKE_DURATION);
  }, [role, broadcast, updateAndBroadcastGlobalBets]);

  const handleCreateRoomAction = () => {
    setMessage("Đang khởi tạo...");
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    initHostPeer(newRoomId);
  };
  
  const handleCopyLink = () => {
    if (roomId) {
      const url = window.location.href.split('?')[0] + '?room=' + roomId;
      navigator.clipboard.writeText(url);
      alert('Đã sao chép link phòng!');
    }
  };

  const currentTotalBet = (Object.values(bets) as number[]).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-[url('https://www.transparenttextures.com/patterns/red-paper.png')] bg-fixed flex flex-col items-center pb-12 relative">
      
      {/* Result Overlay */}
      {resultState && resultState.show && (
        <ResultOverlay 
          winAmount={resultState.winAmount}
          totalBet={resultState.totalBet}
          results={resultState.results}
          onClose={() => setResultState(prev => prev ? { ...prev, show: false } : null)}
        />
      )}

      {/* Room Control */}
      <RoomControl 
        currentRoomId={roomId} 
        onCreateRoom={handleCreateRoomAction}
        onCopyLink={handleCopyLink}
      />

      {/* Network Status Pill */}
      {roomId && (
        <div className="absolute top-4 left-4 z-40 bg-black/60 backdrop-blur text-white px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 border border-white/20 shadow-lg">
          <div className={`w-2.5 h-2.5 rounded-full ${role === 'OFFLINE' ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`}></div>
          {role === 'HOST' ? (
            <span>Chủ phòng • {playerCount} người online</span>
          ) : role === 'CLIENT' ? (
             <span>Người chơi • Đã kết nối</span>
          ) : (
             <span>Mất kết nối</span>
          )}
        </div>
      )}

      {/* Header */}
      <header className="w-full bg-tet-red border-b-4 border-tet-gold shadow-lg pt-6 pb-4 px-4 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-yellow-300 via-red-600 to-red-900"></div>
        <h1 className="font-display text-4xl md:text-6xl text-tet-gold drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)] relative z-10">
          BẦU CUA TẾT
        </h1>
        <p className="text-tet-cream font-sans mt-2 opacity-90 relative z-10 font-bold tracking-wide">
          {role === 'CLIENT' ? 'CHẾ ĐỘ NGƯỜI CHƠI' : role === 'HOST' ? 'CHẾ ĐỘ CHỦ PHÒNG' : 'CHƠI OFFLINE'}
        </p>
      </header>

      {/* Main Game Area */}
      <main className="flex-1 w-full max-w-4xl px-4 py-6 flex flex-col items-center gap-6">
        
        {/* Dice Section */}
        <section className="w-full">
          <DiceContainer isShaking={isShaking} results={diceResult} />
        </section>

        {/* Status Message */}
        <div className="bg-tet-cream/95 text-tet-darkRed border-2 border-tet-gold rounded-xl px-6 py-3 text-center font-bold shadow-md w-full max-w-md min-h-[3.5rem] flex items-center justify-center transition-all">
          {message}
        </div>

        {/* Betting Board */}
        <section className="w-full">
           <BettingBoard 
             bets={bets} 
             globalBets={globalBets} 
             onPlaceBet={handlePlaceBet} 
             disabled={isShaking || role === 'OFFLINE' && !roomId && false /* Allow offline play if no room */} 
            />
        </section>

        {/* Controls */}
        <section className="w-full max-w-2xl bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-tet-gold/30 shadow-2xl sticky bottom-4 z-50">
           <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              
              <div className="flex flex-col items-center md:items-start min-w-[120px]">
                 <span className="text-tet-gold text-xs uppercase font-bold tracking-wider mb-1">Ví Của Bạn</span>
                 <div className="text-3xl font-display text-white drop-shadow-md">
                    {formatMoney(balance)}
                 </div>
                 {currentTotalBet > 0 && (
                   <span className="text-red-200 text-xs font-bold">Đang cược: {formatMoney(currentTotalBet)}</span>
                 )}
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                 <button 
                   onClick={handleResetBets}
                   disabled={isShaking || currentTotalBet === 0}
                   className="flex-1 md:flex-none px-4 py-3 rounded-xl bg-gray-600 hover:bg-gray-500 text-white font-bold transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg border-b-4 border-gray-800 active:border-b-0 active:translate-y-1"
                 >
                   Hủy Cược
                 </button>
                 
                 {role === 'CLIENT' ? (
                   <button 
                     disabled={true}
                     className="flex-[2] md:flex-none px-6 py-3 rounded-xl bg-gray-400 text-gray-800 font-display text-lg md:text-xl uppercase tracking-wider cursor-not-allowed opacity-80 border-b-4 border-gray-600 shadow-lg"
                   >
                     {isShaking ? 'Đang Lắc...' : 'Chờ Nhà Cái'}
                   </button>
                 ) : (
                   <button 
                     onClick={handleHostShake}
                     disabled={isShaking}
                     className="flex-[2] md:flex-none px-8 py-3 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-300 hover:to-yellow-500 text-red-900 font-display text-xl uppercase tracking-wider transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg border-b-4 border-yellow-700 active:border-b-0 active:translate-y-1 animate-pulse"
                   >
                     {isShaking ? 'Đang Lắc...' : 'Xốc Đĩa!'}
                   </button>
                 )}
              </div>
           </div>
        </section>

      </main>

      <footer className="w-full text-center py-4 text-red-300 text-xs">
         © 2025 Game Bầu Cua Online - PeerJS P2P
      </footer>
    </div>
  );
};

export default App;