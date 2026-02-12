// services/alert.ts
export const updateGlobalAlert = async (enabled: boolean) => {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/alerts/global`,
    {
      method: "PUT",
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
