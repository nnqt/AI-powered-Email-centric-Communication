import http from "http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "4000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  const httpServer = http.createServer((req, res) => {
    handle(req, res);
  });

  // ── Socket.IO setup ──────────────────────────────────────────────────────
  const io = new SocketIOServer(httpServer, {
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
    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();

    pubClient.on("error", (err) =>
      console.error("[Socket] Redis pub error:", err),
    );
    subClient.on("error", (err) =>
      console.error("[Socket] Redis sub error:", err),
    );

    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    console.log("[Socket] Redis adapter connected:", redisUrl);
  } catch (err) {
    console.error(
      "[Socket] Redis adapter failed, falling back to in-memory:",
      err,
    );
  }

  // Make io accessible from Next.js API routes via global
  (global as any).__io = io;

  // ── Connection handling ───────────────────────────────────────────────────
  io.on("connection", (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // Client sends its userId to join a private room
    socket.on("join", (userId: string) => {
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
