const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const updateGlobalAlert = async (enabled: boolean) => {
  const res = await fetch(
    `${API}/api/admin/system-alert`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ enabled }),
    }
  );

  if (!res.ok) throw new Error("Update failed");
  return res.json();
};

export const getSystemAlertStatus = async () => {
  const res = await fetch(`${API}/api/admin/system-alert`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Fetch failed");
  return res.json();
};
