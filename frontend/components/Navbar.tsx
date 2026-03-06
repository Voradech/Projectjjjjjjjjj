"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LogOut,
  UserCircle,
  LogIn,
  Menu,
  X,
} from "lucide-react";

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function Navbar() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/auth/me`, {
      headers: {
        "ngrok-skip-browser-warning": "true",
      },
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error("not logged in");
        return res.json();
      })
      .then((data) => setUser(data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });

    setUser(null);
    router.push("/login");
  };

  if (loading) return null;

  return (
    <nav className="fixed top-0 w-full z-50 bg-[#020617] border-b border-navy-700 px-6 py-4 shadow-lg shadow-black/20">

      <div className="flex justify-between items-center">

        {/* Logo */}
        <Link href="/" className="text-xl font-bold tracking-widest text-white">
          Predict<span className="text-accent">Bitcoin</span>
        </Link>

        {/* Desktop Menu */}
        <div className="hidden md:flex gap-4">
          <Link href="/" className="nav-btn">Home</Link>
          <Link href="/predictView" className="nav-btn">Predict</Link>
          <Link href="/news" className="nav-btn">News</Link>
          <Link href="/alerts" className="nav-btn">Alert</Link>
        </div>

        {/* Desktop Auth */}
        <div className="hidden md:flex items-center gap-4">

          {user ? (
            <button
              onClick={handleLogout}
              className="text-red-400 hover:text-red-300 flex items-center gap-1"
            >
              <LogOut size={16} /> Logout
            </button>
          ) : (
            <>
              <Link href="/login" className="nav-btn flex items-center gap-2">
                <LogIn size={16} /> Login
              </Link>

              <Link href="/register" className="nav-btn">
                Sign Up
              </Link>
            </>
          )}

        </div>

        {/* Mobile Button */}
        <button
          className="md:hidden text-white"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={26} /> : <Menu size={26} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden flex flex-col gap-3 mt-4">

          <Link href="/" className="mobile-btn">Home</Link>
          <Link href="/predictView" className="mobile-btn">Predict</Link>
          <Link href="/news" className="mobile-btn">News</Link>
          <Link href="/alerts" className="mobile-btn">Alert</Link>

          <div className="border-t border-gray-700 pt-3">

            {user ? (
              <button
                onClick={handleLogout}
                className="text-red-400 flex items-center gap-2"
              >
                <LogOut size={16} /> Logout
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <Link href="/login" className="mobile-btn">Login</Link>
                <Link href="/register" className="mobile-btn">Sign Up</Link>
              </div>
            )}

          </div>

        </div>
      )}
    </nav>
  );
}