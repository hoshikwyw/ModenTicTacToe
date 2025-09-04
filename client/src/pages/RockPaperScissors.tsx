import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const choices = ['Rock', 'Paper', 'Scissors'] as const

type Choice = typeof choices[number]

type Phase = 'lobby' | 'picking' | 'reveal'

type RpsState = {
	roomId: string
	players: { id: string; role?: 'A' | 'B' }[]
	choicesCount: number
	result: 'A' | 'B' | 'Draw' | null
	revealed?: Record<string, Choice>
	role?: 'A' | 'B'
}

export default function RockPaperScissors() {
	const [desiredRoomId, setDesiredRoomId] = useState('')
	const [state, setState] = useState<RpsState>({ roomId: '', players: [], choicesCount: 0, result: null })
	const [phase, setPhase] = useState<Phase>('lobby')
	const [myChoice, setMyChoice] = useState<Choice | null>(null)

	const serverUrl = useMemo(() => {
		const envUrl = (import.meta.env.VITE_SERVER_URL as string) || ''
		const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
		return isLocal ? 'http://localhost:3001' : envUrl
	}, [])

	const [socket, setSocket] = useState<any>(null)
	const navigate = useNavigate()
	const prevCountRef = useRef(0)
	useEffect(() => {
		let mounted = true
		;(async () => {
			const { io } = await import('socket.io-client')
			if (!mounted) return
			const s = io(serverUrl, { transports: ['websocket'] })
			setSocket(s)
			console.log('[RPS] socket created ->', serverUrl)
		})()
		return () => { mounted = false; socket?.disconnect() }
	}, [])

	useEffect(() => {
		if (!socket) return
		const onJoined = (p: { roomId: string; role: 'A'|'B'; players: {id:string; role:'A'|'B'}[]; choices: number; result: any }) => {
			console.log('[RPS] joined', p)
			setState({ roomId: p.roomId, role: p.role, players: p.players, choicesCount: p.choices, result: p.result })
			setPhase('picking')
			prevCountRef.current = p.players.length
		}
		const onUpdate = (p: { players: { id: string; role:'A'|'B' }[]; choices: number; result: any }) => {
			console.log('[RPS] update', p)
			const isReset = p.choices === 0 && p.result == null
			setState((s) => ({
				...s,
				players: p.players,
				choicesCount: p.choices,
				result: p.result,
				revealed: isReset ? undefined : s.revealed,
			}))
			if (p.result == null) setPhase('picking')
			if (isReset) setMyChoice(null)
			const prev = prevCountRef.current
			const next = p.players.length
			if (prev === 2 && next < 2) {
				alert('Opponent left the room')
				navigate('/')
			}
			prevCountRef.current = next
		}
		const onReveal = (p: { players: { id: string; role:'A'|'B' }[]; choices: Record<string, Choice>; result: 'A' | 'B' | 'Draw' }) => {
			console.log('[RPS] reveal', p)
			setState((s) => ({ ...s, players: p.players, choicesCount: 2, result: p.result, revealed: p.choices }))
			setPhase('reveal')
			prevCountRef.current = p.players.length
		}
		const onFull = () => {
			console.warn('[RPS] room full')
			alert('Room is full')
		}
		socket.on('connect', () => console.log('[RPS] socket connected'))
		socket.on('rps:joined', onJoined)
		socket.on('rps:update', onUpdate)
		socket.on('rps:reveal', onReveal)
		socket.on('rps:full', onFull)
		return () => {
			socket.off('rps:joined', onJoined)
			socket.off('rps:update', onUpdate)
			socket.off('rps:reveal', onReveal)
			socket.off('rps:full', onFull)
		}
	}, [socket])

	const joinRoom = () => {
		if (!socket || !desiredRoomId) return
		console.log('[RPS] join request', desiredRoomId)
		socket.emit('rps:join', { roomId: desiredRoomId })
	}

	const choose = (c: Choice) => {
		if (!socket || !state.roomId) return
		setMyChoice(c)
		console.log('[RPS] choose', c)
		socket.emit('rps:choose', { roomId: state.roomId, choice: c })
	}

	const reset = () => {
		if (!socket || !state.roomId) return
		setMyChoice(null)
		setPhase('picking')
		console.log('[RPS] reset')
		socket.emit('rps:reset', { roomId: state.roomId })
	}

	return (
		<div className="w-full max-w-md space-y-6">
			<h1 className="text-3xl font-extrabold text-center drop-shadow">Rock Paper Scissors</h1>

			<div className="bg-slate-900/20 rounded-xl p-4 border border-white/20 space-y-3">
				<div className="flex gap-2">
					<input
						placeholder="Enter room id"
						value={desiredRoomId}
						onChange={(e) => setDesiredRoomId(e.target.value)}
						className="flex-1 rounded-lg bg-white/20 border border-white/30 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-600 text-white placeholder-white/70"
					/>
					<button onClick={joinRoom} className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2">Join</button>
				</div>
				{state.roomId && (
					<div className="text-sm text-white/90 flex items-center justify-between">
						<div>Room: <span className="font-mono">{state.roomId}</span> • Players: <span className="font-bold">{state.players.length}/2</span> {state.role ? `• You: ${state.role}` : ''}</div>
						<button
							className="text-xs px-2 py-1 rounded bg-white/10 border border-white/20 hover:bg-white/20"
							onClick={() => navigator.clipboard.writeText(state.roomId)}
						>Copy RoomId</button>
					</div>
				)}
			</div>

			{state.roomId && (
				<div className="space-y-4">
					<div className="flex items-center justify-center gap-3">
						{choices.map((c) => (
							<button key={c} onClick={() => choose(c)} disabled={phase === 'reveal'} className={`px-4 py-2 rounded-lg border ${myChoice===c?'bg-emerald-500/20 border-emerald-400':'bg-white/10 border-white/20 hover:bg-white/20'}`}>{c}</button>
						))}
					</div>
					<div className="text-center text-sm opacity-90">Choices submitted: {state.choicesCount}/2</div>
					{phase === 'reveal' && (
						<div className="text-center space-y-2">
							{(() => {
								const idA = state.players.find((p) => p.role === 'A')?.id
								const idB = state.players.find((p) => p.role === 'B')?.id
								const yourChoice = state.role === 'A' ? state.revealed?.[idA ?? ''] : state.revealed?.[idB ?? '']
								const oppChoice = state.role === 'A' ? state.revealed?.[idB ?? ''] : state.revealed?.[idA ?? '']
								const winnerLabel = state.result === 'Draw' ? 'Draw' : (state.result === state.role ? 'You' : 'Opponent')
								return (
									<>
										<div>Winner: <span className="font-bold">{winnerLabel}</span></div>
										<div className="text-xs">You: <span className="font-semibold">{yourChoice ?? '-'}</span> • Opponent: <span className="font-semibold">{oppChoice ?? '-'}</span></div>
									</>
								)
							})()}
							<button onClick={reset} className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20">Play Again</button>
						</div>
					)}
				</div>
			)}
		</div>
	)
}
