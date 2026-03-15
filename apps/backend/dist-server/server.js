"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const next_1 = __importDefault(require("next"));
const socket_io_1 = require("socket.io");
const redis_1 = require("redis");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "4000", 10);
const app = (0, next_1.default)({ dev, hostname, port });
const handle = app.getRequestHandler();
app.prepare().then(async () => {
    const httpServer = http_1.default.createServer((req, res) => {
        handle(req, res);
    });
    // ── Socket.IO setup ──────────────────────────────────────────────────────
    const io = new socket_io_1.Server(httpServer, {
        path: "/socket.io",
        cors: {
            origin: process.env.FRONTEND_URL || "http://localhost:3000",
            methods: ["GET", "POST"],
            credentials: true,
        },
        transports: ["websocket", "polling"],
    });
    // Redis adapter – enables multi-instance broadcasting via Redis pub/sub
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    try {
        const pubClient = (0, redis_1.createClient)({ url: redisUrl });
        const subClient = pubClient.duplicate();
        pubClient.on("error", (err) => console.error("[Socket] Redis pub error:", err));
        subClient.on("error", (err) => console.error("[Socket] Redis sub error:", err));
        await Promise.all([pubClient.connect(), subClient.connect()]);
        io.adapter((0, redis_adapter_1.createAdapter)(pubClient, subClient));
        console.log("[Socket] Redis adapter connected:", redisUrl);
    }
    catch (err) {
        console.error("[Socket] Redis adapter failed, falling back to in-memory:", err);
    }
    // Make io accessible from Next.js API routes via global
    global.__io = io;
    // ── Connection handling ───────────────────────────────────────────────────
    io.on("connection", (socket) => {
        console.log(`[Socket] Connected: ${socket.id}`);
        // Client sends its userId to join a private room
        socket.on("join", (userId) => {
            if (typeof userId === "string" && userId.length > 0) {
                socket.join(`user:${userId}`);
                console.log(`[Socket] ${socket.id} joined room user:${userId}`);
            }
        });
        socket.on("disconnect", (reason) => {
            console.log(`[Socket] Disconnected: ${socket.id} (${reason})`);
        });
    });
    // ── Start server ──────────────────────────────────────────────────────────
    httpServer.listen(port, hostname, () => {
        console.log(`> Backend ready on http://${hostname}:${port}`);
    });
});
