import React, { useState, useCallback, useEffect, useRef } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { GameItemKey, NetworkMessage, PlayerRole, PlayerInfo } from './types';
import { GAME_ITEMS, BET_INCREMENT, INITIAL_BALANCE, SHAKE_DURATION } from './constants';
import DiceContainer from './components/DiceContainer';
import BettingBoard from './components/BettingBoard';
import RoomControl from './components/RoomControl';
import ResultOverlay from './components/ResultOverlay';
import Leaderboard from './components/Leaderboard';

// Utility for formatting money
const formatMoney = (amount: number) => 
  new Intl.NumberFormat('vi-VN').format(amount) + 'đ';

// PeerJS ID Prefix
const APP_PREFIX = 'baucuatet2025-';

// Random Name Generator
const generateName = () => {
  const adjs = ['Đại Gia', 'Tỷ Phú', 'Thần Tài', 'Vua', 'Trùm'];
  const names = ['A', 'B', 'C', 'X', 'Y', 'Z', 'Tâm', 'Phát', 'Lộc'];
  return `${adjs[Math.floor(Math.random() * adjs.length)]} ${names[Math.floor(Math.random() * names.length)]}`;
};

const getEmptyBets = (): Record<GameItemKey, number> => ({
  NAI: 0, BAU: 0, GA: 0, CA: 0, CUA: 0, TOM: 0
});

const App: React.FC = () => {
  // --- Local Player State ---
  const [myId, setMyId] = useState<string>('');
  const [myName] = useState<string>(() => {
    return localStorage.getItem('playerName') || generateName();
  });
  const [balance, setBalance] = useState<number>(INITIAL_BALANCE);
  const [bets, setBets] = useState<Record<GameItemKey, number>>(getEmptyBets());
  
  // --- Shared State ---
  const [globalBets, setGlobalBets] = useState<Record<GameItemKey, number>>(getEmptyBets());
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [diceResult, setDiceResult] = useState<GameItemKey[]>(['NAI', 'BAU', 'GA']);
  const [message, setMessage] = useState<string>("Chúc Mừng Năm Mới! Hãy đặt cược để lấy hên!");
  const [leaderboard, setLeaderboard] = useState<PlayerInfo[]>([]);
  
  // Result Overlay
  const [resultState, setResultState] = useState<{
    show: boolean;
    winAmount: number;
    totalBet: number;
    results: GameItemKey[];
  } | null>(null);

  // --- Network State ---
  const [roomId, setRoomId] = useState<string | null>(null);
  const [role, setRole] = useState<PlayerRole>('OFFLINE');

  // Refs
  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<DataConnection[]>([]);
  const allPlayersBetsRef = useRef<Map<string, Record<GameItemKey, number>>>(new Map());
  
  // HOST ONLY: Map of all connected players to track their info
  const playersInfoRef = useRef<Map<string, PlayerInfo>>(new Map());

  // --- Initialization ---
  useEffect(() => {
    localStorage.setItem('playerName', myName);
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) joinRoomAsClient(roomParam);

    return () => {
      if (peerRef.current) peerRef.current.destroy();
    };
  }, []);

  // --- Sync my info to Host whenever balance changes ---
  useEffect(() => {
    if (role === 'CLIENT' && myId) {
      const msg: NetworkMessage = {
        type: 'PLAYER_UPDATE',
        info: { id: myId, name: myName, balance, isHost: false }
      };
      // Send to host
      if (connectionsRef.current[0]?.open) {
        connectionsRef.current[0].send(msg);
      }
    } else if (role === 'HOST' && myId) {
      // Host updates their own info in the map directly
      playersInfoRef.current.set(myId, { id: myId, name: myName, balance, isHost: true });
      updateAndBroadcastLeaderboard();
    }
  }, [balance, role, myId, myName]);

  // --- Host Helpers ---

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
      if (conn.open) conn.send(msg);
    });
  }, []);

  const updateAndBroadcastGlobalBets = useCallback(() => {
    const freshGlobalBets = calculateGlobalBetsFromRef();
    setGlobalBets(freshGlobalBets);
    broadcast({ type: 'UPDATE_GLOBAL_BETS', bets: freshGlobalBets });
  }, [broadcast, calculateGlobalBetsFromRef]);

  const updateAndBroadcastLeaderboard = useCallback(() => {
    const playersList = Array.from(playersInfoRef.current.values());
    setLeaderboard(playersList);
    broadcast({ type: 'LEADERBOARD_UPDATE', players: playersList });
  }, [broadcast]);

  // --- Network Setup ---

  const initHostPeer = (attemptId: string) => {
    if (peerRef.current) peerRef.current.destroy();
    connectionsRef.current = [];
    allPlayersBetsRef.current.clear();
    playersInfoRef.current.clear();
    
    const fullId = APP_PREFIX + attemptId;
    const peer = new Peer(fullId);
    
    peer.on('open', () => {
      console.log('HOST ID:', fullId);
      setRole('HOST');
      setRoomId(attemptId);
      setMyId(fullId); // Host uses PeerID as ID
      peerRef.current = peer;
      setMessage("Phòng đã tạo! Đợi người chơi...");

      // Init Host info
      allPlayersBetsRef.current.set(fullId, getEmptyBets());
      playersInfoRef.current.set(fullId, { id: fullId, name: myName, balance, isHost: true });
      updateAndBroadcastLeaderboard();
      
      window.history.pushState({}, '', `?room=${attemptId}`);
    });

    peer.on('connection', (conn) => {
      connectionsRef.current.push(conn);
      allPlayersBetsRef.current.set(conn.peer, getEmptyBets());

      conn.on('data', (data) => handleHostReceivedMessage(data as NetworkMessage, conn.peer));
      
      conn.on('open', () => {
         // Sync state to new client
         conn.send({ type: 'UPDATE_GLOBAL_BETS', bets: calculateGlobalBetsFromRef() });
         conn.send({ type: 'LEADERBOARD_UPDATE', players: Array.from(playersInfoRef.current.values()) });
         // If a shake happened recently, we could sync that too, but let's keep it simple
      });
      
      conn.on('close', () => {
        connectionsRef.current = connectionsRef.current.filter(c => c !== conn);
        allPlayersBetsRef.current.delete(conn.peer);
        playersInfoRef.current.delete(conn.peer); // Remove from leaderboard
        updateAndBroadcastGlobalBets();
        updateAndBroadcastLeaderboard();
      });
    });

    peer.on('error', (err) => {
      if (err.type === 'unavailable-id') {
        initHostPeer(Math.random().toString(36).substring(2, 8).toUpperCase());
      } else {
        setMessage("Lỗi mạng. Vui lòng tải lại.");
      }
    });
  };

  const joinRoomAsClient = (targetRoomId: string) => {
    if (peerRef.current) peerRef.current.destroy();
    connectionsRef.current = [];

    const peer = new Peer();

    peer.on('open', (id) => {
      setRole('CLIENT');
      setRoomId(targetRoomId);
      setMyId(id);
      peerRef.current = peer;
      setMessage("Đang vào phòng...");

      const conn = peer.connect(APP_PREFIX + targetRoomId);
      connectionsRef.current = [conn];

      conn.on('open', () => {
        setMessage("Đã kết nối! Đặt cược đi.");
        // Immediately send my info
        conn.send({ 
          type: 'PLAYER_UPDATE', 
          info: { id, name: myName, balance, isHost: false } 
        } as NetworkMessage);
      });

      conn.on('data', (data) => handleClientReceivedMessage(data as NetworkMessage));
      
      conn.on('close', () => {
        setMessage("Mất kết nối với chủ phòng.");
        setRole('OFFLINE');
      });

      conn.on('error', () => setMessage("Không tìm thấy phòng này."));
    });
  };

  // --- Message Handlers ---

  const handleHostReceivedMessage = (msg: NetworkMessage, peerId: string) => {
    if (msg.type === 'PLACE_BET') {
      const playerBets = allPlayersBetsRef.current.get(peerId) || getEmptyBets();
      playerBets[msg.key] += msg.amount;
      allPlayersBetsRef.current.set(peerId, playerBets);
      updateAndBroadcastGlobalBets();
    } 
    else if (msg.type === 'RESET_BETS') {
      allPlayersBetsRef.current.set(peerId, getEmptyBets());
      updateAndBroadcastGlobalBets();
    }
    else if (msg.type === 'PLAYER_UPDATE') {
      // Update player info registry
      playersInfoRef.current.set(peerId, msg.info);
      updateAndBroadcastLeaderboard();
    }
  };

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
    } else if (msg.type === 'LEADERBOARD_UPDATE') {
      setLeaderboard(msg.players);
    }
  };

  // --- Game Logic ---

  const calculateWinnings = (results: GameItemKey[]) => {
    let totalReturn = 0; 
    const counts: Record<string, number> = {};
    results.forEach(x => { counts[x] = (counts[x] || 0) + 1; });

    let currentTotalBet = 0;
    
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

    setBalance(prev => prev + totalReturn); // Trigger useEffect -> PLAYER_UPDATE

    setResultState({
      show: true,
      winAmount: totalReturn,
      totalBet: currentTotalBet,
      results: results
    });

    setBets(getEmptyBets());
    
    if (currentTotalBet > 0) {
       // Messages handled by ResultOverlay visually, but we update text bar too
       if (totalReturn > currentTotalBet) setMessage(`Thắng +${formatMoney(totalReturn - currentTotalBet)}!`);
       else if (totalReturn > 0) setMessage(`Hòa vốn.`);
       else setMessage(`Thua ${formatMoney(currentTotalBet)}.`);
    } else {
       setMessage("Kết quả đã có!");
    }
  };

  const handlePlaceBet = (key: GameItemKey) => {
    if (isShaking) return;
    if (balance < BET_INCREMENT) {
      setMessage("Hết tiền rồi!");
      return;
    }
    
    setBalance(prev => prev - BET_INCREMENT); // Trigger useEffect -> PLAYER_UPDATE
    setBets((prev) => ({ ...prev, [key]: (prev[key] || 0) + BET_INCREMENT }));

    if (role === 'CLIENT') {
      if (connectionsRef.current[0]?.open) {
        connectionsRef.current[0].send({ type: 'PLACE_BET', key, amount: BET_INCREMENT });
      }
    } else if (role === 'HOST') {
      const hostBets = allPlayersBetsRef.current.get(myId) || getEmptyBets();
      hostBets[key] += BET_INCREMENT;
      allPlayersBetsRef.current.set(myId, hostBets);
      updateAndBroadcastGlobalBets();
    }
  };

  const handleResetBets = () => {
    if (isShaking) return;
    
    let totalBets = 0;
    (Object.keys(bets) as GameItemKey[]).forEach(key => totalBets += bets[key]);
    
    setBalance(prev => prev + totalBets); // Trigger useEffect -> PLAYER_UPDATE
    setBets(getEmptyBets());
    setMessage("Đã hoàn tiền.");

    if (role === 'CLIENT') {
      if (connectionsRef.current[0]?.open) connectionsRef.current[0].send({ type: 'RESET_BETS' });
    } else if (role === 'HOST') {
      allPlayersBetsRef.current.set(myId, getEmptyBets());
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
      const newResults: GameItemKey[] = [];
      for (let i = 0; i < 3; i++) {
        newResults.push(GAME_ITEMS[Math.floor(Math.random() * GAME_ITEMS.length)].key);
      }

      setDiceResult(newResults);
      setIsShaking(false);
      broadcast({ type: 'SHAKE_RESULT', results: newResults });
      calculateWinnings(newResults);
      
      // Reset bets tracking
      Array.from(allPlayersBetsRef.current.keys()).forEach(pid => {
        allPlayersBetsRef.current.set(pid, getEmptyBets());
      });
      updateAndBroadcastGlobalBets();

    }, SHAKE_DURATION);
  }, [role, broadcast, updateAndBroadcastGlobalBets, myId]); // Added myId dependency

  const handleCreateRoomAction = () => {
    setMessage("Đang khởi tạo...");
    initHostPeer(Math.random().toString(36).substring(2, 8).toUpperCase());
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
    <div className="min-h-screen bg-[url('https://www.transparenttextures.com/patterns/red-paper.png')] bg-fixed flex flex-col items-center pb-12 relative overflow-x-hidden">
      
      {resultState && resultState.show && (
        <ResultOverlay 
          winAmount={resultState.winAmount}
          totalBet={resultState.totalBet}
          results={resultState.results}
          onClose={() => setResultState(prev => prev ? { ...prev, show: false } : null)}
        />
      )}

      <RoomControl 
        currentRoomId={roomId} 
        onCreateRoom={handleCreateRoomAction}
        onCopyLink={handleCopyLink}
      />

      <header className="w-full bg-tet-red border-b-4 border-tet-gold shadow-lg pt-6 pb-4 px-4 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-yellow-300 via-red-600 to-red-900"></div>
        <h1 className="font-display text-4xl md:text-6xl text-tet-gold drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)] relative z-10">
          BẦU CUA TẾT
        </h1>
        <p className="text-tet-cream font-sans mt-2 opacity-90 relative z-10 font-bold tracking-wide">
          {role === 'HOST' ? 'CHỦ PHÒNG' : role === 'CLIENT' ? 'NGƯỜI CHƠI' : 'OFFLINE'} - {myName}
        </p>
      </header>

      <main className="flex-1 w-full max-w-5xl px-4 py-6 flex flex-col md:flex-row items-start gap-6">
        
        {/* Left Column: Game Board */}
        <div className="flex-1 w-full flex flex-col items-center gap-6">
          <DiceContainer isShaking={isShaking} results={diceResult} />

          <div className="bg-tet-cream/95 text-tet-darkRed border-2 border-tet-gold rounded-xl px-6 py-3 text-center font-bold shadow-md w-full max-w-md min-h-[3.5rem] flex items-center justify-center transition-all">
            {message}
          </div>

          <BettingBoard 
             bets={bets} 
             globalBets={globalBets} 
             onPlaceBet={handlePlaceBet} 
             disabled={isShaking || (role === 'OFFLINE' && !roomId)} 
          />

          <div className="w-full max-w-2xl bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-tet-gold/30 shadow-2xl">
             <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex flex-col items-center sm:items-start min-w-[120px]">
                   <span className="text-tet-gold text-xs uppercase font-bold tracking-wider mb-1">Ví Của Bạn</span>
                   <div className="text-3xl font-display text-white drop-shadow-md">{formatMoney(balance)}</div>
                   {currentTotalBet > 0 && <span className="text-red-200 text-xs font-bold">Cược: {formatMoney(currentTotalBet)}</span>}
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                   <button 
                     onClick={handleResetBets}
                     disabled={isShaking || currentTotalBet === 0}
                     className="flex-1 px-4 py-3 rounded-xl bg-gray-600 text-white font-bold border-b-4 border-gray-800 active:border-b-0 active:translate-y-1 disabled:opacity-50"
                   >
                     Hủy
                   </button>
                   
                   {role === 'CLIENT' ? (
                     <button disabled className="flex-[2] px-6 py-3 rounded-xl bg-gray-400 text-gray-800 font-display text-lg border-b-4 border-gray-600 cursor-not-allowed">
                       {isShaking ? 'Đang Lắc...' : 'Chờ Nhà Cái'}
                     </button>
                   ) : (
                     <button 
                       onClick={handleHostShake}
                       disabled={isShaking}
                       className="flex-[2] px-8 py-3 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-600 text-red-900 font-display text-lg border-b-4 border-yellow-700 active:border-b-0 active:translate-y-1 disabled:opacity-50"
                     >
                       {isShaking ? 'Đang Lắc...' : 'Xốc Đĩa!'}
                     </button>
                   )}
                </div>
             </div>
          </div>
        </div>

        {/* Right Column: Leaderboard */}
        <div className="w-full md:w-80 flex-shrink-0">
          <Leaderboard players={leaderboard} currentUserId={myId} />
          
          <div className="mt-4 bg-black/20 p-4 rounded-xl text-center text-xs text-tet-cream/60">
             <p>Chia sẻ link hoặc mã QR để mời bạn bè.</p>
             <p className="mt-1">Mỗi người chơi có ví tiền riêng.</p>
          </div>
        </div>

      </main>

      <footer className="w-full text-center py-4 text-red-300 text-xs">
         © 2025 Game Bầu Cua Online
      </footer>
    </div>
  );
};

export default App;