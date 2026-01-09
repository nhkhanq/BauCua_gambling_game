import React, { useState, useCallback, useEffect, useRef } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { GameItemKey, NetworkMessage, PlayerRole, PlayerInfo } from './types';
import { GAME_ITEMS, BET_INCREMENT, INITIAL_BALANCE, SHAKE_DURATION, MIN_BALANCE_TO_JOIN, MIN_BALANCE_TO_STAY, PEER_CONFIG } from './constants';
import DiceContainer from './components/DiceContainer';
import BettingBoard from './components/BettingBoard';
import RoomControl from './components/RoomControl';
import ResultOverlay from './components/ResultOverlay';
import Leaderboard from './components/Leaderboard';
import DebugPanel from './components/DebugPanel';

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

  // --- Debug State ---
  const [debugEnabled, setDebugEnabled] = useState<boolean>(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  // Refs
  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<DataConnection[]>([]);
  const allPlayersBetsRef = useRef<Map<string, Record<GameItemKey, number>>>(new Map());
  
  // HOST ONLY: Map of all connected players to track their info
  const playersInfoRef = useRef<Map<string, PlayerInfo>>(new Map());

  // Helper: push debug log both to UI and console
  const logDebug = useCallback(
    (label: string, data?: unknown) => {
      const ts = new Date().toISOString().split('T')[1]?.replace('Z', '') ?? '';
      const line =
        `[${ts}] ${label}` +
        (data !== undefined
          ? ` | ${(() => {
              try {
                return typeof data === 'string'
                  ? data
                  : JSON.stringify(data, null, 0);
              } catch {
                return String(data);
              }
            })()}`
          : '');

      // Console log luôn, để xem được khi deploy
      // eslint-disable-next-line no-console
      console.log('[BauCua][DEBUG]', line);

      setDebugLogs(prev => {
        const next = [...prev, line];
        // giữ lại tối đa 200 dòng
        if (next.length > 200) next.splice(0, next.length - 200);
        return next;
      });
    },
    []
  );

  // --- Initialization ---

  // --- Sync my info to Host whenever balance changes ---
  useEffect(() => {
    if (role === 'CLIENT' && myId) {
      // Check if CLIENT ran out of money
      if (balance < MIN_BALANCE_TO_STAY) {
        logDebug('CLIENT out of money, leaving room', { myId, balance });
        setMessage("Bạn đã hết tiền! Đang rời phòng...");
        setTimeout(() => {
          if (peerRef.current) {
            logDebug('CLIENT destroy peer because out of money');
            peerRef.current.destroy();
          }
          setRole('OFFLINE');
          setRoomId(null);
          window.history.pushState({}, '', window.location.pathname);
          setMessage("Bạn đã bị loại khỏi phòng vì hết tiền.");
        }, 2000);
        return;
      }

      const msg: NetworkMessage = {
        type: 'PLAYER_UPDATE',
        info: { id: myId, name: myName, balance, isHost: false }
      };
      logDebug('CLIENT -> HOST PLAYER_UPDATE', msg);
      // Send to host
      if (connectionsRef.current[0]?.open) {
        connectionsRef.current[0].send(msg);
      }
    } else if (role === 'HOST' && myId) {
      // Host updates their own info in the map directly
      playersInfoRef.current.set(myId, { id: myId, name: myName, balance, isHost: true });
      logDebug('HOST self PLAYER_UPDATE', { myId, balance });
      updateAndBroadcastLeaderboard();
      
      // Host checks all clients' balances and kicks those who are broke
      checkAndKickBrokePlayers();
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

  const checkAndKickBrokePlayers = useCallback(() => {
    if (role !== 'HOST') return;
    
    const playersToKick: string[] = [];
    playersInfoRef.current.forEach((player, playerId) => {
      // Don't kick the host
      if (!player.isHost && player.balance < MIN_BALANCE_TO_STAY) {
        playersToKick.push(playerId);
      }
    });

    playersToKick.forEach(playerId => {
      const player = playersInfoRef.current.get(playerId);
      const conn = connectionsRef.current.find(c => c.peer === playerId);
      if (conn && player) {
        logDebug('HOST kicking player for low balance', {
          playerId,
          name: player.name,
          balance: player.balance,
        });
        // Send kick message
        conn.send({ type: 'KICKED_NO_MONEY' } as NetworkMessage);
        // Broadcast player left
        broadcast({ type: 'PLAYER_LEFT', playerName: player.name });
        // Close connection
        setTimeout(() => conn.close(), 500);
        // Clean up
        playersInfoRef.current.delete(playerId);
        allPlayersBetsRef.current.delete(playerId);
        connectionsRef.current = connectionsRef.current.filter(c => c !== conn);
        setMessage(`${player.name} đã hết tiền và rời phòng.`);
      }
    });

    if (playersToKick.length > 0) {
      updateAndBroadcastGlobalBets();
      updateAndBroadcastLeaderboard();
    }
  }, [role, broadcast, updateAndBroadcastGlobalBets, updateAndBroadcastLeaderboard]);

  // --- Network Setup ---

  const initHostPeer = (attemptId: string) => {
    if (peerRef.current) peerRef.current.destroy();
    connectionsRef.current = [];
    allPlayersBetsRef.current.clear();
    playersInfoRef.current.clear();
    
    const fullId = APP_PREFIX + attemptId;
    logDebug('initHostPeer called', { attemptId, fullId });
    
    // Use PEER_CONFIG for better NAT traversal
    const peer = new Peer(fullId, PEER_CONFIG);
    
    peer.on('open', () => {
      logDebug('HOST Peer open', { fullId });
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
      logDebug('HOST got incoming connection', { peer: conn.peer });
      
      conn.on('data', (data) => {
        logDebug('HOST received data from peer', { from: conn.peer, raw: data });
        handleHostReceivedMessage(data as NetworkMessage, conn.peer, conn);
      });
      
      conn.on('open', () => {
         // Wait for JOIN_REQUEST from client before adding them
         // Initial sync will be sent after JOIN_REQUEST is accepted
         logDebug('HOST connection opened with peer', { peer: conn.peer });
      });
      
      conn.on('close', () => {
        logDebug('Connection closed (HOST side)', { peer: conn.peer });
        const player = playersInfoRef.current.get(conn.peer);
        if (player) {
          broadcast({ type: 'PLAYER_LEFT', playerName: player.name });
          setMessage(`${player.name} đã rời phòng.`);
        }
        
        connectionsRef.current = connectionsRef.current.filter(c => c !== conn);
        allPlayersBetsRef.current.delete(conn.peer);
        playersInfoRef.current.delete(conn.peer);
        updateAndBroadcastGlobalBets();
        updateAndBroadcastLeaderboard();
      });
      
      conn.on('error', (err) => {
        logDebug('HOST connection error with peer', { peer: conn.peer, error: err });
        // Connection errors are usually handled by close event
      });
    });

    peer.on('disconnected', () => {
      logDebug('HOST Peer disconnected, attempting to reconnect...');
      setMessage("Mất kết nối tạm thời, đang thử kết nối lại...");
      // Try to reconnect to PeerJS server
      if (peerRef.current && !peerRef.current.destroyed) {
        peerRef.current.reconnect();
      }
    });

    peer.on('error', (err) => {
      logDebug('HOST Peer error', { type: err.type, message: err.message });
      
      if (err.type === 'unavailable-id') {
        // Room ID already taken, generate new one
        const newId = Math.random().toString(36).substring(2, 8).toUpperCase();
        logDebug('Room ID unavailable, trying new ID', { newId });
        setMessage("Mã phòng đã tồn tại, đang tạo mã mới...");
        initHostPeer(newId);
      } else if (err.type === 'network') {
        setMessage("Lỗi mạng. Kiểm tra kết nối internet và thử lại.");
      } else if (err.type === 'server-error') {
        setMessage("Lỗi server PeerJS. Vui lòng thử lại sau.");
      } else {
        setMessage(`Lỗi: ${err.message}. Vui lòng tải lại trang.`);
      }
    });
  };

  const joinRoomAsClient = useCallback((targetRoomId: string) => {
    // Check balance before attempting to join
    if (balance < MIN_BALANCE_TO_JOIN) {
      setMessage(`Cần tối thiểu ${formatMoney(MIN_BALANCE_TO_JOIN)} để vào phòng!`);
      window.history.pushState({}, '', window.location.pathname);
      return;
    }

    logDebug('joinRoomAsClient called', { targetRoomId, balance });

    if (peerRef.current) peerRef.current.destroy();
    connectionsRef.current = [];

    // Use PEER_CONFIG for better NAT traversal
    const peer = new Peer(PEER_CONFIG);

    peer.on('open', (id) => {
      logDebug('CLIENT Peer open', { id, targetRoomId });
      setRole('CLIENT');
      setRoomId(targetRoomId);
      setMyId(id);
      peerRef.current = peer;
      setMessage("Đang kết nối đến phòng...");

      const peerTarget = APP_PREFIX + targetRoomId;
      logDebug('CLIENT connecting to HOST', { peerTarget });
      const conn = peer.connect(peerTarget);
      connectionsRef.current = [conn];

      conn.on('open', () => {
        setMessage("Đang xin vào phòng...");
        const joinMsg: NetworkMessage = { 
          type: 'JOIN_REQUEST', 
          playerInfo: { id, name: myName, balance, isHost: false } 
        };
        logDebug('CLIENT -> HOST JOIN_REQUEST', joinMsg);
        conn.send(joinMsg);
      });

      conn.on('data', (data) => {
        logDebug('CLIENT received data from HOST', data);
        handleClientReceivedMessage(data as NetworkMessage);
      });
      
      conn.on('close', () => {
        logDebug('CLIENT connection closed', { targetRoomId });
        setMessage("Mất kết nối với chủ phòng. Thử tải lại trang để kết nối lại.");
        setRole('OFFLINE');
        setRoomId(null);
        window.history.pushState({}, '', window.location.pathname);
      });

      conn.on('error', (err) => {
        logDebug('CLIENT connection error', { targetRoomId, error: err });
        setMessage("Lỗi kết nối. Đảm bảo chủ phòng đã tạo phòng và bạn đang dùng link đúng.");
        setRole('OFFLINE');
        setRoomId(null);
        window.history.pushState({}, '', window.location.pathname);
      });
    });

    peer.on('error', (err) => {
      logDebug('CLIENT Peer error', err);
      let errorMsg = "Lỗi kết nối. Vui lòng thử lại.";
      
      if (err.type === 'peer-unavailable') {
        errorMsg = "Không tìm thấy phòng này. Kiểm tra lại mã phòng hoặc chủ phòng chưa tạo phòng.";
      } else if (err.type === 'network') {
        errorMsg = "Lỗi mạng. Kiểm tra kết nối internet của bạn.";
      } else if (err.type === 'disconnected') {
        errorMsg = "Mất kết nối. Thử tải lại trang.";
      }
      
      setMessage(errorMsg);
      setRole('OFFLINE');
      setRoomId(null);
      window.history.pushState({}, '', window.location.pathname);
    });
  }, [balance, logDebug, myName]);

  // --- Initialization ---
  useEffect(() => {
    localStorage.setItem('playerName', myName);
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      logDebug('Init: found room param in URL', { roomParam });
      joinRoomAsClient(roomParam);
    } else {
      logDebug('Init: no room param, OFFLINE mode');
    }

    return () => {
      if (peerRef.current) {
        logDebug('Cleanup: destroying peer on unmount');
        peerRef.current.destroy();
      }
    };
  }, [joinRoomAsClient, logDebug, myName]);

  // --- Message Handlers ---

  const handleHostReceivedMessage = (msg: NetworkMessage, peerId: string, conn?: DataConnection) => {
    if (msg.type === 'JOIN_REQUEST') {
      logDebug('HOST received JOIN_REQUEST', { from: peerId, info: msg.playerInfo });
      // Check if player has enough balance to join
      if (msg.playerInfo.balance < MIN_BALANCE_TO_JOIN) {
        if (conn) {
          const rejectMsg: NetworkMessage = { 
            type: 'JOIN_REJECTED', 
            reason: `Cần tối thiểu ${formatMoney(MIN_BALANCE_TO_JOIN)} để vào phòng.` 
          };
          logDebug('HOST -> CLIENT JOIN_REJECTED', { to: peerId, reason: rejectMsg.reason });
          conn.send(rejectMsg);
          setTimeout(() => conn.close(), 500);
        }
        return;
      }

      // Accept the player
      connectionsRef.current.push(conn!);
      allPlayersBetsRef.current.set(peerId, getEmptyBets());
      playersInfoRef.current.set(peerId, msg.playerInfo);

      // Send acceptance with current room state
      if (conn) {
        const acceptMsg = {
          type: 'JOIN_ACCEPTED' as const,
          roomState: {
            globalBets: calculateGlobalBetsFromRef(),
            players: Array.from(playersInfoRef.current.values())
          }
        };
        logDebug('HOST -> CLIENT JOIN_ACCEPTED', {
          to: peerId,
          players: acceptMsg.roomState.players.length
        });
        conn.send(acceptMsg as NetworkMessage);
      }

      // Broadcast to all other players that someone joined
      broadcast({ type: 'PLAYER_JOINED', playerName: msg.playerInfo.name });
      setMessage(`${msg.playerInfo.name} đã vào phòng!`);
      
      updateAndBroadcastGlobalBets();
      updateAndBroadcastLeaderboard();
    }
    else if (msg.type === 'PLACE_BET') {
      logDebug('HOST received PLACE_BET', { from: peerId, key: msg.key, amount: msg.amount });
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
      const existingPlayer = playersInfoRef.current.get(peerId);
      if (existingPlayer) {
        logDebug('HOST received PLAYER_UPDATE', { from: peerId, info: msg.info });
        playersInfoRef.current.set(peerId, msg.info);
        updateAndBroadcastLeaderboard();
        
        // Check if this player should be kicked
        if (msg.info.balance < MIN_BALANCE_TO_STAY) {
          checkAndKickBrokePlayers();
        }
      }
    }
  };

  const handleClientReceivedMessage = (msg: any) => {
    logDebug('CLIENT handle message', { type: msg.type, raw: msg });
    if (msg.type === 'JOIN_ACCEPTED') {
      setGlobalBets(msg.roomState.globalBets);
      setLeaderboard(msg.roomState.players);
      setMessage("Đã vào phòng thành công! Chúc may mắn!");
    } 
    else if (msg.type === 'JOIN_REJECTED') {
      setMessage(msg.reason);
      setTimeout(() => {
        if (peerRef.current) peerRef.current.destroy();
        setRole('OFFLINE');
        setRoomId(null);
        window.history.pushState({}, '', window.location.pathname);
      }, 3000);
    }
    else if (msg.type === 'KICKED_NO_MONEY') {
      logDebug('CLIENT received KICKED_NO_MONEY');
      setMessage("Bạn đã hết tiền! Đang rời phòng...");
      setTimeout(() => {
        if (peerRef.current) peerRef.current.destroy();
        setRole('OFFLINE');
        setRoomId(null);
        window.history.pushState({}, '', window.location.pathname);
        setMessage("Bạn đã bị loại khỏi phòng vì hết tiền.");
      }, 2000);
    }
    else if (msg.type === 'PLAYER_JOINED') {
      setMessage(`🎉 ${msg.playerName} đã vào phòng!`);
    }
    else if (msg.type === 'PLAYER_LEFT') {
      setMessage(`👋 ${msg.playerName} đã rời phòng.`);
    }
    else if (msg.type === 'SHAKE_START') {
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
    logDebug('UI: create room clicked');
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
        playerBalance={balance}
        minBalanceRequired={MIN_BALANCE_TO_JOIN}
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

      {/* Debug Panel hiển thị cả trên bản deploy (không cần DevTools) */}
      <DebugPanel
        enabled={debugEnabled}
        onToggle={() => setDebugEnabled(prev => !prev)}
        role={role}
        roomId={roomId}
        myId={myId}
        connectionsCount={connectionsRef.current.length}
        logs={debugLogs}
      />
    </div>
  );
};

export default App;