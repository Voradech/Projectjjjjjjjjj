import bcrypt from "bcryptjs";
import { verifyAccessToken} from "../utils/jwt"; 
import jwt from "jsonwebtoken";

export const login = async (req: any, res: any) => {
  const userRepo = req.userRepo;
  const { username, password } = req.body;

  const user = await userRepo.findByUsername(username);

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  // ✅ ตรวจ password
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  // ✅ สร้าง JWT
  const token = jwt.sign(
    {
      sub: user.id,
      email: user.email,      
      username: user.username,
      role: user.role,
  },
  process.env.JWT_ACCESS_SECRET!,
  { expiresIn: "1d" }
);

  // ✅ set httpOnly cookie
  res.cookie("accessToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  return res.json({
    message: "Login success",
    role: user.role,
    username: user.username,
    email: user.email,

  });
};
export const me = async (req: any, res: any) => {
  const token = req.cookies.accessToken;

  if (!token) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  try {
    const payload = verifyAccessToken(token);

    return res.json({
      id: payload.sub,
      email: payload.email,
      username: payload.username,
      role: payload.role,
    });
  } catch {
    res.clearCookie("accessToken");
    return res.status(401).json({ message: "Invalid token" });
  }
};
