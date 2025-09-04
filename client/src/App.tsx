import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import Home from './pages/Home'
import TicTacToe from './pages/TicTacToe'
import RockPaperScissors from './pages/RockPaperScissors'

export default function App() {
	return (
		<div className="min-h-screen bg-gradient-to-b from-sky-300 to-sky-500 text-white">
			<BrowserRouter>
				<header className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
					<Link to="/" className="text-xl font-bold">Game Hub</Link>
					<nav className="flex gap-4 text-sm">
						<Link to="/">Home</Link>
						<Link to="/tic-tac-toe">Tic Tac Toe</Link>
						<Link to="/rock-paper-scissors">RPS</Link>
					</nav>
				</header>
				<main className="max-w-5xl mx-auto px-4 pb-10 flex items-start justify-center py-6">
					<Routes>
						<Route path="/" element={<Home />} />
						<Route path="/tic-tac-toe" element={<TicTacToe />} />
						<Route path="/rock-paper-scissors" element={<RockPaperScissors />} />
					</Routes>
				</main>
			</BrowserRouter>
		</div>
	)
}
