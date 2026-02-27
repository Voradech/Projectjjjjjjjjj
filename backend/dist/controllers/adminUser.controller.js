"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.updateUser = exports.getUsers = void 0;
const user_repo_1 = require("../repositories/user.repo");
const getUsers = async (_, res) => {
    const { rows } = await user_repo_1.UserRepo.findAll();
    res.json(rows);
};
exports.getUsers = getUsers;
const updateUser = async (req, res) => {
    const { role } = req.body;
    await user_repo_1.UserRepo.updateRole(req.params.id, role);
    res.json({ message: "User updated" });
};
exports.updateUser = updateUser;
const deleteUser = async (req, res) => {
    const count = await user_repo_1.UserRepo.deleteById(req.params.id);
    if (count === 0) {
        return res.status(404).json({ message: "User not found" });
    }
    res.json({ success: true });
};
exports.deleteUser = deleteUser;
