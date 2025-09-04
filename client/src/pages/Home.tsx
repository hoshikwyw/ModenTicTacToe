import { Link } from 'react-router-dom'

export default function Home() {
	return (
		<div className="w-full max-w-xl mx-auto space-y-6">
			<h1 className="text-3xl font-extrabold text-center drop-shadow">Choose a Game</h1>
			<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
				<Link to="/tic-tac-toe" className="rounded-xl bg-white/10 border border-white/20 p-4 hover:bg-white/20 transition">
					<div className="text-xl font-bold">Tic Tac Toe</div>
					<p className="text-sm opacity-80">Play with a friend or bot</p>
				</Link>
				<Link to="/rock-paper-scissors" className="rounded-xl bg-white/10 border border-white/20 p-4 hover:bg-white/20 transition">
					<div className="text-xl font-bold">Rock Paper Scissors</div>
					<p className="text-sm opacity-80">Play with a friend (room ID)</p>
				</Link>
				<div className="rounded-xl bg-white/5 border border-white/10 p-4 opacity-60 cursor-not-allowed">
					<div className="text-xl font-bold">Roll Dice</div>
					<p className="text-sm opacity-80">Coming soon</p>
				</div>
			</div>
		</div>
	)
}
