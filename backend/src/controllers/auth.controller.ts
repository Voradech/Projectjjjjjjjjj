import { verifyAccessToken, AuthTokenPayload } from "../utils/jwt";
import jwt from "jsonwebtoken";

export const login = async (req: any, res: any) => {
  const userRepo = req.userRepo;
  const { username, password } = req.body;
  const token = req.cookies.accessToken;
  const payload: AuthTokenPayload = verifyAccessToken(token);

  const user = await userRepo.findByUsername(username);
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }


  res.json({
    id: payload.sub,
    email: payload.email,
    username: payload.username,
    role: payload.role,
  });

  res.json({
    message: "login success",
    role: user.role,
    username: user.username,
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
    return res.status(401).json({ message: "Invalid token" });
  }
};
