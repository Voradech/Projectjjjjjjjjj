"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRepo = void 0;
const pool_1 = require("../db/pool");
exports.UserRepo = {
    findAll() {
        return pool_1.pool.query(`
      SELECT id, email, username, role, created_at
      FROM users
      ORDER BY created_at DESC
    `);
    },
    updateRole(id, role) {
        return pool_1.pool.query(`UPDATE users SET role=$1 WHERE id=$2`, [role, id]);
    },
    deleteById: async (id) => {
        const result = await pool_1.pool.query(`DELETE FROM users WHERE id = $1`, [id]);
        return result.rowCount;
    }
};
