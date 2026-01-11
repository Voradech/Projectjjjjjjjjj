import { Request, Response } from "express";
import { UserRepo } from "../repositories/user.repo";


export const getUsers = async (_: Request, res: Response) => {
  const { rows } = await UserRepo.findAll();
  res.json(rows);
};

export const updateUser = async (req: Request, res: Response) => {
  const { role } = req.body;
  await UserRepo.updateRole(req.params.id, role);
  res.json({ message: "User updated" });
};

export const deleteUser = async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (req.user.id === req.params.id) {
    return res.status(400).json({ message: "Cannot delete yourself" });
  }

  await UserRepo.deleteById(req.params.id);
  res.json({ message: "User deleted" });
};
