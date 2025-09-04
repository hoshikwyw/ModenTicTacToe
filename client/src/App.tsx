import { useEffect, useMemo, useState } from 'react'

type GameState = {
  roomId: string
  mark: 'X' | 'O' | null
  board: (null | 'X' | 'O')[]
  turn: 'X' | 'O'
  winner: 'X' | 'O' | null
  isBot: boolean
}

function useSocket(url: string) {
  const [ioClient, setIoClient] = useState<any>(null)
  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { io } = await import('socket.io-client')
      if (!mounted) return
      const s = io(url, { transports: ['websocket'] })
      setIoClient(s)
    })()
    return () => {
      mounted = false
      if (ioClient) ioClient.disconnect()
    }
  }, [])
  return ioClient
}

function App() {
  const [desiredRoomId, setDesiredRoomId] = useState<string>('')
  const [state, setState] = useState<GameState>({
    roomId: '',
    mark: null,
    board: Array(9).fill(null),
    turn: 'X',
    winner: null,
    isBot: false,
  })

  const serverUrl = useMemo(() => {
    return import.meta.env.VITE_SERVER_URL 
  }, [])
  const socket = useSocket(serverUrl)

  useEffect(() => {
    if (!socket) return
    const onJoined = ({ roomId, mark }: { roomId: string; mark: 'X' | 'O' }) => {
      setState((s) => ({ ...s, roomId, mark }))
    }
    const onUpdate = (payload: {
      board: (null | 'X' | 'O')[]
      turn: 'X' | 'O'
      winner: 'X' | 'O' | null
      players: { id: string; mark: 'X' | 'O' }[]
      isBot: boolean
    }) => {
      setState((s) => ({ ...s, board: payload.board, turn: payload.turn, winner: payload.winner, isBot: payload.isBot }))
    }
    const onFull = () => alert('Room is full')
    socket.on('room:joined', onJoined)
    socket.on('game:update', onUpdate)
    socket.on('room:full', onFull)
    return () => {
      socket.off('room:joined', onJoined)
      socket.off('game:update', onUpdate)
      socket.off('room:full', onFull)
    }
  }, [socket])

  const joinRoom = () => {
    if (!socket || !desiredRoomId) return
    socket.emit('room:join', { roomId: desiredRoomId })
  }

  const startBot = () => {
    if (!socket || !desiredRoomId) return
    socket.emit('room:startBot', { roomId: desiredRoomId })
  }

  const makeMove = (idx: number) => {
    if (!socket || !state.roomId) return
    if (state.board[idx] !== null || state.winner) return
    if (state.mark !== state.turn) return
    socket.emit('game:move', { roomId: state.roomId, index: idx })
  }

  const resetGame = () => {
    if (!socket || !state.roomId) return
    socket.emit('game:reset', { roomId: state.roomId })
  }

  

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-300 to-sky-500 text-white flex items-start justify-center py-6">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-3xl font-extrabold text-center drop-shadow">Tic Tac Toe Game</h1>

        <div className="bg-slate-900/20 rounded-xl p-4 border border-white/20 space-y-3">
          <div className="flex gap-2">
            <input
              placeholder="Enter room id"
              value={desiredRoomId}
              onChange={(e) => setDesiredRoomId(e.target.value)}
              className="flex-1 rounded-lg bg-white/20 border border-white/30 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-600 text-white placeholder-white/70"
            />
            <button onClick={joinRoom} className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2">Join</button>
            <button onClick={startBot} className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2">Play Bot</button>
          </div>
          {state.roomId && (
            <div className="text-sm text-white/90 flex items-center justify-between">
              <div>Room: <span className="font-mono">{state.roomId}</span> • You: <span className="font-bold">{state.mark ?? '-'}</span></div>
              <button
                className="text-xs px-2 py-1 rounded bg-white/10 border border-white/20 hover:bg-white/20"
                onClick={() => navigator.clipboard.writeText(state.roomId)}
              >Copy RoomId</button>
            </div>
          )}
          {state.roomId && (
            <div className="text-xs text-white/80">Invite a friend: share room id above. They should join the same id.</div>
          )}
        </div>

        <div className="grid grid-cols-3 grid-rows-3 gap-5 sm:gap-6 place-content-center w-full max-w-xs sm:max-w-sm mx-auto">
          {state.board.map((cell, i) => (
            <button
              key={i}
              onClick={() => makeMove(i)}
              className={`w-24 h-24 sm:w-28 sm:h-28 rounded-md border-2 border-gray-600 ${cell ? 'bg-gray-500' : 'bg-gray-400'} flex items-center justify-center text-4xl sm:text-5xl font-extrabold text-black select-none transition-[background-color,transform] duration-200 ease-out shadow-lg hover:bg-gray-300 hover:-translate-y-0.5`}
            >
              <span className="drop-shadow-sm">{cell}</span>
            </button>
          ))}
        </div>

        <div className="text-center space-y-2">
          <div>
            {state.winner ? (
              <span className="text-lg">Winner: <span className="font-bold">{state.winner}</span></span>
            ) : (
              <span className="text-lg">Turn: <span className="font-bold">{state.turn}</span></span>
            )}
          </div>
          <button onClick={resetGame} className="rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 px-4 py-2">Reset</button>
        </div>
      </div>
    </div>
  )
}

export default App
