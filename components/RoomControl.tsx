import React, { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

interface RoomControlProps {
  currentRoomId: string | null;
  onCreateRoom: () => void;
  onCopyLink: () => void;
}

const RoomControl: React.FC<RoomControlProps> = ({ currentRoomId, onCreateRoom, onCopyLink }) => {
  const [showModal, setShowModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
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

  return (
    <>
      <div className="absolute top-4 right-4 z-50">
        {!currentRoomId ? (
          <button 
            onClick={handleCreateClick}
            className="bg-tet-cream text-tet-darkRed text-xs md:text-sm font-bold px-3 py-2 rounded-full shadow-lg border-2 border-tet-gold hover:bg-white transition-transform hover:scale-105 flex items-center gap-2"
          >
            <span>👥</span> Tạo Phòng
          </button>
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
            
            <p className="text-xs text-gray-400 mt-4 italic">
              *Lưu ý: Mọi người phải có kết nối Internet để kết nối vào phòng.
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default RoomControl;