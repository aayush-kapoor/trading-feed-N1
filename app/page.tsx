"use client"

import { useState, useEffect, useCallback } from "react"
import { io, Socket } from "socket.io-client"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Activity,
  Wifi,
  WifiOff,
  Play,
  Square,
  TrendingUp,
  TrendingDown,
  Clock,
  DollarSign,
  BarChart3,
} from "lucide-react"

type Trade = {
  id: string
  timestamp: number
  symbol: string
  price: number
  size: number
  side: "buy" | "sell"
  exchange: string
}

// Mock data generator for testing
const generateMockTrade = (): Trade => {
  const symbols = ["BTC/USD", "ETH/USD", "SOL/USD", "ADA/USD", "DOT/USD", "AVAX/USD", "MATIC/USD"]
  const exchanges = ["Binance", "Coinbase", "Kraken", "Bybit", "OKX", "Gemini", "KuCoin"]
  const sides: ("buy" | "sell")[] = ["buy", "sell"]

  const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)]
  const randomExchange = exchanges[Math.floor(Math.random() * exchanges.length)]
  const randomSide = sides[Math.floor(Math.random() * sides.length)]

  // Generate realistic price based on symbol
  let basePrice = 50000 // Default for BTC
  if (randomSymbol.includes("ETH")) basePrice = 3500
  else if (randomSymbol.includes("SOL")) basePrice = 100
  else if (randomSymbol.includes("ADA")) basePrice = 0.5
  else if (randomSymbol.includes("DOT")) basePrice = 7
  else if (randomSymbol.includes("AVAX")) basePrice = 40
  else if (randomSymbol.includes("MATIC")) basePrice = 1.2

  const price = basePrice * (0.95 + Math.random() * 0.1) // ±5% variation
  const size = Math.random() * 10 + 0.001 // 0.001 to 10

  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    symbol: randomSymbol,
    price: price,
    size: size,
    side: randomSide,
    exchange: randomExchange,
  }
}

export default function TradingFeed() {
  const [wsUrl, setWsUrl] = useState("")
  const [socket, setSocket] = useState<Socket | null>(null)
  const [webSocket, setWebSocket] = useState<WebSocket | null>(null)
  const [connectionType, setConnectionType] = useState<"socket.io" | "websocket" | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected" | "error">(
    "disconnected",
  )
  const [trades, setTrades] = useState<Trade[]>([])
  const [isMockMode, setIsMockMode] = useState(false)
  const [mockInterval, setMockInterval] = useState<NodeJS.Timeout | null>(null)

  // Format timestamp
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    })
  }

  // Format price with appropriate decimal places
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    }).format(price)
  }

  // Handle incoming trade data from both Socket.IO and WebSocket
  const handleTradeData = (tradeData: any) => {
    try {
      // Handle different message formats
      let parsedData = tradeData

      // Handle Socket.IO format: "42["tradeCreated", {...}]" for WebSocket
      if (typeof tradeData === "string" && tradeData.startsWith("42[")) {
        const parsed = JSON.parse(tradeData.substring(2))
        if (parsed && parsed.length >= 2 && parsed[0] === "tradeCreated") {
          parsedData = parsed[1]
        }
      } else if (typeof tradeData === "string") {
        // Try to parse as JSON for native WebSocket
        try {
          parsedData = JSON.parse(tradeData)
        } catch {
          return // Invalid JSON, skip
        }
      }

      // Map the data to our Trade type
      const trade: Trade = {
        id: parsedData.id || crypto.randomUUID(),
        timestamp: parsedData.timestamp || Date.now(),
        symbol: parsedData.symbol || 'UNK',
        price: parsedData.price || 0,
        size: parsedData.size || 0,
        side: parsedData.side || 'buy',
        exchange: parsedData.exchange || 'unknown',
      }
      
      // Validate essential fields
      if (trade.id && trade.timestamp && trade.symbol) {
        setTrades((prevTrades) => [trade, ...prevTrades.slice(0, 99)]) // Keep last 100 trades
      }
    } catch (err) {
      console.error("Error processing trade data:", err)
    }
  }

  // Try Socket.IO connection
  const trySocketIO = (url: string): Promise<Socket> => {
    return new Promise((resolve, reject) => {
      const newSocket = io(url, {
        transports: ['websocket', 'polling'],
        autoConnect: true,
        timeout: 5000,
      })

      const timeout = setTimeout(() => {
        newSocket.disconnect()
        reject(new Error('Socket.IO connection timeout'))
      }, 5000)

      newSocket.on('connect', () => {
        clearTimeout(timeout)
        // Subscribe to trade events
        newSocket.on('tradeCreated', handleTradeData)
        resolve(newSocket)
      })

      newSocket.on('connect_error', (error) => {
        clearTimeout(timeout)
        newSocket.disconnect()
        reject(error)
      })
    })
  }

  // Try native WebSocket connection
  const tryWebSocket = (url: string): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url)
      
      const timeout = setTimeout(() => {
        ws.close()
        reject(new Error('WebSocket connection timeout'))
      }, 5000)

      ws.onopen = () => {
        clearTimeout(timeout)
        resolve(ws)
      }

      ws.onerror = (error) => {
        clearTimeout(timeout)
        reject(error)
      }

      ws.onmessage = (event) => {
        handleTradeData(event.data)
      }

      ws.onclose = () => {
        setConnectionStatus("disconnected")
        setWebSocket(null)
        setConnectionType(null)
      }
    })
  }

  // Smart connection that tries both Socket.IO and WebSocket
  const connectSmart = useCallback(async () => {
    if (!wsUrl.trim()) {
      toast.error("Please enter a server URL")
      return
    }

    setConnectionStatus("connecting")

    try {
      // First, try Socket.IO
      try {
        const socketIOConnection = await trySocketIO(wsUrl)
        setSocket(socketIOConnection)
        setConnectionType("socket.io")
        setConnectionStatus("connected")
        toast.success("Connected via Socket.IO")
        
        // Handle Socket.IO disconnect
        socketIOConnection.on('disconnect', () => {
          setConnectionStatus("disconnected")
          setSocket(null)
          setConnectionType(null)
          toast.info("Disconnected from Socket.IO server")
        })
        
        return
      } catch (socketIOError) {
        // Socket.IO failed, try WebSocket
        try {
          const webSocketConnection = await tryWebSocket(wsUrl)
          setWebSocket(webSocketConnection)
          setConnectionType("websocket")
          setConnectionStatus("connected")
          toast.success("Connected via WebSocket")
          return
        } catch (webSocketError) {
          // Both failed
          const socketMsg = socketIOError instanceof Error ? socketIOError.message : 'Unknown Socket.IO error'
          const wsMsg = webSocketError instanceof Error ? webSocketError.message : 'Unknown WebSocket error'
          throw new Error(`Both connection methods failed. Socket.IO: ${socketMsg}, WebSocket: ${wsMsg}`)
        }
      }
    } catch (err) {
      setConnectionStatus("error")
      const errorMessage = err instanceof Error ? err.message : 'Unknown connection error'
      toast.error(`Connection failed: ${errorMessage}`)
    }
  }, [wsUrl])

  // Disconnect from either Socket.IO or WebSocket
  const disconnectSmart = useCallback(() => {
    if (socket) {
      socket.disconnect()
      setSocket(null)
    }
    if (webSocket) {
      webSocket.close()
      setWebSocket(null)
    }
    setConnectionType(null)
    setConnectionStatus("disconnected")
    toast.info("Disconnected")
  }, [socket, webSocket])

  // Start mock data mode
  const startMockMode = () => {
    setIsMockMode(true)
    setConnectionStatus("connected")

    // Generate initial trades
    const initialTrades = Array.from({ length: 10 }, generateMockTrade)
    setTrades(initialTrades)

    // Start generating mock trades every 1-3 seconds
    const interval = setInterval(
      () => {
        const newTrade = generateMockTrade()
        setTrades((prevTrades) => [newTrade, ...prevTrades.slice(0, 99)])
      },
      Math.random() * 2000 + 1000,
    )

    setMockInterval(interval)
    toast.success("Mock data mode activated")
  }

  // Stop mock data mode
  const stopMockMode = () => {
    setIsMockMode(false)
    setConnectionStatus("disconnected")
    if (mockInterval) {
      clearInterval(mockInterval)
      setMockInterval(null)
    }
    toast.info("Mock data mode stopped")
  }

  // Clear trades list while keeping connection active
  const clearTradesList = () => {
    setTrades([])
    toast.success("Trade list cleared")
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socket) {
        socket.disconnect()
      }
      if (webSocket) {
        webSocket.close()
      }
      if (mockInterval) {
        clearInterval(mockInterval)
      }
    }
  }, [socket, webSocket, mockInterval])

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case "connected":
        return <Wifi className="h-4 w-4 text-green-500" />
      case "connecting":
        return <Activity className="h-4 w-4 text-yellow-500 animate-pulse" />
      case "error":
        return <WifiOff className="h-4 w-4 text-red-500" />
      default:
        return <WifiOff className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusText = () => {
    if (isMockMode) return "Mock Mode"
    if (connectionStatus === "connected" && connectionType) {
      return `Connected (${connectionType})`
    }
    switch (connectionStatus) {
      case "connecting":
        return "Connecting..."
      case "error":
        return "Connection Error"
      default:
        return "Disconnected"
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <BarChart3 className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Trading Feed - N1 Take Home Challenge</h1>
          </div>
        </div>

        {/* Connection Panel */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon()}
              Establish Connection
              <Badge variant={connectionStatus === "connected" ? "default" : "secondary"}>{getStatusText()}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="wss://your-socketio-server.com"
                  value={wsUrl}
                  onChange={(e) => setWsUrl(e.target.value)}
                  className="flex-1"
                  disabled={connectionStatus === "connected" || isMockMode}
                />
                {connectionStatus === "connected" || isMockMode ? (
                  <Button
                    onClick={isMockMode ? stopMockMode : disconnectSmart}
                    variant="destructive"
                    className="flex items-center gap-2"
                  >
                    <Square className="h-4 w-4" />
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    onClick={connectSmart}
                    disabled={connectionStatus === "connecting"}
                    className="flex items-center gap-2"
                  >
                    <Play className="h-4 w-4" />
                    Connect
                  </Button>
                )}
              </div>
              
              {/* Quick URL buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setWsUrl("wss://pumpportal.fun")}
                  disabled={connectionStatus === "connected" || isMockMode}
                  className="text-xs"
                >
                  PumpPortal
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setWsUrl("wss://frontend-api-v3.pump.fun")}
                  disabled={connectionStatus === "connected" || isMockMode}
                  className="text-xs"
                >
                  Pump.fun
                </Button>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <Separator orientation="vertical" className="h-6" />
              <span className="text-sm text-slate-600 dark:text-slate-400">or</span>
              <Button
                onClick={startMockMode}
                variant="outline"
                disabled={connectionStatus === "connected" || isMockMode}
                className="flex items-center gap-2 bg-transparent"
              >
                <Activity className="h-4 w-4" />
                Test with Mock Data
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Trading Feed */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Live Trades
              </span>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{trades.length} trades</Badge>
                {trades.length > 0 && (
                  <Button
                    onClick={clearTradesList}
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-xs"
                  >
                    Clear List
                  </Button>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trades.length === 0 ? (
              <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No trades yet</p>
                <p className="text-sm">
                  {connectionStatus === "connected" || isMockMode
                    ? "Waiting for trade data..."
                    : "Connect to a Socket.IO server or use mock data to see trades"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-full">
                  {/* Header */}
                  <div className="grid grid-cols-6 gap-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg mb-2 text-sm font-medium text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Time
                    </div>
                    <div>Symbol</div>
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      Price
                    </div>
                    <div>Size</div>
                    <div>Side</div>
                    <div>Exchange</div>
                  </div>

                  {/* Trades */}
                  <div className="space-y-1 max-h-96 overflow-y-auto">
                    {trades.map((trade, index) => (
                      <div
                        key={`${trade.id}-${trade.timestamp}-${index}`}
                        className="grid grid-cols-6 gap-4 p-3 rounded-lg border transition-all duration-300 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                      >
                        <div className="text-sm font-mono text-slate-600 dark:text-slate-400">
                          {formatTime(trade.timestamp)}
                        </div>
                        <div className="font-medium truncate" title={trade.symbol}>
                          {trade.symbol}
                        </div>
                        <div className="font-mono text-sm">{formatPrice(trade.price)}</div>
                        <div className="font-mono text-sm">{trade.size.toFixed(3)}</div>
                        <div>
                          <Badge
                            variant={trade.side === "buy" ? "default" : "destructive"}
                            className="flex items-center gap-1 w-fit"
                          >
                            {trade.side === "buy" ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {trade.side === "buy" ? "BUY" : "SELL"}
                          </Badge>
                        </div>
                        <div className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate" title={trade.exchange}>
                          {trade.exchange}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
