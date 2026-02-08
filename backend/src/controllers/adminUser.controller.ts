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
  const count = await UserRepo.deleteById(req.params.id);

  if (count === 0) {
    return res.status(404).json({ message: "User not found" });
  }

  res.json({ success: true });
};
