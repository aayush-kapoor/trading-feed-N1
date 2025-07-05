# Trading WebSocket Backend

A simple WebSocket server that continuously sends mock trading data.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Start the Server

```bash
npm start
```

The server will start on port 8080 and begin sending mock trade data to any connected clients.

## 📡 Connection Details

- **WebSocket URL**: `ws://localhost:8080`
- **Port**: 8080
- **Protocol**: Native WebSocket (not Socket.IO)

## 🔗 How to Connect

### From Your Frontend
Simply use the WebSocket URL in your trading feed frontend:
```
ws://localhost:8080
```

### Test with WebSocket Client
You can test the connection using any WebSocket client or browser console:

```javascript
const ws = new WebSocket('ws://localhost:8080');
ws.onmessage = (event) => {
  const trade = JSON.parse(event.data);
  console.log('Received trade:', trade);
};
```

## 📊 Data Format

The server sends continuous trade messages in this format:

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "timestamp": 1703123456789,
  "symbol": "BTC/USD",
  "price": 48532.45,
  "size": 2.5,
  "side": "buy",
  "exchange": "Binance"
}
```

## 🛠️ Features

- **Continuous Data**: Sends new trade every 1-3 seconds
- **Realistic Prices**: Uses appropriate price ranges for each cryptocurrency
- **Multiple Symbols**: BTC/USD, ETH/USD, SOL/USD, ADA/USD, DOT/USD, AVAX/USD, MATIC/USD
- **Multiple Exchanges**: Binance, Coinbase, Kraken, Bybit, OKX, Gemini, KuCoin
- **Graceful Shutdown**: Handles Ctrl+C properly
- **Connection Logging**: Shows when clients connect/disconnect

## 🔧 Development

The server is built with:
- **Node.js** - Runtime
- **ws** - WebSocket library
- **uuid** - For generating unique trade IDs

## 📝 Console Output

When running, you'll see:
```
🚀 Trading WebSocket Server starting on port 8080...
🎯 WebSocket server is running!
📡 Connect to: ws://localhost:8080
✅ New client connected from ::ffff:127.0.0.1
📈 Sent trade: BTC/USD buy 49235.67 @ Binance
📈 Sent trade: ETH/USD sell 3421.89 @ Coinbase
```

## 🛑 Stopping the Server

Press `Ctrl+C` to gracefully stop the server.

## 🌐 Production Deployment

For production deployment, consider:
- Using a process manager like PM2
- Setting up proper logging
- Adding authentication if needed
- Using environment variables for configuration
- Setting up reverse proxy (nginx) if serving over HTTP/HTTPS 