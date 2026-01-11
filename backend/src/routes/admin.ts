import { Router } from "express";
import { authRequired } from "../middlewares/authRequired";
import { requireRole } from "../middlewares/requireRole";
import {
  getUsers,
  updateUser,
  deleteUser
} from "../controllers/adminUser.controller";

const router = Router();

router.get(
  "/stats",
  authRequired,
  requireRole("admin"),
  (req, res) => {
    res.json({ message: "Admin only data" });
  }
);


router.use(authRequired, requireRole("admin"));

router.get("/users", getUsers);
router.patch("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);

export default router;
