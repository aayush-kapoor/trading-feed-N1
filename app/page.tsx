"use client"

import { useState, useEffect, useCallback } from "react"
import { io, Socket } from "socket.io-client"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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

export default function TradingFeed() {
  const [wsUrl, setWsUrl] = useState("")
  const [socket, setSocket] = useState<Socket | null>(null)
  const [webSocket, setWebSocket] = useState<WebSocket | null>(null)
  const [connectionType, setConnectionType] = useState<"socket.io" | "websocket" | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected" | "error">(
    "disconnected",
  )
  const [trades, setTrades] = useState<Trade[]>([])

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
      let parsedData = tradeData

      // If it's a string, try to parse as JSON (for raw WebSocket messages)
      if (typeof tradeData === "string") {
        try {
          parsedData = JSON.parse(tradeData)
        } catch {
          // If JSON parsing fails, skip this message
          return
        }
      }

      // Handle different data structures that might come from various servers
      let trade: Trade

      // Check if it's already in our expected format
      if (parsedData.id && parsedData.timestamp && parsedData.symbol && parsedData.price !== undefined) {
        trade = {
          id: parsedData.id,
          timestamp: parsedData.timestamp,
          symbol: parsedData.symbol,
          price: parsedData.price,
          size: parsedData.size || 0,
          side: parsedData.side || 'buy',
          exchange: parsedData.exchange || 'unknown',
        }
      } else {
        // Map other possible formats (like pump.fun data structure)
        trade = {
          id: parsedData.signature || parsedData.id || crypto.randomUUID(),
          timestamp: parsedData.timestamp || Date.now(),
          symbol: parsedData.symbol || `${parsedData.name || 'UNK'}/${parsedData.symbol || 'USD'}`,
          price: parsedData.price || parsedData.sol_amount || 0,
          size: parsedData.size || parsedData.token_amount || 0,
          side: parsedData.side || (parsedData.is_buy ? 'buy' : 'sell'),
          exchange: parsedData.exchange || 'unknown',
        }
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
        
        // Listen for various possible event names
        newSocket.on('tradeCreated', handleTradeData)
        newSocket.on('trade', handleTradeData)
        newSocket.on('data', handleTradeData)
        newSocket.on('message', handleTradeData)
        
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

  // Smart connection logic - try Socket.IO first, then WebSocket
  const connectSmart = useCallback(async () => {
    if (!wsUrl.trim()) {
      toast.error("Please enter a WebSocket URL")
      return
    }

    setConnectionStatus("connecting")
    
    try {
      // Try Socket.IO first
      try {
        const socketConnection = await trySocketIO(wsUrl)
        setSocket(socketConnection)
        setConnectionType("socket.io")
        setConnectionStatus("connected")
        toast.success("Connected via Socket.IO")
        return
      } catch (socketIOError) {
        // Socket.IO failed, try WebSocket
        try {
          const wsConnection = await tryWebSocket(wsUrl)
          setWebSocket(wsConnection)
          setConnectionType("websocket")
          setConnectionStatus("connected")
          toast.success("Connected via WebSocket")
          return
        } catch (wsError) {
          // Both failed
          setConnectionStatus("error")
          toast.error("Failed to connect via Socket.IO or WebSocket")
        }
      }
    } catch (err) {
      setConnectionStatus("error")
      toast.error("Connection failed")
    }
  }, [wsUrl])

  // Smart disconnect
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
    }
  }, [socket, webSocket])

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
              WebSocket Connection
              <Badge variant={connectionStatus === "connected" ? "default" : "secondary"}>{getStatusText()}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="wss://your-server.com"
                  value={wsUrl}
                  onChange={(e) => setWsUrl(e.target.value)}
                  className="flex-1"
                  disabled={connectionStatus === "connected"}
                />
                {connectionStatus === "connected" ? (
                  <Button
                    onClick={disconnectSmart}
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
                  onClick={() => setWsUrl("wss://trading-websocket-backend.onrender.com")}
                  disabled={connectionStatus === "connected"}
                  className="text-xs"
                >
                  Mock Server 1
                </Button>                                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setWsUrl("wss://frontend-api-v3.pump.fun")}
                  disabled={connectionStatus === "connected"}
                  className="text-xs"
                >
                  Mock Server 2
                </Button>
              </div>
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
                  {connectionStatus === "connected"
                    ? "Waiting for trade data..."
                    : "Connect to a WebSocket server to see live trades"}
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
