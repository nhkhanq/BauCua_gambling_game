# 🎲 Bầu Cua Tết 2025 - Multiplayer Game

Game Bầu Cua truyền thống Việt Nam với chức năng chơi multiplayer qua WebRTC.

## ✨ Tính năng

### 🎮 Gameplay
- **6 con vật truyền thống**: Nai, Bầu, Gà, Cá, Cua, Tôm
- **Đặt cược**: Mỗi lần đặt 5,000đ
- **Xốc đĩa**: 3 xúc xắc ngẫu nhiên
- **Tính tiền thắng**: Theo số lần xuất hiện (1x = hoàn vốn + 1x lãi, 2x = hoàn vốn + 2x lãi, 3x = hoàn vốn + 3x lãi)

### 🌐 Multiplayer (WebRTC)
- **Tạo phòng**: Người chơi có thể tạo phòng và chia sẻ QR code/link
- **Join phòng**: Quét QR hoặc click link để vào phòng
- **Đồng bộ real-time**: Tất cả người chơi thấy bets và kết quả cùng lúc
- **Bảng xếp hạng**: Hiển thị số dư của tất cả người chơi trong phòng
- **Auto-kick**: Người chơi hết tiền sẽ tự động bị loại khỏi phòng

### 💰 Quản lý tiền
- **Số dư ban đầu**: 100,000đ khi bắt đầu
- **Yêu cầu tham gia**: Tối thiểu 10,000đ để vào phòng
- **Ngưỡng loại**: Dưới 5,000đ sẽ bị kick khỏi phòng
- **Thông báo**: Hiển thị khi người chơi join/leave/bị kick

## 🚀 Cài đặt và Chạy

### Prerequisites
- Node.js (v16+)
- npm hoặc yarn

### Bước 1: Cài đặt dependencies
```bash
npm install
```

### Bước 2: Chạy development server
```bash
npm run dev
```

### Bước 3: Mở browser
Truy cập `http://localhost:5173`

### Build cho production
```bash
npm run build
npm run preview
```

## 🎯 Cách chơi

### Chơi một mình (Offline)
1. Mở game và bắt đầu đặt cược
2. Click vào con vật để đặt 5,000đ
3. Click "Xốc Đĩa!" để lắc
4. Nhận tiền thắng dựa trên kết quả

### Chơi multiplayer
1. **Tạo phòng**: Click "Tạo Phòng" ở góc phải trên
2. **Chia sẻ**: Gửi QR code hoặc link cho bạn bè
3. **Đặt cược**: Mọi người đặt cược của mình
4. **Xốc đĩa**: Chủ phòng (host) click "Xốc Đĩa!"
5. **Kết quả**: Tất cả người chơi nhận kết quả đồng thời

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Networking**: PeerJS (WebRTC)
- **QR Code**: qrcode.react
- **Styling**: TailwindCSS (inline)

## 📁 Cấu trúc Project

```
BauCua_gambling_game/
├── App.tsx                 # Main app logic
├── components/
│   ├── BettingBoard.tsx    # Bảng đặt cược
│   ├── DiceContainer.tsx   # Hiển thị xúc xắc
│   ├── Leaderboard.tsx     # Bảng xếp hạng
│   ├── ResultOverlay.tsx   # Màn hình kết quả
│   └── RoomControl.tsx     # Tạo/join phòng + QR code
├── types.ts                # TypeScript types
├── constants.ts            # Game constants
└── README.md
```

## 🔧 Configuration

Chỉnh sửa trong `constants.ts`:

```typescript
export const BET_INCREMENT = 5000;           // Số tiền mỗi lần đặt
export const INITIAL_BALANCE = 100000;       // Số dư ban đầu
export const MIN_BALANCE_TO_JOIN = 10000;    // Tối thiểu để join
export const MIN_BALANCE_TO_STAY = 5000;     // Ngưỡng bị kick
export const SHAKE_DURATION = 1500;          // Thời gian lắc (ms)
```

## 🎨 Features Chi tiết

### Network Messages
- `JOIN_REQUEST`: Client xin vào phòng
- `JOIN_ACCEPTED`: Host chấp nhận
- `JOIN_REJECTED`: Host từ chối (thiếu tiền)
- `PLAYER_JOINED`: Thông báo người chơi mới
- `PLAYER_LEFT`: Thông báo người chơi rời đi
- `KICKED_NO_MONEY`: Thông báo bị kick
- `PLACE_BET`: Gửi thông tin đặt cược
- `SHAKE_START`: Bắt đầu lắc
- `SHAKE_RESULT`: Kết quả lắc
- `PLAYER_UPDATE`: Cập nhật thông tin người chơi
- `LEADERBOARD_UPDATE`: Cập nhật bảng xếp hạng

### Validation & Security
- Check balance trước khi join
- Auto-kick khi hết tiền
- Validate mỗi bet trước khi xử lý
- Host kiểm soát toàn bộ game logic

## 🐛 Troubleshooting

### Không kết nối được phòng?
- Kiểm tra Internet connection
- Thử refresh trang
- Đảm bảo có đủ tiền để join (10,000đ)

### Bị kick khỏi phòng?
- Số dư của bạn dưới 5,000đ
- Refresh trang để reset balance về 100,000đ

### QR code không hiện?
- Check console cho errors
- Đảm bảo đã cài `qrcode.react` package

## 📄 License

MIT License - Dự án mã nguồn mở cho cộng đồng

## 🎊 Credits

Game truyền thống Việt Nam - Chúc mừng năm mới!
