"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LogOut,
  UserCircle,
  LogIn,
} from "lucide-react";
interface User {
  id: string;
  username: string;
  email: string;
  role: string;
}
export default function Navbar() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
      headers: {
        "ngrok-skip-browser-warning": "true",
      },
      credentials: "include", 
    })
      .then((res) => {
        if (!res.ok) throw new Error("not logged in");
        return res.json();
      })
      .then((data) => {
        setUser(data);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleLogout = async () => {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, {
      headers: { "ngrok-skip-browser-warning": "true", },
      method: "POST",
      credentials: "include",
    });

    setUser(null);
    router.push("/login");
  };

  if (loading) return null; 


  return (
    <nav className="fixed top-0 w-full z-50 bg-[#020617] backdrop-blur-md border-b border-navy-700 px-6 py-5 flex justify-between items-center shadow-lg shadow-black/20">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 cursor-pointer group">
        {/* <div className="w-2 h-2 bg-accent rounded-full animate-pulse shadow-[0_0_10px_#10B981] group-hover:scale-150 transition-transform"></div> */}
        <h1 className="text-xl font-bold tracking-widest text-white group-hover:text-accent transition-colors">
          Predict
          <span className="text-accent group-hover:text-white transition-colors">
            Bitcoin
          </span>
        </h1>
      </Link>
      <div>
        <Link
          href="/"
          className="bg-accent text-white px-4 py-2 rounded-lg font-bold hover:bg-emerald-400 transition-all shadow-lg shadow-accent/20"
        >
          {" "}
          Home
        </Link>
        <Link
          href="/predictView"
          className="bg-accent text-white px-4 py-2 rounded-lg font-bold hover:bg-emerald-400 transition-all shadow-lg shadow-accent/20"
        >
          Predict
        </Link>
        <Link
          href="/news"
          className="bg-accent text-white px-4 py-2 rounded-lg font-bold hover:bg-emerald-400 transition-all shadow-lg shadow-accent/20"
        >
          News
        </Link>
        <Link
          href="/alerts"
          className="bg-accent text-white px-4 py-2 rounded-lg font-bold hover:bg-emerald-400 transition-all shadow-lg shadow-accent/20"
        >
          Alert
        </Link>
      </div>
      {/* Menu & Auth */}
      <div className="flex gap-6 text-sm font-medium text-gray-400 items-center">
        {/* Auth Section */}
        <div className="h-6 w-px bg-navy-700 mx-2"></div>

        {user ? (
          <div className="flex items-center gap-4">
            <span className="text-gray-200 flex items-center gap-2 bg-[151e32] px-3 py-1 rounded-full border border[#1E293B]">
              <UserCircle size={16} className="text-accent" /> {user.username}
            </span>
            <button
              onClick={handleLogout}
              className="text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors"
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="bg-accent text-navy-950 px-4 py-2 rounded-lg font-bold hover:bg-emerald-400 transition-all shadow-lg shadow-accent/20 flex items-center gap-2"
            >
              <LogIn size={16} /> Login
            </Link>
            <Link
              href="/register"
              className="bg-accent text-navy-950 px-4 py-2 rounded-lg font-bold hover:bg-emerald-400 transition-all shadow-lg shadow-accent/20"
            >
              Sign Up
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
