import { Router } from "express";
import { authRequired } from "../middlewares/authRequired";
import { createAlert } from "../controllers/alert.controller";
import { getMyNotifications } from "../controllers/alert.controller";
import { getMyAlerts } from "../controllers/alert.controller";
const router = Router();

router.post("/", authRequired, createAlert);
router.get("/", authRequired, getMyAlerts);
router.get("/notifications", authRequired, getMyNotifications);

export default router;