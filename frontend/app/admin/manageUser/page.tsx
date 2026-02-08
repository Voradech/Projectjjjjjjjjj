"use client";
import { useEffect, useState } from "react";

type User = {
  id: string;
  email: string;
  username: string;
  role: string;
};

export default function ManageUser() {
  const [users, setUsers] = useState<User[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [action, setAction] = useState<"delete" | "role" | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newRole, setNewRole] = useState<string>("user");

  useEffect(() => {
    
    fetch("http://localhost:8000/api/admin/users", {
      credentials: "include", 
    })
      .then((res) => {
        if (res.status === 401 || res.status === 403) {
          window.location.href = "/login";
          return;
        }
        return res.json();
      })
      .then(setUsers)
      .catch(console.error);
  }, []);

  const openConfirmRole = (user: User, role: string) => {
    setSelectedUser(user);
    setNewRole(role);
    setAction("role");
    setConfirmOpen(true);
  };

  const openConfirmDelete = (user: User) => {
    setSelectedUser(user);
    setAction("delete");
    setConfirmOpen(true);
    
  };

  const handleConfirm = async () => {
    if (!selectedUser || !action) return;

    if (action === "role") {
      await fetch(`http://localhost:8000/api/admin/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // ✅
        body: JSON.stringify({ role: newRole }),
      });

      setUsers((prev) =>
        prev.map((u) =>
          u.id === selectedUser.id ? { ...u, role: newRole } : u
        )
      );
    }

    if (action === "delete") {
      await fetch(`http://localhost:8000/api/admin/users/${selectedUser.id}`, {
        method: "DELETE",
        credentials: "include", // ✅
      });

      setUsers((prev) => prev.filter((u) => u.id !== selectedUser.id));
    }

    setConfirmOpen(false);
    setSelectedUser(null);
    setAction(null);
    
  };

  return (
    <div className="min-h-screen bg-slate-900 p-8 text-white">
      <h1 className="text-3xl font-bold mb-6">👥 Manage Users</h1>

      <div className="overflow-x-auto rounded-xl shadow-lg">
        <table className="w-full bg-slate-800 rounded-xl">
          <thead className="bg-slate-700">
            <tr>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Username</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                className="border-t border-slate-700 hover:bg-slate-700/50"
              >
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">{u.username}</td>
                <td className="px-4 py-3">
                  <select
                    defaultValue={u.role}
                    onChange={(e) =>
                      openConfirmRole(u, e.target.value)
                    }
                    className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-1 text-white"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => openConfirmDelete(u)}
                    className="bg-red-600 hover:bg-red-700 px-4 py-1 rounded-lg text-sm"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-[360px] shadow-xl">
            <h2 className="text-xl font-semibold mb-4">
              ยืนยันการทำรายการ
            </h2>

            <p className="text-slate-300 mb-6">
              {action === "delete"
                ? `คุณต้องการลบผู้ใช้ ${selectedUser?.email} ใช่หรือไม่`
                : `คุณต้องการเปลี่ยน role เป็น "${newRole}" ใช่หรือไม่`}
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-500"
              >
                ยกเลิก
              </button>

              <button
                onClick={handleConfirm}
                className="px-4 py-2 rounded-lg bg-emerald-400 hover:bg-emerald-500 text-slate-900 font-semibold"
              >
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
