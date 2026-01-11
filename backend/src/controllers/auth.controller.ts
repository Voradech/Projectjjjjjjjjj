import { signToken } from "../utils/jwt";

export const login = async (req: any, res: any) => {
  const userRepo = req.userRepo;
  const { username, password } = req.body;

  // ✅ ตรวจ user / password (ของเดิมคุณ)
  const user = await userRepo.findByUsername(username);
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // ✅ สร้าง token (ต้องมี role)
  const token = signToken({
    id: user.id,
    email: user.email,
    role: user.role, // 🔥 สำคัญ
  });

  // ✅ set cookie
  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false, // prod ค่อยเปลี่ยน true
  });

  res.json({
    message: "login success",
    role: user.role, // frontend ใช้ redirect
  });
};
