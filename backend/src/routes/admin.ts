import { Router } from "express";
import { authRequired } from "../middlewares/authRequired";
import { requireRole } from "../middlewares/requireRole";
import {
  getUsers,
  updateUser,
  deleteUser
} from "../controllers/adminUser.controller";

const router = Router();

router.get("/users", getUsers);
router.patch("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);

export default router;
