import type { Server } from "socket.io";
import type { ServerToClientEvents, ClientToServerEvents } from "@event-platform/types";

export function setupSocketHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>
) {
  io.on("connection", (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // Join event room for real-time updates
    socket.on("checkin:subscribe", (eventId: string) => {
      socket.join(`event:${eventId}`);
      console.log(`[Socket] ${socket.id} joined checkin room: event:${eventId}`);
    });

    socket.on("draw:subscribe", (eventId: string) => {
      socket.join(`event:${eventId}`);
      console.log(`[Socket] ${socket.id} joined draw room: event:${eventId}`);
    });

    socket.on("disconnect", (reason) => {
      console.log(`[Socket] Disconnected: ${socket.id} (${reason})`);
    });
  });

  console.log("[Socket] Handlers initialized");
}
