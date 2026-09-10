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

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    },
    process.env.JWT_ACCESS_SECRET!,
    { expiresIn: "1h" } // ✅ ให้ตรงกับ cookie
  );

  const cookieOptions = {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" as const : "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 1000, 
    ...(process.env.DOMAIN ? { domain: process.env.DOMAIN } : {}),
  };

  res.cookie("accessToken", token, cookieOptions);

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
    const cookieOptions = {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" as const : "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      ...(process.env.DOMAIN ? { domain: process.env.DOMAIN } : {}),
    };

    res.clearCookie("accessToken", cookieOptions);

    return res.status(401).json({ message: "Invalid token" });
  }
};
