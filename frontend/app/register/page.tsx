"use client";
import { useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';

import { UserPlus, Lock, User } from 'lucide-react';

export default function Register() {
  const [form, setForm] = useState({ username: '', password: '' });
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5000/api/register', form);
      alert('Success! Please Login.');
      router.push('/login');
    } catch (err) { alert('Registration Failed'); }
  };

  return (

       <div className="flex justify-center items-center min-h-[60vh] pt-24">
        <div className="bg-[#151e32] border border-[#1E293B] p-8 rounded-2xl shadow-2xl w-full max-w-md">
          <h1 className="text-2xl font-bold text-white text-center mb-6 flex justify-center items-center gap-2">
            <UserPlus className="text-accent " /> Create Account
          </h1>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="relative">
                <User className="absolute left-3 top-3 text-gray-500" size={18} />
                <input type="text" onChange={e => setForm({...form, username: e.target.value})}
                  className="w-full bg-[#0B1120] border border-[#1E293B] pl-10 p-3 rounded-lg text-white focus:border-accent outline-none" placeholder="Choose Username" />
            </div>
            <div className="relative">
                <Lock className="absolute left-3 top-3 text-gray-500" size={18} />
                <input type="password" onChange={e => setForm({...form, password: e.target.value})}
                  className="w-full bg-[#0B1120] border border-[#1E293B] pl-10 p-3 rounded-lg text-white focus:border-accent outline-none" placeholder="Choose Password" />
            </div>
            <button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-3 rounded-lg">SIGN UP</button>
          </form>
        </div>
      </div>

  );
} 