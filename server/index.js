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
const rooms = new Map(); // TicTacToe
const rpsRooms = new Map(); // Rock Paper Scissors

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

// RPS helpers
const RPS_CHOICES = ['Rock', 'Paper', 'Scissors'];
function rpsDecide(a, b) {
    if (!a || !b) return null;
    if (a === b) return 'Draw';
    if ((a === 'Rock' && b === 'Scissors') || (a === 'Paper' && b === 'Rock') || (a === 'Scissors' && b === 'Paper')) {
        return 'A';
    }
    return 'B';
}

io.on('connection', (socket) => {
    // ========== TTT events ==========
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

    // ========== RPS events ==========
    socket.on('rps:join', ({ roomId }) => {
        let room = rpsRooms.get(roomId);
        if (!room) {
            room = {
                players: [], // [{id, role:'A'|'B'}]
                choices: {}, // id -> choice
                result: null, // 'A' | 'B' | 'Draw'
            };
            rpsRooms.set(roomId, room);
        }
        if (room.players.length >= 2) {
            socket.emit('rps:full');
            return;
        }
        const role = room.players.length === 0 ? 'A' : 'B';
        room.players.push({ id: socket.id, role });
        socket.join(roomId);
        socket.emit('rps:joined', {
            roomId,
            role,
            players: room.players.map((p) => ({ id: p.id, role: p.role })),
            choices: Object.keys(room.choices).length,
            result: room.result,
        });
        io.to(roomId).emit('rps:update', {
            players: room.players.map((p) => ({ id: p.id, role: p.role })),
            choices: Object.keys(room.choices).length,
            result: room.result,
        });
    });

    socket.on('rps:choose', ({ roomId, choice }) => {
        const room = rpsRooms.get(roomId);
        if (!room) return;
        if (!RPS_CHOICES.includes(choice)) return;
        room.choices[socket.id] = choice;
        if (room.players.length === 2 && Object.keys(room.choices).length === 2) {
            const a = room.players.find((p) => p.role === 'A')?.id;
            const b = room.players.find((p) => p.role === 'B')?.id;
            const outcome = rpsDecide(room.choices[a], room.choices[b]);
            room.result = outcome;
            io.to(roomId).emit('rps:reveal', {
                players: room.players.map((p) => ({ id: p.id, role: p.role })),
                choices: { [a]: room.choices[a], [b]: room.choices[b] },
                result: outcome,
            });
        } else {
            io.to(roomId).emit('rps:update', {
                players: room.players.map((p) => ({ id: p.id, role: p.role })),
                choices: Object.keys(room.choices).length,
                result: room.result,
            });
        }
    });

    socket.on('rps:reset', ({ roomId }) => {
        const room = rpsRooms.get(roomId);
        if (!room) return;
        room.choices = {};
        room.result = null;
        io.to(roomId).emit('rps:update', {
            players: room.players.map((p) => ({ id: p.id, role: p.role })),
            choices: 0,
            result: null,
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
        for (const [roomId, room] of rpsRooms.entries()) {
            const idx = room.players.findIndex((p) => p.id === socket.id);
            if (idx !== -1) {
                room.players.splice(idx, 1);
                delete room.choices[socket.id];
                io.to(roomId).emit('rps:update', {
                    players: room.players.map((p) => ({ id: p.id, role: p.role })),
                    choices: Object.keys(room.choices).length,
                    result: room.result,
                });
                if (room.players.length === 0) {
                    rpsRooms.delete(roomId);
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
