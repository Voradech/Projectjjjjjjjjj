"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, User, LogIn, Loader2, CheckCircle2 } from "lucide-react";

export default function Login() {
  const [form, setForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);

const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();

  if (!form.username.trim() || !form.password.trim()) {
    setError("กรุณากรอก Username และ Password");
    return;
  }

  setError(null);
  setLoading(true);

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: form.username,
        password: form.password,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "เข้าสู่ระบบไม่สำเร็จ");
      setLoading(false);
      return;
    }

    // บันทึก session ลง browser
    localStorage.setItem("user", JSON.stringify(data));

    setSuccess(true);

    // ไปหน้า Home
    setTimeout(() => {
      router.push("/");
    }, 1200);
  } catch (err) {
    setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
  } finally {
    setLoading(false);
  }
};
  // 3D Card Effect
  const handleMouseMove = (e: any) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    cardRef.current.style.transform = `rotateX(${-y / 30}deg) rotateY(${x / 30}deg)`;
  };

  const handleMouseLeave = () => {
    if (!cardRef.current) return;
    cardRef.current.style.transform = "rotateX(0deg) rotateY(0deg)";
  };

  return (
    <div className="relative min-h-screen flex justify-center items-center overflow-hidden bg-[#020617]">

      {/* Dynamic Background Glow */}
      <div className="absolute w-[600px] h-[600px] bg-emerald-500/20 blur-3xl rounded-full animate-pulse -top-20 -left-10" />
      <div className="absolute w-[500px] h-[500px] bg-indigo-500/20 blur-3xl rounded-full animate-pulse bottom-0 right-0" />

      {/* Success Overlay */}
      {success && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-xl z-50 transition">
          <div className="text-center text-white">
            <CheckCircle2 size={70} className="mx-auto text-emerald-400 mb-4" />
            <p className="text-xl font-bold">เข้าสู่ระบบสำเร็จ</p>
          </div>
        </div>
      )}

      {/* Login Card */}
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="bg-white/[0.06] backdrop-blur-2xl border border-white/10 p-8 rounded-2xl shadow-2xl w-full max-w-md transition-transform duration-200"
      >
        <h1 className="text-3xl font-bold text-white text-center mb-6 flex justify-center items-center gap-2">
          <LogIn /> Member Login
        </h1>

        <form onSubmit={handleLogin} className="space-y-4">

          {/* Username */}
          <div className="relative group">
            <User className="absolute left-3 top-4 text-gray-500 group-focus-within:text-emerald-400 transition" size={18} />
            <input
              type="text"
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full bg-[#0B1120] border border-white/10 pl-10 p-3 rounded-lg text-white focus:border-emerald-400 outline-none transition"
              placeholder="Username"
            />
          </div>

          {/* Password */}
          <div className="relative group">
            <Lock className="absolute left-3 top-4 text-gray-500 group-focus-within:text-emerald-400 transition" size={18} />
            <input
              type="password"
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full bg-[#0B1120] border border-white/10 pl-10 p-3 rounded-lg text-white focus:border-emerald-400 outline-none transition"
              placeholder="Password"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-red-400 text-center text-sm">{error}</p>
          )}

          {/* Login Button */}
          <button
            className="w-full bg-emerald-400 hover:bg-emerald-300 text-[#020617] font-bold py-3 rounded-lg transition-all flex justify-center items-center gap-2 disabled:opacity-60"
            disabled={loading}
          >
            {loading && <Loader2 className="animate-spin" size={18} />}
            {loading ? "กำลังเข้าสู่ระบบ..." : "LOG IN"}
          </button>
        </form>

        <p className="mt-6 text-center text-gray-300 text-sm">
          New here?{" "}
          <Link href="/register" className="text-emerald-400 font-semibold hover:underline">
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
}
