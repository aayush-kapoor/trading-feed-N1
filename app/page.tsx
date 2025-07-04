"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
  const symbols = ["BTC/USD", "ETH/USD", "SOL/USD", "ADA/USD", "DOT/USD"]
  const exchanges = ["Binance", "Coinbase", "Kraken", "Bybit", "OKX"]
  const sides: ("buy" | "sell")[] = ["buy", "sell"]

  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    symbol: symbols[Math.floor(Math.random() * symbols.length)],
    price: Math.random() * 50000 + 1000,
    size: Math.random() * 10 + 0.1,
    side: sides[Math.floor(Math.random() * sides.length)],
    exchange: exchanges[Math.floor(Math.random() * exchanges.length)],
  }
}

export default function TradingFeed() {
  const [wsUrl, setWsUrl] = useState("")
  const [socket, setSocket] = useState<WebSocket | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected" | "error">(
    "disconnected",
  )
  const [trades, setTrades] = useState<Trade[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isMockMode, setIsMockMode] = useState(false)
  const [mockInterval, setMockInterval] = useState<NodeJS.Timeout | null>(null)

  // Format price with appropriate decimal places
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    }).format(price)
  }

  // Format size with appropriate decimal places
  const formatSize = (size: number) => {
    return size.toFixed(4)
  }

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

  // Connect to WebSocket
  const connectWebSocket = useCallback(() => {
    if (!wsUrl.trim()) {
      setError("Please enter a WebSocket URL")
      return
    }

    try {
      setConnectionStatus("connecting")
      setError(null)

      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        setConnectionStatus("connected")
        setSocket(ws)
        console.log("WebSocket connected")
      }

      ws.onmessage = (event) => {
        try {
          const trade: Trade = JSON.parse(event.data)

          // Validate trade object structure
          if (
            trade.id &&
            trade.timestamp &&
            trade.symbol &&
            typeof trade.price === "number" &&
            typeof trade.size === "number" &&
            (trade.side === "buy" || trade.side === "sell") &&
            trade.exchange
          ) {
            setTrades((prevTrades) => [trade, ...prevTrades.slice(0, 99)]) // Keep last 100 trades
          } else {
            console.warn("Invalid trade data received:", trade)
          }
        } catch (err) {
          console.error("Error parsing trade data:", err)
        }
      }

      ws.onerror = (error) => {
        console.error("WebSocket error:", error)
        setConnectionStatus("error")
        setError("WebSocket connection error")
      }

      ws.onclose = () => {
        setConnectionStatus("disconnected")
        setSocket(null)
        console.log("WebSocket disconnected")
      }
    } catch (err) {
      setConnectionStatus("error")
      setError("Failed to connect to WebSocket")
      console.error("Connection error:", err)
    }
  }, [wsUrl])

  // Disconnect WebSocket
  const disconnectWebSocket = useCallback(() => {
    if (socket) {
      socket.close()
      setSocket(null)
    }
    setConnectionStatus("disconnected")
  }, [socket])

  // Start mock data mode
  const startMockMode = () => {
    setIsMockMode(true)
    setConnectionStatus("connected")
    setError(null)

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
  }

  // Stop mock data mode
  const stopMockMode = () => {
    setIsMockMode(false)
    setConnectionStatus("disconnected")
    if (mockInterval) {
      clearInterval(mockInterval)
      setMockInterval(null)
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socket) {
        socket.close()
      }
      if (mockInterval) {
        clearInterval(mockInterval)
      }
    }
  }, [socket, mockInterval])

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
    switch (connectionStatus) {
      case "connected":
        return "Connected"
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
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Live Trading Feed</h1>
          </div>
          <p className="text-slate-600 dark:text-slate-400">
            Connect to any WebSocket feed to view real-time trading data
          </p>
        </div>

        {/* Connection Panel */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon()}
              WebSocket Connection
              <Badge variant={connectionStatus === "connected" ? "default" : "secondary"}>{getStatusText()}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="wss://your-websocket-url.com"
                value={wsUrl}
                onChange={(e) => setWsUrl(e.target.value)}
                className="flex-1"
                disabled={connectionStatus === "connected" || isMockMode}
              />
              {connectionStatus === "connected" || isMockMode ? (
                <Button
                  onClick={isMockMode ? stopMockMode : disconnectWebSocket}
                  variant="destructive"
                  className="flex items-center gap-2"
                >
                  <Square className="h-4 w-4" />
                  Disconnect
                </Button>
              ) : (
                <Button
                  onClick={connectWebSocket}
                  disabled={connectionStatus === "connecting"}
                  className="flex items-center gap-2"
                >
                  <Play className="h-4 w-4" />
                  Connect
                </Button>
              )}
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

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
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
              <Badge variant="outline">{trades.length} trades</Badge>
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
                    : "Connect to a WebSocket or use mock data to see trades"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-full">
                  {/* Header */}
                  <div className="grid grid-cols-7 gap-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg mb-2 text-sm font-medium text-slate-600 dark:text-slate-400">
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
                    <div>ID</div>
                  </div>

                  {/* Trades */}
                  <div className="space-y-1 max-h-96 overflow-y-auto">
                    {trades.map((trade, index) => (
                      <div
                        key={trade.id}
                        className={`grid grid-cols-7 gap-4 p-3 rounded-lg border transition-all duration-300 ${
                          index === 0
                            ? "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800"
                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        <div className="text-sm font-mono text-slate-600 dark:text-slate-400">
                          {formatTime(trade.timestamp)}
                        </div>
                        <div className="font-medium">{trade.symbol}</div>
                        <div className="font-mono">{formatPrice(trade.price)}</div>
                        <div className="font-mono">{formatSize(trade.size)}</div>
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
                            {trade.side.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="text-sm">{trade.exchange}</div>
                        <div className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">
                          {trade.id.split("-")[0]}...
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
