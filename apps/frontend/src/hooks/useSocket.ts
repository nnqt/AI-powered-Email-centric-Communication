"use client";

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

// Direct connection to backend – Next.js rewrites() cannot proxy WebSocket upgrades.
const SOCKET_URL =
  process.env.NEXT_PUBLIC_BACKEND_SOCKET_URL || "http://localhost:4000";

// Singleton socket – shared across all useSocket callers in the same session.
let _socket: Socket | null = null;

function getSocket(): Socket {
  if (!_socket) {
    _socket = io(SOCKET_URL, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      autoConnect: true,
    });

    _socket.on("connect_error", (err) => {
      console.warn("[Socket] connect_error:", err.message);
    });
  }
  return _socket;
}

export type SocketEventMap = Record<string, (payload: any) => void>;

/**
 * Subscribe to Socket.IO events for the given user.
 *
 * @param userId  MongoDB user._id string from session. Pass `undefined` to skip.
 * @param listeners  Map of { eventName: handler }. Handlers are stable via ref.
 */
export function useSocket(
  userId: string | undefined,
  listeners: SocketEventMap,
) {
  // Keep latest listener references without re-subscribing on every render.
  const listenersRef = useRef<SocketEventMap>(listeners);
  listenersRef.current = listeners;

  useEffect(() => {
    if (!userId) return;

    const sock = getSocket();

    // Join personal room so server can target `user:<userId>` emissions.
    const joinRoom = () => {
      sock.emit("join", userId);
    };

    if (sock.connected) {
      joinRoom();
    }
    sock.on("connect", joinRoom);

    // Register all event listeners via a stable wrapper.
    const wrappers: SocketEventMap = {};
    for (const event of Object.keys(listenersRef.current)) {
      wrappers[event] = (payload: any) => {
        listenersRef.current[event]?.(payload);
      };
      sock.on(event, wrappers[event]);
    }

    return () => {
      sock.off("connect", joinRoom);
      for (const [event, wrapper] of Object.entries(wrappers)) {
        sock.off(event, wrapper);
      }
    };
  }, [userId]); // Only re-run when userId changes
}
