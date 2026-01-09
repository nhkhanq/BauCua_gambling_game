import React, { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

interface RoomControlProps {
  currentRoomId: string | null;
  onCreateRoom: () => void;
  onCopyLink: () => void;
  playerBalance?: number;
  minBalanceRequired?: number;
}

const RoomControl: React.FC<RoomControlProps> = ({ 
  currentRoomId, 
  onCreateRoom, 
  onCopyLink,
  playerBalance = 0,
  minBalanceRequired = 10000
}) => {
  const [showModal, setShowModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  const formatMoney = (amount: number) => 
    new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
  
  // Auto open modal when room ID is set after clicking create
  useEffect(() => {
    if (currentRoomId && isCreating) {
      setShowModal(true);
      setIsCreating(false);
    }
  }, [currentRoomId, isCreating]);

  // Helper to get URL for QR Code display safely
  const getShareUrl = (roomId: string) => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('room', roomId);
      return url.toString();
    } catch (e) {
      // Fallback for environments where URL constructor might fail or be weird (e.g. blobs)
      return `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    }
  };

  const handleCreateClick = () => {
    setIsCreating(true);
    onCreateRoom();
  };

  const canJoinRoom = playerBalance >= minBalanceRequired;

  return (
    <>
      <div className="absolute top-4 right-4 z-50 flex flex-col items-end gap-2">
        {!currentRoomId ? (
          <>
            <button 
              onClick={handleCreateClick}
              disabled={!canJoinRoom}
              className={`text-xs md:text-sm font-bold px-3 py-2 rounded-full shadow-lg border-2 transition-transform flex items-center gap-2 ${
                canJoinRoom 
                  ? 'bg-tet-cream text-tet-darkRed border-tet-gold hover:bg-white hover:scale-105 cursor-pointer'
                  : 'bg-gray-300 text-gray-500 border-gray-400 cursor-not-allowed opacity-60'
              }`}
            >
              <span>👥</span> Tạo Phòng
            </button>
            {!canJoinRoom && (
              <div className="bg-red-600 text-white text-[10px] px-2 py-1 rounded shadow-md">
                Cần {formatMoney(minBalanceRequired)}
              </div>
            )}
          </>
        ) : (
          <button 
            onClick={() => setShowModal(true)}
            className="bg-tet-gold text-red-900 text-xs md:text-sm font-bold px-3 py-2 rounded-full shadow-lg border-2 border-white animate-pulse flex items-center gap-2"
          >
            <span>🏠</span> Phòng: {currentRoomId}
          </button>
        )}
      </div>

      {/* QR Code Modal */}
      {showModal && currentRoomId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center relative animate-pop border-4 border-tet-gold">
            <button 
              onClick={() => setShowModal(false)}
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-xl font-bold"
            >
              ×
            </button>
            
            <h3 className="text-2xl font-display text-tet-red mb-2">Mời Bạn Bè</h3>
            <p className="text-gray-600 text-sm mb-4">Quét mã QR để tham gia phòng cùng chơi!</p>
            
            <div className="bg-white p-2 rounded-xl inline-block shadow-inner border border-gray-200 mb-4">
              <QRCodeCanvas 
                value={getShareUrl(currentRoomId)} 
                size={200}
                bgColor={"#ffffff"}
                fgColor={"#D91E18"}
                level={"H"}
                includeMargin={true}
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="bg-gray-100 p-2 rounded text-gray-700 font-mono text-lg tracking-widest border border-gray-300">
                {currentRoomId}
              </div>
              <button 
                onClick={onCopyLink}
                className="w-full bg-tet-red text-white font-bold py-2 rounded-xl hover:bg-red-700 transition"
              >
                Sao chép Link
              </button>
            </div>
            
            <div className="text-xs text-gray-500 mt-4 space-y-1">
              <p className="font-semibold text-gray-700">📋 Yêu cầu tham gia:</p>
              <p>• Tối thiểu <span className="font-bold text-red-600">{formatMoney(minBalanceRequired)}</span> để vào phòng</p>
              <p>• Sẽ bị loại nếu số dư {'<'} <span className="font-bold text-red-600">{formatMoney(minBalanceRequired / 2)}</span></p>
              <p className="italic mt-2">*Cần kết nối Internet ổn định</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RoomControl;