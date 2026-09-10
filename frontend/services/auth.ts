const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function login(username: string, password: string) {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error("Login failed");
  return res.json() as Promise<{ accessToken: string }>;
}

export async function me(accessToken: string) {
  const res = await fetch(`${API}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: "include",

  });
  if (!res.ok) throw new Error("Unauthorized");
  return res.json() as Promise<{ id: string; email: string }>;
}

export async function refresh() {
  const res = await fetch(`${API}/auth/refresh`, {
    method: "POST",
    credentials: "include",
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

export async function registerUser(payload: {
  username: string;
  email: string;
  password: string;
}) {
  const res = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.message || "Register failed");
  }

  return data;
}
