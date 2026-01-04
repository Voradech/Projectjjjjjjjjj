"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { Lock, User, LogIn } from 'lucide-react';

export default function Login() {
  const [form, setForm] = useState({ username: '', password: '' });
  const router = useRouter();

const handleLogin = async () => {

  };

  return (
 
      <div className="flex justify-center items-center min-h-[60vh] pt-24">
        <div className="bg-[#151e32] border border-[#1E293B] p-8 rounded-2xl shadow-2xl w-full max-w-md">
          <h1 className="text-2xl font-bold text-white text-center mb-6 flex justify-center items-center gap-2">
            <LogIn className="text-accent" /> Member Login
          </h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
                <User className="absolute left-3 top-4 text-gray-500" size={18} />
                <input type="text" onChange={e => setForm({...form, username: e.target.value})}
                  className="w-full bg-[#0B1120] border border-[#1E293B] pl-10 p-3 rounded-lg text-white focus:border-accent outline-none" placeholder="Username" />
            </div>
            <div className="relative">
                <Lock className="absolute left-3 top-4 text-gray-500" size={18} />
                <input type="password" onChange={e => setForm({...form, password: e.target.value})}
                  className="w-full bg-[#0B1120] border border-[#1E293B] pl-10 p-3 rounded-lg text-white focus:border-accent outline-none" placeholder="Password" />
            </div>
            <button className="w-full bg-[#34D399] hover:bg-emerald-400 text-[#020617] font-bold py-3 rounded-lg transition-all">LOG IN</button>
          </form>
          <p className="mt-6 text-center text-gray-400 text-sm">
            New here? <Link href="/register" className="text-accent hover:underline font-bold">Sign Up</Link>
          </p>
        </div>
      </div>
   
  );
}