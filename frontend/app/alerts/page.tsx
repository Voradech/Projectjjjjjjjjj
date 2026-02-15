"use client";

import { useEffect, useState } from "react";
import {
  BellRing,
  TrendingUp,
  TrendingDown,
  Activity,
  BrainCircuit,
  Shuffle,
  Plus,
  Trash2,
  X,
  Loader2,
  AlertTriangle,
  Settings2,
  Info,
  AlertCircle // เพิ่มไอคอนแจ้งเตือน Error
} from "lucide-react";

type Alert = {
  id: number;
  type: string;
  target_price?: number;
  time_window?: number;
  percentage?: number;
  confidence_threshold?: number;
  is_active: boolean;
};

// Config สำหรับแสดงผล
const getAlertConfig = (type: string) => {
  switch (type) {
    case "PRICE_UP":
      return { 
        label: "ราคาพุ่งสูงกว่าเป้าหมาย", 
        icon: TrendingUp, 
        color: "text-emerald-400", 
        bg: "bg-emerald-400/10",
        desc: ""
      };
    case "PRICE_DOWN":
      return { 
        label: "ราคาดิ่งต่ำกว่าเป้าหมาย", 
        icon: TrendingDown, 
        color: "text-red-400", 
        bg: "bg-red-400/10",
        desc: ""
      };
    case "VOLATILITY":
      return { 
        label: "ราคาสวิงแรงผิดปกติ", 
        icon: Activity, 
        color: "text-yellow-400", 
        bg: "bg-yellow-400/10",
        desc: "ความผันผวนสูงในช่วงสั้นๆ"
      };
    case "PREDICT_UP":
      return { 
        label: "AI คาดการณ์: ขาขึ้น", 
        icon: BrainCircuit, 
        color: "text-purple-400", 
        bg: "bg-purple-400/10",
        desc: "AI มั่นใจว่าราคากำลังจะไปต่อ"
      };
    case "PREDICT_DOWN":
      return { 
        label: "AI คาดการณ์: ขาลง", 
        icon: BrainCircuit, 
        color: "text-pink-400", 
        bg: "bg-pink-400/10",
        desc: "AI เตือนให้ระวังราคาตก"
      };
    case "TREND_CHANGE":
      return { 
        label: "จุดกลับตัวของเทรนด์", 
        icon: Shuffle, 
        color: "text-blue-400", 
        bg: "bg-blue-400/10",
        desc: "แนวโน้มราคาเปลี่ยนทิศ (EMA Cross)"
      };
    default:
      return { label: type, icon: BellRing, color: "text-gray-400", bg: "bg-gray-400/10", desc: "" };
  }
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [systemEnabled, setSystemEnabled] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  // ================= FETCH DATA =================
  const fetchMe = async () => {
    try {
      const res = await fetch("http://localhost:8000/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setRole(data.role);
      }
    } catch (error) { console.error(error); }
  };

  const fetchAlerts = async () => {
    try {
      const res = await fetch("http://localhost:8000/alerts", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setAlerts(Array.isArray(data) ? data : data.data || []);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const fetchSystemStatus = async () => {
    if (role !== "admin") return;
    try {
      const res = await fetch("http://localhost:8000/api/admin/system-alert", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setSystemEnabled(Boolean(data.global_alert_enabled));
      }
    } catch (error) { console.error(error); }
  };

  // ================= ACTIONS =================
  const toggleSystem = async () => {
    if (role !== "admin") return;
    setSystemEnabled(!systemEnabled);
    await fetch("http://localhost:8000/api/admin/system-alert", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ enabled: !systemEnabled }),
    });
    fetchSystemStatus();
  };

  const toggleAlert = async (id: number, isActive: boolean) => {
    setAlerts(alerts.map(a => a.id === id ? { ...a, is_active: !isActive } : a));
    await fetch(`http://localhost:8000/alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ is_active: !isActive }),
    });
    fetchAlerts();
  };

  const deleteAlert = async (id: number) => {
    await fetch(`http://localhost:8000/alerts/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    setDeleteTarget(null);
    fetchAlerts();
  };

  useEffect(() => { fetchMe(); fetchAlerts(); }, []);
  useEffect(() => { if (role === "admin") fetchSystemStatus(); }, [role]);

  return (
    <div className="relative min-h-screen bg-[#020617] text-white p-6 md:p-12 overflow-hidden">
      {/* Background Glow */}
      <div className="absolute w-[600px] h-[600px] bg-emerald-500/10 blur-3xl rounded-full top-[-100px] left-[-100px] pointer-events-none" />
      <div className="absolute w-[500px] h-[500px] bg-indigo-500/10 blur-3xl rounded-full bottom-0 right-0 pointer-events-none" />

      <div className="relative z-10 max-w-4xl mx-auto">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <BellRing className="text-emerald-400" />
              <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                ระบบแจ้งเตือน (Alerts)
              </span>
            </h1>
            <p className="text-gray-400 text-sm mt-1 ml-1">ตั้งค่าการเตือนราคา</p>
          </div>
          
          <button
            onClick={() => setShowForm(!showForm)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition-all shadow-lg ${
              showForm 
              ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/50" 
              : "bg-emerald-500 hover:bg-emerald-400 text-[#020617]"
            }`}
          >
            {showForm ? <X size={18} /> : <Plus size={18} />}
            {showForm ? "ยกเลิก" : "สร้างการแจ้งเตือนใหม่"}
          </button>
        </header>

        {/* ADMIN CONTROL PANEL */}
        {role === "admin" && (
          <div className="mb-8 p-6 rounded-xl bg-gradient-to-r from-slate-900 to-[#0f172a] border border-indigo-500/30 relative overflow-hidden group">
            <div className="absolute inset-0 bg-indigo-500/5 group-hover:bg-indigo-500/10 transition-colors" />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-500/20 rounded-lg text-indigo-400">
                  <Settings2 size={24} />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-white">ระบบแจ้งเตือนหลัก (Admin)</h3>
                  <p className="text-sm text-gray-400">สวิตช์เปิด-ปิดการแจ้งเตือนทั้งระบบ</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                 <span className={`text-sm font-medium ${systemEnabled ? "text-emerald-400" : "text-gray-500"}`}>
                    {systemEnabled ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                 </span>
                 <button
                   onClick={toggleSystem}
                   className={`w-14 h-7 rounded-full p-1 transition-colors duration-300 ease-in-out ${
                     systemEnabled ? "bg-emerald-500" : "bg-gray-700"
                   }`}
                 >
                   <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${
                     systemEnabled ? "translate-x-7" : "translate-x-0"
                   }`} />
                 </button>
              </div>
            </div>
          </div>
        )}

        {/* CREATE FORM */}
        <div className={`overflow-hidden transition-all duration-500 ease-in-out ${showForm ? "max-h-[600px] opacity-100 mb-8" : "max-h-0 opacity-0"}`}>
            <AddAlertForm onSuccess={() => { fetchAlerts(); setShowForm(false); }} />
        </div>

        {/* ALERTS LIST */}
        {loading ? (
           <div className="flex justify-center py-20">
             <Loader2 size={40} className="animate-spin text-emerald-400" />
           </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-20 bg-white/[0.03] rounded-xl border border-white/5 border-dashed">
            <BellRing size={48} className="mx-auto text-gray-600 mb-4" />
            <p className="text-gray-400">ยังไม่มีรายการแจ้งเตือน</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {alerts.map((alert) => {
              const config = getAlertConfig(alert.type);
              const Icon = config.icon;
              
              return (
                <div
                  key={alert.id}
                  className={`relative group p-5 rounded-xl border backdrop-blur-md transition-all duration-300 
                    ${alert.is_active 
                      ? "bg-white/[0.06] border-white/10 hover:border-emerald-500/30 hover:bg-white/[0.08]" 
                      : "bg-black/20 border-white/5 opacity-60 grayscale-[0.5]"
                    }`}
                >
                  <div className="flex justify-between items-center">
                    {/* Left Side: Icon & Info */}
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-lg ${config.bg} ${config.color}`}>
                        <Icon size={24} />
                      </div>
                      
                      <div>
                        <h3 className={`font-semibold text-lg ${alert.is_active ? "text-white" : "text-gray-400"}`}>
                          {config.label}
                        </h3>
                        <p className="text-xs text-gray-500 mb-2 hidden md:block">{config.desc}</p>
                        
                        <div className="flex flex-wrap gap-2 mt-1 text-sm text-gray-400">
                          {alert.target_price && (
                             <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5">
                               เป้าหมาย: <span className="text-white font-mono">${alert.target_price.toLocaleString()}</span>
                             </span>
                          )}
                          {alert.percentage && (
                             <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5">
                               {alert.time_window} นาที | <span className={alert.percentage > 0 ? "text-emerald-400" : "text-red-400"}>{alert.percentage}%</span>
                             </span>
                          )}
                          {alert.confidence_threshold && (
                             <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5">
                               ความมั่นใจ AI: <span className="text-purple-400">{alert.confidence_threshold}%</span>
                             </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Side: Controls */}
                    <div className="flex items-center gap-4">
                      {/* Toggle Switch */}
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={alert.is_active}
                          onChange={() => toggleAlert(alert.id, alert.is_active)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                      </label>

                      {/* Delete Button */}
                      <button
                        onClick={() => setDeleteTarget(alert.id)}
                        className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="ลบรายการ"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* DELETE CONFIRMATION MODAL */}
        {deleteTarget && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-[#0f172a] border border-white/10 p-6 rounded-2xl w-full max-w-sm shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                  <AlertTriangle className="text-red-500" size={32} />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">ยืนยันการลบ?</h2>
                <p className="text-gray-400 mb-6">
                  คุณแน่ใจหรือไม่ที่จะลบการแจ้งเตือนนี้? ไม่สามารถกู้คืนได้นะครับ
                </p>
                
                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => setDeleteTarget(null)}
                    className="flex-1 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white font-medium transition"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={() => deleteAlert(deleteTarget)}
                    className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium transition"
                  >
                    ลบเลย
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ================= SUB COMPONENT: FORM (เพิ่ม Logic ตรวจสอบข้อมูลว่าง) =================
function AddAlertForm({ onSuccess }: { onSuccess: () => void }) {
  const [type, setType] = useState("PRICE_UP");
  const [target, setTarget] = useState("");
  const [minutes, setMinutes] = useState("");
  const [percentage, setPercentage] = useState("");
  const [confidence, setConfidence] = useState("");
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null); // State สำหรับเก็บ Error Message

  const handleSubmit = async () => {
    setError(null); // เคลียร์ error เดิมก่อน

    // --- Validation Logic (ตรวจสอบข้อมูลว่าง) ---
    if ((type === "PRICE_UP" || type === "PRICE_DOWN") && !target) {
        setError("กรุณาระบุราคาเป้าหมาย");
        return;
    }
    
    if (type === "VOLATILITY") {
        if (!minutes || !percentage) {
            setError("กรุณาระบุช่วงเวลาและเปอร์เซ็นต์การเปลี่ยนแปลง");
            return;
        }
    }

    if ((type === "PREDICT_UP" || type === "PREDICT_DOWN") && !confidence) {
        setError("กรุณาระบุค่าความมั่นใจของ AI");
        return;
    }
    // ------------------------------------------

    setSubmitting(true);
    try {
        await fetch("http://localhost:8000/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
            type,
            target_price: target || null,
            time_window: minutes || null,
            percentage: percentage || null,
            confidence_threshold: confidence || null,
        }),
        });
        onSuccess();
    } catch (error) { 
        console.error(error);
        setError("เกิดข้อผิดพลาดในการบันทึก โปรดลองใหม่อีกครั้ง");
    } finally { 
        setSubmitting(false); 
    }
  };

  return (
    <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-xl">
      <h2 className="text-lg font-semibold text-emerald-400 mb-4 flex items-center gap-2">
         <Plus size={20} /> ตั้งค่าการแจ้งเตือนใหม่
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="col-span-1 md:col-span-2">
            <label className="block text-xs text-gray-400 mb-1 ml-1">รูปแบบการแจ้งเตือน</label>
            <select
                value={type}
                onChange={(e) => {
                    setType(e.target.value);
                    setError(null); // เคลียร์ error เมื่อเปลี่ยนประเภท
                }}
                className="w-full bg-[#0B1120] border border-white/10 p-3 rounded-lg text-white focus:border-emerald-400 outline-none transition appearance-none cursor-pointer"
            >
                <option value="PRICE_UP">ราคาพุ่งขึ้นสูงกว่า</option>
                <option value="PRICE_DOWN">ราคาดิ่งลงต่ำกว่า</option>
                <option value="VOLATILITY">ราคาสวิงแรงผิดปกติ </option>
                <option value="PREDICT_UP">คาดการณ์ว่าราคาจะ 'ขึ้น'</option>
                <option value="PREDICT_DOWN">คาดการณ์ว่าราคาจะ 'ลง'</option>
                <option value="TREND_CHANGE">จุดกลับตัวของเทรนด์</option>
            </select>
        </div>

        {(type === "PRICE_UP" || type === "PRICE_DOWN") && (
             <div className="col-span-1 md:col-span-2">
                <label className="block text-xs text-gray-400 mb-1 ml-1">
                    {type === "PRICE_UP" ? "แจ้งเตือนเมื่อราคาสูงกว่า ($)" : "แจ้งเตือนเมื่อราคาต่ำกว่า ($)"} <span className="text-red-400">*</span>
                </label>
                <input
                type="number"
                placeholder="เช่น 50000"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className={`w-full bg-[#0B1120] border p-3 rounded-lg text-white focus:border-emerald-400 outline-none ${error ? "border-red-500/50" : "border-white/10"}`}
                />
            </div>
        )}

        {type === "VOLATILITY" && (
            <>
            <div>
                <label className="block text-xs text-gray-400 mb-1 ml-1">ช่วงเวลา (นาที) <span className="text-red-400">*</span></label>
                <input
                type="number"
                placeholder="เช่น 15"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                className={`w-full bg-[#0B1120] border p-3 rounded-lg text-white focus:border-emerald-400 outline-none ${error ? "border-red-500/50" : "border-white/10"}`}
                />
            </div>
            <div>
                <label className="block text-xs text-gray-400 mb-1 ml-1">เปลี่ยนกี่ % (ขึ้นหรือลง) <span className="text-red-400">*</span></label>
                <input
                type="number"
                placeholder="เช่น 5"
                value={percentage}
                onChange={(e) => setPercentage(e.target.value)}
                className={`w-full bg-[#0B1120] border p-3 rounded-lg text-white focus:border-emerald-400 outline-none ${error ? "border-red-500/50" : "border-white/10"}`}
                />
            </div>
            </>
        )}

        {(type === "PREDICT_UP" || type === "PREDICT_DOWN") && (
             <div className="col-span-1 md:col-span-2">
                <label className="block text-xs text-gray-400 mb-1 ml-1">ความมั่นใจของ AI ขั้นต่ำ (%) <span className="text-red-400">*</span></label>
                <input
                type="number"
                placeholder="เช่น 80"
                value={confidence}
                onChange={(e) => setConfidence(e.target.value)}
                className={`w-full bg-[#0B1120] border p-3 rounded-lg text-white focus:border-emerald-400 outline-none ${error ? "border-red-500/50" : "border-white/10"}`}
                />
                <p className="text-xs text-gray-500 mt-1 ml-1">ยิ่งค่าสูง สัญญาณเตือนยิ่งแม่นยำ</p>
            </div>
        )}
      </div>

      {type === "TREND_CHANGE" && (
        <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg text-blue-300 text-sm mb-4 flex items-start gap-2">
           <Info size={16} className="mt-1 flex-shrink-0" />
           <span>ระบบจะแจ้งเตือนเมื่อเส้นค่าเฉลี่ย (EMA) ตัดกัน ซึ่งเป็นสัญญาณเริ่มเทรนด์ใหม่</span>
        </div>
      )}

      {/* ส่วนแสดง Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm animate-in fade-in slide-in-from-top-1">
            <AlertCircle size={18} />
            <span>{error}</span>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full bg-emerald-500 hover:bg-emerald-400 text-[#020617] font-bold py-3 rounded-lg transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting && <Loader2 className="animate-spin" size={18} />}
        {submitting ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
      </button>
    </div>
  );
}