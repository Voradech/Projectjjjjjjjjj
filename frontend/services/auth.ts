const API = "http://localhost:8000";

export async function login(email: string, password: string) {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include", // สำคัญ: ให้รับ cookie refresh
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("Login failed");
  return res.json() as Promise<{ accessToken: string }>;
}

export async function me(accessToken: string) {
  const res = await fetch(`${API}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Unauthorized");
  return res.json() as Promise<{ id: string; email: string }>;
}

export async function refresh() {
  const res = await fetch(`${API}/auth/refresh`, {
    method: "POST",
    credentials: "include", // ส่ง cookie refresh ไปให้ backend
  });
  if (!res.ok) throw new Error("Refresh failed");
  return res.json() as Promise<{ accessToken: string }>;
}

export async function logout() {
  await fetch(`${API}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
}
