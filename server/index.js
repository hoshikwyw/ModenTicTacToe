const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
    },
});

// In-memory room state
const rooms = new Map();

function createEmptyBoard() {
    return Array(9).fill(null);
}

function calculateWinner(board) {
    const lines = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6],
    ];
    for (const [a, b, c] of lines) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }
    return null;
}

function getAvailableMoves(board) {
    return board
        .map((v, i) => (v === null ? i : null))
        .filter((i) => i !== null);
}

function makeBotMove(board, botMark) {
    const available = getAvailableMoves(board);
    if (available.length === 0) return board;
    // simple: random move
    const move = available[Math.floor(Math.random() * available.length)];
    const newBoard = board.slice();
    newBoard[move] = botMark;
    return newBoard;
}

io.on('connection', (socket) => {
    // Create or join a room
    socket.on('room:join', ({ roomId }) => {
        let room = rooms.get(roomId);
        if (!room) {
            room = {
                players: [], // [{id, mark}]
                board: createEmptyBoard(),
                turn: 'X',
                winner: null,
                isBot: false,
            };
            rooms.set(roomId, room);
        }

        if (room.players.length >= 2 && !room.isBot) {
            socket.emit('room:full');
            return;
        }

        const assignedMark = room.players.length === 0 ? 'X' : 'O';
        room.players.push({ id: socket.id, mark: assignedMark });
        socket.join(roomId);

        socket.emit('room:joined', { roomId, mark: assignedMark });
        io.to(roomId).emit('game:update', {
            board: room.board,
            turn: room.turn,
            winner: room.winner,
            players: room.players.map((p) => ({ id: p.id, mark: p.mark })),
            isBot: room.isBot,
        });
    });

    // Start bot mode in a given room
    socket.on('room:startBot', ({ roomId }) => {
        let room = rooms.get(roomId);
        if (!room) {
            room = {
                players: [],
                board: createEmptyBoard(),
                turn: 'X',
                winner: null,
                isBot: true,
            };
            rooms.set(roomId, room);
        } else {
            room.isBot = true;
        }
        io.to(roomId).emit('game:update', {
            board: room.board,
            turn: room.turn,
            winner: room.winner,
            players: room.players.map((p) => ({ id: p.id, mark: p.mark })),
            isBot: room.isBot,
        });
    });

    // Handle a move
    socket.on('game:move', ({ roomId, index }) => {
        const room = rooms.get(roomId);
        if (!room || room.winner) return;

        const player = room.players.find((p) => p.id === socket.id);
        if (!player) return;
        if (room.turn !== player.mark) return;
        if (room.board[index] !== null) return;

        room.board[index] = player.mark;
        room.turn = player.mark === 'X' ? 'O' : 'X';
        room.winner = calculateWinner(room.board);

        io.to(roomId).emit('game:update', {
            board: room.board,
            turn: room.turn,
            winner: room.winner,
            players: room.players.map((p) => ({ id: p.id, mark: p.mark })),
            isBot: room.isBot,
        });

        // If bot's turn and bot mode enabled
        if (!room.winner && room.isBot) {
            const botMark = room.turn;
            room.board = makeBotMove(room.board, botMark);
            room.turn = botMark === 'X' ? 'O' : 'X';
            room.winner = calculateWinner(room.board);
            io.to(roomId).emit('game:update', {
                board: room.board,
                turn: room.turn,
                winner: room.winner,
                players: room.players.map((p) => ({ id: p.id, mark: p.mark })),
                isBot: room.isBot,
            });
        }
    });

    // Reset game
    socket.on('game:reset', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (!room) return;
        room.board = createEmptyBoard();
        room.turn = 'X';
        room.winner = null;
        io.to(roomId).emit('game:update', {
            board: room.board,
            turn: room.turn,
            winner: room.winner,
            players: room.players.map((p) => ({ id: p.id, mark: p.mark })),
            isBot: room.isBot,
        });
    });

    socket.on('disconnect', () => {
        for (const [roomId, room] of rooms.entries()) {
            const idx = room.players.findIndex((p) => p.id === socket.id);
            if (idx !== -1) {
                room.players.splice(idx, 1);
                io.to(roomId).emit('game:update', {
                    board: room.board,
                    turn: room.turn,
                    winner: room.winner,
                    players: room.players.map((p) => ({ id: p.id, mark: p.mark })),
                    isBot: room.isBot,
                });
                if (room.players.length === 0 && !room.isBot) {
                    rooms.delete(roomId);
                }
            }
        }
    });
});

app.get('/', (_req, res) => {
    res.send('Tic Tac Toe Socket.IO server');
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});
