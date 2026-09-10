"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authRequired_1 = require("../middlewares/authRequired");
const requireRole_1 = require("../middlewares/requireRole");
const adminUser_controller_1 = require("../controllers/adminUser.controller");
const system_controller_1 = require("../controllers/system.controller");
const router = (0, express_1.Router)();
// 🔐 Protect all admin routes
router.get("/users", authRequired_1.authRequired, (0, requireRole_1.requireRole)("admin"), adminUser_controller_1.getUsers);
router.patch("/users/:id", authRequired_1.authRequired, (0, requireRole_1.requireRole)("admin"), adminUser_controller_1.updateUser);
router.delete("/users/:id", authRequired_1.authRequired, (0, requireRole_1.requireRole)("admin"), adminUser_controller_1.deleteUser);
// 🔔 Global Alert Toggle
router.get("/system-alert", authRequired_1.authRequired, (0, requireRole_1.requireRole)("admin"), system_controller_1.getSystemAlertStatus);
router.patch("/system-alert", authRequired_1.authRequired, (0, requireRole_1.requireRole)("admin"), system_controller_1.updateSystemAlertStatus);
exports.default = router;
