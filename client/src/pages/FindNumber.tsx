import { useEffect, useMemo, useRef, useState } from 'react'

type Claims = Record<number, string>

type Player = { id: string; color: string }

type JoinPayload = {
	roomId: string
	color?: string
	numbers: number[]
	claimed: Claims
	next: number
	score: Record<string, number>
	winner: string | 'Draw' | null
}

export default function FindNumber() {
	const [desiredRoomId, setDesiredRoomId] = useState('')
	const [roomId, setRoomId] = useState('')
	const [numbers, setNumbers] = useState<number[]>([])
	const [claimed, setClaimed] = useState<Claims>({})
	const [players, setPlayers] = useState<Player[]>([])
	const [next, setNext] = useState(1)
	const [score, setScore] = useState<Record<string, number>>({})
	const [winner, setWinner] = useState<string | 'Draw' | null>(null)
	const myColorRef = useRef<string>('#22c55e')

	const serverUrl = useMemo(() => (import.meta.env.VITE_SERVER_URL as string) || 'http://localhost:3001', [])
	const [socket, setSocket] = useState<any>(null)

	useEffect(() => {
		let mounted = true
		;(async () => {
			const { io } = await import('socket.io-client')
			if (!mounted) return
			const s = io(serverUrl, { transports: ['websocket'] })
			setSocket(s)
		})()
		return () => { mounted = false; socket?.disconnect() }
	}, [])

	useEffect(() => {
		if (!socket) return
		const onJoined = (p: JoinPayload) => {
			setRoomId(p.roomId)
			if (p.color) myColorRef.current = p.color
			setNumbers(p.numbers)
			setClaimed(p.claimed)
			setNext(p.next)
			setScore(p.score)
			setWinner(p.winner)
		}
		const onUpdate = (p: { players: Player[]; next: number; score: Record<string, number>; claimed: Claims }) => {
			setPlayers(p.players)
			setNext(p.next)
			setScore(p.score)
			setClaimed(p.claimed)
			setWinner(null)
		}
		const onReveal = (p: { players: Player[]; score: Record<string, number>; claimed: Claims; winner: string | 'Draw' | null }) => {
			setPlayers(p.players)
			setScore(p.score)
			setClaimed(p.claimed)
			setWinner(p.winner)
		}
		socket.on('find:joined', onJoined)
		socket.on('find:update', onUpdate)
		socket.on('find:reveal', onReveal)
		return () => {
			socket.off('find:joined', onJoined)
			socket.off('find:update', onUpdate)
			socket.off('find:reveal', onReveal)
		}
	}, [socket])

	const joinRoom = () => {
		if (!socket || !desiredRoomId) return
		socket.emit('find:join', { roomId: desiredRoomId })
	}

	const onClickNum = (num: number) => {
		if (!socket || !roomId) return
		socket.emit('find:click', { roomId, num })
	}

	const reset = () => {
		if (!socket || !roomId) return
		socket.emit('find:reset', { roomId })
	}

	// Generate random absolute positions for each number (stable per render)
	// const positions = useMemo(() => {
	// 	const pos: Record<number, { x: number; y: number }> = {}
	// 	const used: { x: number; y: number }[] = []
	// 	const width = 600
	// 	const height = 400
	// 	const size = 44
	// 	const collides = (a: {x:number;y:number}, b: {x:number;y:number}) => Math.abs(a.x-b.x) < size && Math.abs(a.y-b.y) < size
	// 	numbers.forEach((n) => {
	// 		let attempt = 0
	// 		let placed = { x: Math.random() * (width - size), y: Math.random() * (height - size) }
	// 		while (used.some((u) => collides(u, placed)) && attempt < 200) {
	// 			placed = { x: Math.random() * (width - size), y: Math.random() * (height - size) }
	// 			attempt++
	// 		}
	// 		used.push(placed)
	// 		pos[n] = placed
	// 	})
	// 	return pos
	// }, [numbers])
	// Generate random absolute positions for each number (stable per render)
const positions = useMemo(() => {
	const pos: Record<number, { x: number; y: number }> = {}
	const used: { x: number; y: number }[] = []
	const width = 600
	const height = 400
	const size = 44
	const padding = 8 // extra spacing so circles don't touch
	const minDist = size + padding
  
	const collides = (a: { x: number; y: number }, b: { x: number; y: number }) =>
	  Math.hypot(a.x - b.x, a.y - b.y) < minDist
  
	numbers.forEach((n) => {
	  let attempt = 0
	  let placed: { x: number; y: number } | null = null
  
	  while (attempt < 1000) {
		const candidate = {
		  x: Math.random() * (width - size),
		  y: Math.random() * (height - size),
		}
		if (!used.some((u) => collides(u, candidate))) {
		  placed = candidate
		  break
		}
		attempt++
	  }
  
	  // fallback: if random placement fails, put them in grid
	  if (!placed) {
		const gridSize = Math.ceil(Math.sqrt(numbers.length))
		const cellW = width / gridSize
		const cellH = height / gridSize
		const idx = numbers.indexOf(n)
		placed = {
		  x: (idx % gridSize) * cellW + cellW / 2 - size / 2,
		  y: Math.floor(idx / gridSize) * cellH + cellH / 2 - size / 2,
		}
	  }
  
	  used.push(placed)
	  pos[n] = placed
	})
  
	return pos
  }, [numbers])
  

	const you = players.find((p) => p.color === myColorRef.current)
	const opp = players.find((p) => p.color !== myColorRef.current)
	const youScore = you ? (score[you.id] || 0) : 0
	const oppScore = opp ? (score[opp.id] || 0) : 0
	const canClick = (num: number) => num === next && !claimed[num]

	return (
		<div className="w-full max-w-5xl space-y-6">
			<h1 className="text-3xl font-extrabold text-center drop-shadow">Find Number</h1>

			<div className="bg-slate-900/20 rounded-xl p-4 border border-white/20 space-y-3">
				<div className="flex gap-2">
					<input
						placeholder="Enter room id"
						value={desiredRoomId}
						onChange={(e) => setDesiredRoomId(e.target.value)}
						className="flex-1 rounded-lg bg-white/20 border border-white/30 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-600 text-white placeholder-white/70"
					/>
					<button onClick={joinRoom} className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2">Join</button>
					{roomId && <button onClick={reset} className="rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 px-4 py-2">Reset</button>}
				</div>
				{roomId && (
					<div className="text-sm text-white/90 flex items-center justify-between">
						<div>Room: <span className="font-mono">{roomId}</span> • Next: <span className="font-bold">{next}</span></div>
						<div>You: <span className="font-bold" style={{color: myColorRef.current}}>{youScore}</span> • Opponent: <span className="font-bold" style={{color: opp?.color || '#3b82f6'}}>{oppScore}</span></div>
					</div>
				)}
			</div>

			<div className="relative mx-auto" style={{ width: 600, height: 400 }}>
				{numbers.map((n) => {
					const pos = positions[n]
					const owner = claimed[n]
					const isYou = owner && you && owner === you.id
					const color = owner ? (isYou ? myColorRef.current : (opp?.color || '#3b82f6')) : '#0ea5e9'
					return (
						<button key={n}
							onClick={() => onClickNum(n)}
							disabled={!canClick(n)}
							className={`absolute rounded-full w-11 h-11 flex items-center justify-center font-bold text-white shadow ${!canClick(n) && owner ? '' : 'hover:brightness-110'}`}
							style={{ left: pos?.x, top: pos?.y, backgroundColor: color, opacity: owner ? 0.9 : 1 }}
						>
							{n}
						</button>
					)
				})}
			</div>

			{winner !== null && (
				<div className="text-center space-y-2">
					<div>Winner: <span className="font-bold">{winner === 'Draw' ? 'Draw' : (winner && you && winner === you.id ? 'You' : 'Opponent')}</span></div>
				</div>
			)}
		</div>
	)
}
