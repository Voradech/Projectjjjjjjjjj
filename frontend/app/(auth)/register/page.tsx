"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, User, Mail, Lock, Eye, EyeOff } from "lucide-react";

type RegisterPayload = {
  username: string;
  email: string;
  password: string;
};

export default function Register() {
  const [form, setForm] = useState({
    username: "",
    password: "",
    email: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
 const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    //  basic validate
    if (
      !form.username ||
      !form.email ||
      !form.password ||
      !form.confirmPassword
    ) {
      setError("Please fill in all fields.");
      return;
    }
    //  compare password vs confirmPassword
    if (form.password !== form.confirmPassword) {
      setError("Password and confirm password do not match.");
      return;
    }

    // (optional) length check
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    try {
      setLoading(true);
      const res = await  fetch(
  `${process.env.NEXT_PUBLIC_API_URL}/auth/register`,
  {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            username: form.username,
            email: form.email,
            password: form.password,
          }),
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.message || "Register failed.");
        return;
      }

      //  success -> ไปหน้า login (หรือหน้าอื่นตามที่คุณใช้)
      router.push("/login");
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-[60vh] pt-24">
      <div className="bg-[#151e32] border border-[#1E293B] p-8 rounded-2xl shadow-2xl w-full max-w-md">
        <h1 className="text-2xl font-bold text-white text-center mb-6 flex justify-center items-center gap-2">
          <UserPlus className="text-accent " /> Create Account
        </h1>

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="relative">
            <User className="absolute left-3 top-4 text-gray-500" size={18} />
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full bg-[#0B1120] border border-[#1E293B] pl-10 p-3 rounded-lg text-white focus:border-accent outline-none"
              placeholder="Enter Username"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-4 text-gray-500" size={18} />
            <input
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full bg-[#0B1120] border border-[#1E293B] pl-10 p-3 rounded-lg text-white focus:border-accent outline-none"
              placeholder="Enter Password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-4 text-gray-400 hover:text-white"
            >
              {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-4 text-gray-500" size={18} />
            <input
              type={showConfirmPassword ? "text" : "password"}
              value={form.confirmPassword}
              onChange={(e) =>
                setForm({ ...form, confirmPassword: e.target.value })
              }
              className="w-full bg-[#0B1120] border border-[#1E293B] pl-10 p-3 rounded-lg text-white focus:border-accent outline-none"
              placeholder="Confirm Password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((v) => !v)}
              className="absolute right-3 top-4 text-gray-400 hover:text-white"
            >
              {showConfirmPassword ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          </div>

          <div className="relative">
            <Mail className="absolute left-3 top-4 text-gray-500" size={18} />
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full bg-[#0B1120] border border-[#1E293B] pl-10 p-3 rounded-lg text-white focus:border-accent outline-none"
              placeholder="Enter Email"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="pt-2">
            <button
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-3 rounded-lg disabled:opacity-60"
            >
              {loading ? "Signing up..." : "SIGN UP"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
