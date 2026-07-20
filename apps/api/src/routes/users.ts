import { Router } from "express";
import { prisma } from "../utils/prisma";
import bcrypt from "bcryptjs";

const router: Router = Router();

// GET all users
router.get("/", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: users });
  } catch (error) {
    console.error("Fetch users error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch users" });
  }
});

// POST create new user
router.post("/", async (req, res) => {
  try {
    const userRole = (req as any).user?.role;
    if (userRole !== "SUPERADMIN") {
      return res.status(403).json({ success: false, message: "Forbidden: SuperAdmin only" });
    }

    const { username, password, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Username and password are required" });
    }

    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        role: role || "ADMIN",
      },
      select: { id: true, username: true, role: true, createdAt: true },
    });

    res.json({ success: true, data: newUser });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({ success: false, message: "Failed to create user" });
  }
});

// PUT update user
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = (req as any).user;

    if (currentUser?.role !== "SUPERADMIN" && currentUser?.id !== id) {
      return res.status(403).json({ success: false, message: "Forbidden: You can only edit your own profile" });
    }

    const { username, password, role } = req.body;

    const dataToUpdate: any = {};
    if (username) dataToUpdate.username = username;
    if (role) dataToUpdate.role = role;
    if (password) dataToUpdate.password = await bcrypt.hash(password, 10);

    const updatedUser = await prisma.user.update({
      where: { id },
      data: dataToUpdate,
      select: { id: true, username: true, role: true, updatedAt: true },
    });

    res.json({ success: true, data: updatedUser });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ success: false, message: "Failed to update user" });
  }
});

// DELETE user
router.delete("/:id", async (req, res) => {
  try {
    const userRole = (req as any).user?.role;
    if (userRole !== "SUPERADMIN") {
      return res.status(403).json({ success: false, message: "Forbidden: SuperAdmin only" });
    }

    const { id } = req.params;
    await prisma.user.delete({ where: { id } });
    res.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ success: false, message: "Failed to delete user" });
  }
});

export { router as usersRouter };
