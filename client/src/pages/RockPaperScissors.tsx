import { useEffect, useMemo, useState } from 'react'

const choices = ['Rock', 'Paper', 'Scissors'] as const

type Choice = typeof choices[number]

type Phase = 'lobby' | 'picking' | 'reveal'

type RpsState = {
	roomId: string
	players: string[]
	choicesCount: number
	result: 'A' | 'B' | 'Draw' | null
	revealed?: Record<string, Choice>
}

export default function RockPaperScissors() {
	const [desiredRoomId, setDesiredRoomId] = useState('')
	const [state, setState] = useState<RpsState>({ roomId: '', players: [], choicesCount: 0, result: null })
	const [phase, setPhase] = useState<Phase>('lobby')
	const [myChoice, setMyChoice] = useState<Choice | null>(null)

	const serverUrl = useMemo(() => import.meta.env.VITE_SERVER_URL as string, [])

	const [socket, setSocket] = useState<any>(null)
	useEffect(() => {
		let mounted = true
		;(async () => {
			const { io } = await import('socket.io-client')
			if (!mounted) return
			setSocket(io(serverUrl, { transports: ['websocket'] }))
		})()
		return () => { mounted = false; socket?.disconnect() }
	}, [])

	useEffect(() => {
		if (!socket) return
		const onUpdate = (p: { players: { id: string }[]; choices: number; result: any }) => {
			setState((s) => ({ ...s, players: p.players.map((x) => x.id), choicesCount: p.choices, result: p.result }))
			if (p.result == null) setPhase('picking')
		}
		const onReveal = (p: { players: { id: string }[]; choices: Record<string, Choice>; result: 'A' | 'B' | 'Draw' }) => {
			setState((s) => ({ ...s, players: p.players.map((x) => x.id), choicesCount: 2, result: p.result, revealed: p.choices }))
			setPhase('reveal')
		}
		socket.on('rps:update', onUpdate)
		socket.on('rps:reveal', onReveal)
		return () => {
			socket.off('rps:update', onUpdate)
			socket.off('rps:reveal', onReveal)
		}
	}, [socket])

	const joinRoom = () => {
		if (!socket || !desiredRoomId) return
		socket.emit('rps:join', { roomId: desiredRoomId })
		setState((s) => ({ ...s, roomId: desiredRoomId }))
		setPhase('picking')
	}

	const choose = (c: Choice) => {
		if (!socket || !state.roomId) return
		setMyChoice(c)
		socket.emit('rps:choose', { roomId: state.roomId, choice: c })
	}

	const reset = () => {
		if (!socket || !state.roomId) return
		setMyChoice(null)
		setPhase('picking')
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
						<div>Room: <span className="font-mono">{state.roomId}</span> • Players: <span className="font-bold">{state.players.length}/2</span></div>
						<button
							className="text-xs px-2 py-1 rounded bg-white/10 border border-white/20 hover:bg-white/20"
							onClick={() => navigator.clipboard.writeText(state.roomId)}
						>Copy RoomId</button>
					</div>
				)}
			</div>

			{phase !== 'lobby' && (
				<div className="space-y-4">
					<div className="flex items-center justify-center gap-3">
						{choices.map((c) => (
							<button key={c} onClick={() => choose(c)} disabled={phase === 'reveal'} className={`px-4 py-2 rounded-lg border ${myChoice===c?'bg-emerald-500/20 border-emerald-400':'bg-white/10 border-white/20 hover:bg-white/20'}`}>{c}</button>
						))}
					</div>
					<div className="text-center text-sm opacity-90">Choices submitted: {state.choicesCount}/2</div>
					{phase === 'reveal' && (
						<div className="text-center space-y-2">
							<div>Result: <span className="font-bold">{state.result}</span></div>
							<div className="text-xs">Revealed: {state.revealed ? JSON.stringify(state.revealed) : '-'}</div>
							<button onClick={reset} className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20">Play Again</button>
						</div>
					)}
				</div>
			)}
		</div>
	)
}
