import type { Server as SocketIOServer } from "socket.io";

/**
 * Returns the Socket.IO server instance stored on `global.__io`.
 * Only available after the custom server has initialized it.
 */
export function getIO(): SocketIOServer | null {
  return (global as any).__io ?? null;
}

/**
 * Emit a Socket.IO event to all sockets in the room `user:<userId>`.
 * Silently skips if the IO server has not been initialized yet
 * (e.g. during Next.js build-time route collection).
 */
export function emitToUser(
  userId: string,
  event: string,
  payload?: unknown,
): void {
  const io = getIO();
  if (!io) {
    // Not a fatal error – can happen during cold-start or standalone dev.
    console.warn(
      `[Socket] io not ready – skipping emit "${event}" to user:${userId}`,
    );
    return;
  }
  io.to(`user:${userId}`).emit(event, payload ?? {});
}
