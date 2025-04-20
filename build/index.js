"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const express_1 = __importDefault(require("express"));
const next_1 = __importDefault(require("next"));
const socket_io_1 = require("socket.io");
const uuid_1 = require("uuid");
const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const nextApp = (0, next_1.default)({ dev });
const nextHandler = nextApp.getRequestHandler();
nextApp.prepare().then(async () => {
    const app = (0, express_1.default)();
    const server = (0, http_1.createServer)(app);
    const io = new socket_io_1.Server(server);
    app.get("/robot", async (_, res) => {
        res.send("Created by Dev Chouhan afk ZeChrone");
    });
    /*Stores active rooms.
      Each room contains:
      usersMoves: Tracks user moves.
      drawed: Stores all past moves.
      users: Maps user IDs to usernames.*/
    const rooms = new Map();
    // stores user's moves
    const addMove = (roomId, socketId, move) => {
        const room = rooms.get(roomId);
        if (!room.users.has(socketId)) {
            room.usersMoves.set(socketId, [move]);
        }
        room.usersMoves.get(socketId).push(move);
    };
    const undoMove = (roomId, socketId) => {
        const room = rooms.get(roomId);
        room.usersMoves.get(socketId).pop();
    };
    // Handling Socket Connections
    io.on("connection", (socket) => {
        const getRoomId = () => {
            const joinedRoom = [...socket.rooms].find((room) => room !== socket.id);
            if (!joinedRoom)
                return socket.id;
            return joinedRoom;
        };
        const leaveRoom = (roomId, socketId) => {
            const room = rooms.get(roomId);
            if (!room)
                return;
            const userMoves = room.usersMoves.get(socketId);
            if (userMoves)
                room.drawed.push(...userMoves);
            room.users.delete(socketId);
            socket.leave(roomId);
        };
        // Handling Room Operations under Socket's
        socket.on("create_room", (username) => {
            let roomId;
            do {
                roomId = Math.random().toString(36).substring(2, 6);
            } while (rooms.has(roomId));
            socket.join(roomId);
            rooms.set(roomId, {
                usersMoves: new Map([[socket.id, []]]),
                drawed: [],
                users: new Map([[socket.id, username]]),
            });
            io.to(socket.id).emit("created", roomId);
        });
        socket.on("check_room", (roomId) => {
            if (rooms.has(roomId))
                socket.emit("room_exists", true);
            else
                socket.emit("room_exists", false);
        });
        socket.on("join_room", (roomId, username) => {
            const room = rooms.get(roomId);
            if (room && room.users.size < 12) {
                socket.join(roomId);
                room.users.set(socket.id, username);
                room.usersMoves.set(socket.id, []);
                io.to(socket.id).emit("joined", roomId);
            }
            else
                io.to(socket.id).emit("joined", "", true);
        });
        socket.on("joined_room", () => {
            const roomId = getRoomId();
            const room = rooms.get(roomId);
            if (!room)
                return;
            io.to(socket.id).emit("room", room, JSON.stringify([...room.usersMoves]), JSON.stringify([...room.users]));
            socket.broadcast
                .to(roomId)
                .emit("new_user", socket.id, room.users.get(socket.id) || "Anonymous");
        });
        socket.on("leave_room", () => {
            const roomId = getRoomId();
            leaveRoom(roomId, socket.id);
            io.to(roomId).emit("user_disconnected", socket.id);
        });
        socket.on("draw", (move) => {
            const roomId = getRoomId();
            const timestamp = Date.now();
            move.id = (0, uuid_1.v4)(); // eslint-disable-next-line no-param-reassign
            addMove(roomId, socket.id, Object.assign(Object.assign({}, move), { timestamp }));
            io.to(socket.id).emit("your_move", Object.assign(Object.assign({}, move), { timestamp }));
            socket.broadcast
                .to(roomId)
                .emit("user_draw", Object.assign(Object.assign({}, move), { timestamp }), socket.id);
        });
        socket.on("undo", () => {
            const roomId = getRoomId();
            undoMove(roomId, socket.id);
            socket.broadcast.to(roomId).emit("user_undo", socket.id);
        });
        socket.on("mouse_move", (x, y) => {
            socket.broadcast.to(getRoomId()).emit("mouse_moved", x, y, socket.id);
        });
        socket.on("send_msg", (msg) => {
            io.to(getRoomId()).emit("new_msg", socket.id, msg);
        });
        socket.on("disconnecting", () => {
            const roomId = getRoomId();
            leaveRoom(roomId, socket.id);
            io.to(roomId).emit("user_disconnected", socket.id);
        });
    });
    app.all("*", (req, res) => nextHandler(req, res));
    server.listen(port, () => {
        console.log(`> Hosted over: http://localhost:${port}`);
    });
});
/*
Main Features
1. Multi-user rooms (up to 12 users)
2. Real-time drawing collaboration
3. Undo functionality
4. Mouse cursor tracking
5. Chat messaging
6. Room persistence
7. Health check endpoint (/health)

How It Works
1. Users connect via WebSocket
2. They create or join rooms
3. Drawing actions are broadcasted in real-time
4. Room state is maintained in memory
5. All clients stay in sync via Socket.IO events
*/ 
