import { pool } from "../db/pool";

export const UserRepo = {
  findAll() {
    return pool.query(`
      SELECT id, email, username, role, created_at
      FROM users
      ORDER BY created_at DESC
    `);
  },

  updateRole(id: string, role: string) {
    return pool.query(
      `UPDATE users SET role=$1 WHERE id=$2`,
      [role, id]
    );
  },

  deleteById: async (id: string) => {
  const result = await pool.query(
    `DELETE FROM users WHERE id = $1`,
    [id]
  );
  return result.rowCount;
}
};
