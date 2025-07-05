const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

// Create WebSocket server on port 8080
const wss = new WebSocket.Server({ port: 8080 });

console.log('🚀 Trading WebSocket Server starting on port 8080...');

// Mock data generator - same logic as frontend
function generateMockTrade() {
  const symbols = ["BTC/USD", "ETH/USD", "SOL/USD", "ADA/USD", "DOT/USD", "AVAX/USD", "MATIC/USD"];
  const exchanges = ["Binance", "Coinbase", "Kraken", "Bybit", "OKX", "Gemini", "KuCoin"];
  const sides = ["buy", "sell"];

  const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
  const randomExchange = exchanges[Math.floor(Math.random() * exchanges.length)];
  const randomSide = sides[Math.floor(Math.random() * sides.length)];

  // Generate realistic price based on symbol
  let basePrice = 50000; // Default for BTC
  if (randomSymbol.includes("ETH")) basePrice = 3500;
  else if (randomSymbol.includes("SOL")) basePrice = 100;
  else if (randomSymbol.includes("ADA")) basePrice = 0.5;
  else if (randomSymbol.includes("DOT")) basePrice = 7;
  else if (randomSymbol.includes("AVAX")) basePrice = 40;
  else if (randomSymbol.includes("MATIC")) basePrice = 1.2;

  const price = basePrice * (0.95 + Math.random() * 0.1); // ±5% variation
  const size = Math.random() * 10 + 0.001; // 0.001 to 10

  return {
    id: uuidv4(),
    timestamp: Date.now(),
    symbol: randomSymbol,
    price: price,
    size: size,
    side: randomSide,
    exchange: randomExchange,
  };
}

// Handle WebSocket connections
wss.on('connection', function connection(ws, req) {
  const clientIP = req.socket.remoteAddress;
  console.log(`✅ New client connected from ${clientIP}`);

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'welcome',
    message: 'Connected to Trading WebSocket Server',
    timestamp: Date.now()
  }));

  // Start sending mock trades every 1-3 seconds
  const tradeInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      const mockTrade = generateMockTrade();
      ws.send(JSON.stringify(mockTrade));
      console.log(`📈 Sent trade: ${mockTrade.symbol} ${mockTrade.side} ${mockTrade.price.toFixed(2)} @ ${mockTrade.exchange}`);
    }
  }, Math.random() * 2000 + 1000); // Random interval between 1-3 seconds

  // Handle client disconnect
  ws.on('close', function close() {
    console.log(`❌ Client ${clientIP} disconnected`);
    clearInterval(tradeInterval);
  });

  // Handle errors
  ws.on('error', function error(err) {
    console.error(`💥 WebSocket error from ${clientIP}:`, err);
    clearInterval(tradeInterval);
  });
});

// Handle server errors
wss.on('error', function error(err) {
  console.error('💥 WebSocket Server error:', err);
});

console.log('🎯 WebSocket server is running!');
console.log('📡 Connect to: ws://localhost:8080');
console.log('🔗 Or use in your frontend: "ws://localhost:8080"');
console.log('⏹️  Press Ctrl+C to stop the server');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down WebSocket server...');
  wss.close(() => {
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
}); 