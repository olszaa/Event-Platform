import "dotenv/config";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import { eventsRouter } from "./routes/events";
import { registrationsRouter } from "./routes/registrations";
import { checkinsRouter } from "./routes/checkins";
import { prizesRouter } from "./routes/prizes";
import { drawsRouter } from "./routes/draws";
import { auditRouter } from "./routes/audit";
import { notificationsRouter } from "./routes/notifications";
import { authRouter } from "./routes/auth";
import { usersRouter } from "./routes/users";
import { errorHandler } from "./middleware/errorHandler";
import { verifyToken } from "./middleware/auth";
import { setupSocketHandlers } from "./socket";
import type { ServerToClientEvents, ClientToServerEvents } from "@event-platform/types";
import { prisma } from "./utils/prisma";
import bcrypt from "bcryptjs";

const app = express();
const server = createServer(app);

// Socket.io setup with typed events
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: process.env.CORS_ORIGIN === "strict" ? process.env.CORS_ORIGIN?.split(",") : "*",
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN === "strict" ? process.env.CORS_ORIGIN?.split(",") : "*",
}));
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Make io accessible in routes
app.set("io", io);

// Routes
app.use("/api/auth", authRouter);
app.use("/api/users", verifyToken, usersRouter);
app.use("/api/events", eventsRouter);
app.use("/api/registrations", registrationsRouter);
app.use("/api/checkin", checkinsRouter);
app.use("/api/prizes", prizesRouter);
app.use("/api/draws", drawsRouter);
app.use("/api/audit", verifyToken, auditRouter);
app.use("/api/notifications", notificationsRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

async function seedSuperAdmin() {
  try {
    const username = process.env.SUPERADMIN_USERNAME || "admin";
    const password = process.env.SUPERADMIN_PASSWORD || "password123";

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.upsert({
      where: { username },
      update: { role: "SUPERADMIN" },
      create: {
        username,
        password: hashedPassword,
        role: "SUPERADMIN",
      },
    });
    console.log(`✅ SuperAdmin user '${username}' seeded/verified automatically.`);
  } catch (error) {
    console.error("Failed to seed SuperAdmin:", error);
  }
}

seedSuperAdmin();

// Error handler
app.use(errorHandler);

// Socket.io handlers
setupSocketHandlers(io);

// Start server
const PORT = process.env.PORT || process.env.API_PORT || 4000;
server.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║  🎉 Event Platform API Server       ║
  ║  Running on port ${PORT}               ║
  ║  Environment: ${process.env.NODE_ENV || "development"}        ║
  ╚══════════════════════════════════════╝
  `);
});

export { io };
