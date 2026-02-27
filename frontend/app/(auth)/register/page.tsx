"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  UserPlus,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
} from "lucide-react";

export default function Register() {
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  // Toggle Password Visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status States
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // 1. Basic Validation
    if (
      !form.username.trim() ||
      !form.email.trim() ||
      !form.password ||
      !form.confirmPassword
    ) {
      setError("Please fill in all fields.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Password and confirm password do not match.");
      return;
    }

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      // ใช้ URL pattern เดียวกับหน้า Login (ปรับ port/path ตามจริงได้เลย)
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true", },
        credentials: "include",
        body: JSON.stringify({
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.message || "Registration failed.");
        setLoading(false);
        return;
      }

      // Success
      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 1500); // รอ animation จบแล้วค่อยเปลี่ยนหน้า
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // --- 3D Tilt Effect Logic (เหมือนหน้า Login) ---
  const handleMouseMove = (e: any) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    cardRef.current.style.transform = `rotateX(${-y / 30}deg) rotateY(${
      x / 30
    }deg)`;
  };

  const handleMouseLeave = () => {
    if (!cardRef.current) return;
    cardRef.current.style.transform = "rotateX(0deg) rotateY(0deg)";
  };

  return (
    <div className="relative min-h-screen flex justify-center items-center overflow-hidden bg-[#020617]">
      {/* Dynamic Background Glow */}
      <div className="absolute w-[600px] h-[600px] bg-indigo-500/20 blur-3xl rounded-full animate-pulse -top-20 -right-10" />
      <div className="absolute w-[500px] h-[500px] bg-emerald-500/20 blur-3xl rounded-full animate-pulse bottom-0 left-0" />

      {/* Success Overlay */}
      {success && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-xl z-50 transition animate-in fade-in duration-300">
          <div className="text-center text-white scale-110">
            <CheckCircle2 size={80} className="mx-auto text-emerald-400 mb-4 animate-bounce" />
            <p className="text-2xl font-bold">Registration Successful!</p>
            <p className="text-gray-400 text-sm mt-2">Redirecting to login...</p>
          </div>
        </div>
      )}
 
      {/* Register Card */}
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="bg-white/[0.06] backdrop-blur-2xl border border-white/10 p-8 rounded-2xl shadow-2xl w-full max-w-md transition-transform duration-200"
      >
        <h1 className="text-3xl font-bold text-white text-center mb-6 flex justify-center items-center gap-2">
          <UserPlus size={32} /> Create Account
        </h1>

        <form onSubmit={handleRegister} className="space-y-4">
          {/* Username */}
          <div className="relative group">
            <User
              className="absolute left-3 top-4 text-gray-500 group-focus-within:text-emerald-400 transition"
              size={18}
            />
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full bg-[#0B1120] border border-white/10 pl-10 p-3 rounded-lg text-white focus:border-emerald-400 outline-none transition placeholder:text-gray-600"
              placeholder="Username"
            />
          </div>

          {/* Email */}
          <div className="relative group">
            <Mail
              className="absolute left-3 top-4 text-gray-500 group-focus-within:text-emerald-400 transition"
              size={18}
            />
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full bg-[#0B1120] border border-white/10 pl-10 p-3 rounded-lg text-white focus:border-emerald-400 outline-none transition placeholder:text-gray-600"
              placeholder="Email Address"
            />
          </div>

          {/* Password */}
          <div className="relative group">
            <Lock
              className="absolute left-3 top-4 text-gray-500 group-focus-within:text-emerald-400 transition"
              size={18}
            />
            <input
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full bg-[#0B1120] border border-white/10 pl-10 p-3 pr-10 rounded-lg text-white focus:border-emerald-400 outline-none transition placeholder:text-gray-600"
              placeholder="Password (min 8 chars)"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-4 text-gray-500 hover:text-white transition"
            >
              {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          </div>

          {/* Confirm Password */}
          <div className="relative group">
            <Lock
              className="absolute left-3 top-4 text-gray-500 group-focus-within:text-emerald-400 transition"
              size={18}
            />
            <input
              type={showConfirmPassword ? "text" : "password"}
              value={form.confirmPassword}
              onChange={(e) =>
                setForm({ ...form, confirmPassword: e.target.value })
              }
              className="w-full bg-[#0B1120] border border-white/10 pl-10 p-3 pr-10 rounded-lg text-white focus:border-emerald-400 outline-none transition placeholder:text-gray-600"
              placeholder="Confirm Password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-4 text-gray-500 hover:text-white transition"
            >
              {showConfirmPassword ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          </div>

          {/* Error Message */}
          {error && <p className="text-red-400 text-center text-sm animate-pulse">{error}</p>}

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-emerald-400 hover:bg-emerald-300 text-[#020617] font-bold py-3 rounded-lg transition-all flex justify-center items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed transform hover:scale-[1.02]"
            disabled={loading}
          >
            {loading && <Loader2 className="animate-spin" size={18} />}
            {loading ? "Creating Account..." : "SIGN UP"}
          </button>
        </form>

        <p className="mt-6 text-center text-gray-300 text-sm">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-emerald-400 font-semibold hover:underline"
          >
            Log In
          </Link>
        </p>
      </div>
    </div>
  );
}