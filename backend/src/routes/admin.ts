import { Router } from "express";
import { authRequired } from "../middlewares/authRequired";
import { requireRole } from "../middlewares/requireRole";

import {
  getUsers,
  updateUser,
  deleteUser
} from "../controllers/adminUser.controller";

import {
  getSystemAlertStatus,
  updateSystemAlertStatus,
} from "../controllers/system.controller";

const router = Router();

// 🔐 Protect all admin routes
router.get(
  "/users",
  authRequired,
  requireRole("admin"),
  getUsers
);

router.patch(
  "/users/:id",
  authRequired,
  requireRole("admin"),
  updateUser
);

router.delete(
  "/users/:id",
  authRequired,
  requireRole("admin"),
  deleteUser
);

// 🔔 Global Alert Toggle
router.get(
  "/system-alert",
  authRequired,
  requireRole("admin"),
  getSystemAlertStatus
);

router.patch(
  "/system-alert",
  authRequired,
  requireRole("admin"),
  updateSystemAlertStatus
);

export default router;