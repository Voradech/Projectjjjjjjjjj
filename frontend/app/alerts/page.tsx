"use client";

import { useEffect, useState } from "react";

type Alert = {
  id: number;
  type: string;
  target_price?: number;
  time_window?: number;
  percentage?: number;
  confidence_threshold?: number;
  is_active: boolean;
};
const getAlertLabel = (type: string) => {
  switch (type) {
    case "PRICE_UP":
      return "แจ้งเตือนเมื่อราคาสูงกว่าที่กำหนด";
    case "PRICE_DOWN":
      return "แจ้งเตือนเมื่อราคาต่ำกว่าที่กำหนด";
    case "VOLATILITY":
      return "แจ้งเตือนเมื่อเกิดความผันผวน";
    case "PREDICT_UP":
      return "าดการณ์ว่าราคาจะขึ้น";
    case "PREDICT_DOWN":
      return "คาดการณ์ว่าราคาจะลง";
    case "TREND_CHANGE":
      return "แนวโน้มเปลี่ยน (เส้น EMA ตัดกัน)";
    default:
      return type;
  }
};
export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [systemEnabled, setSystemEnabled] = useState<boolean>(false);

  // ================= FETCH ME =================
  const fetchMe = async () => {
    const res = await fetch("http://localhost:8000/auth/me", {
      credentials: "include",
    });

    if (!res.ok) return;

    const data = await res.json();
    setRole(data.role);
  };

  // ================= FETCH ALERTS =================
  const fetchAlerts = async () => {
    const res = await fetch("http://localhost:8000/alerts", {
      credentials: "include",
    });

    if (!res.ok) return;

    const data = await res.json();

    if (Array.isArray(data)) {
      setAlerts(data);
    } else if (Array.isArray(data.data)) {
      setAlerts(data.data);
    } else {
      setAlerts([]);
    }
  };

  // ================= FETCH SYSTEM STATUS (ADMIN ONLY) =================
  const fetchSystemStatus = async () => {
    if (role !== "admin") return;

    const res = await fetch("http://localhost:8000/api/admin/system-alert", {
      credentials: "include",
    });

    if (!res.ok) return;

    const data = await res.json();
    setSystemEnabled(Boolean(data.global_alert_enabled));
  };

  const toggleSystem = async () => {
    if (role !== "admin") return;

    await fetch("http://localhost:8000/api/admin/system-alert", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        enabled: !systemEnabled,
      }),
    });

    fetchSystemStatus();
  };

  useEffect(() => {
    fetchMe();
    fetchAlerts();
  }, []);

  useEffect(() => {
    if (role === "admin") {
      fetchSystemStatus();
    }
  }, [role]);

  // ================= ALERT ACTIONS =================
  const toggleAlert = async (id: number, isActive: boolean) => {
    await fetch(`http://localhost:8000/alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ is_active: !isActive }),
    });

    fetchAlerts();
  };
  /*   const sendTestAlert = async () => {
  await fetch("http://localhost:8000/api/alerts/test-alert", {
    method: "POST",
    credentials: "include",
  });

  alert("Test alert triggered 🚀");
};
 */
  const deleteAlert = async (id: number) => {
    await fetch(`http://localhost:8000/alerts/${id}`, {
      method: "DELETE",
      credentials: "include",
    });

    fetchAlerts();
  };

  return (
    <div className="p-8 text-white max-w-4xl mx-auto pt-16">
      <h1 className="text-3xl font-bold mb-6 text-cyan-400">
        BTC Alert Center
        {/*    <button
  onClick={sendTestAlert}
  className="bg-purple-600 hover:bg-purple-700 transition px-4 py-2 rounded-lg mb-4"
>
   Force Test Alert
</button> */}
      </h1>

      {/* GLOBAL TOGGLE - ADMIN ONLY */}
      {role === "admin" && (
        <div className="flex items-center gap-4 mb-8 bg-[#1e293b] p-4 rounded-xl border border-slate-700">
          <span className="text-slate-400">Alert System</span>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={!!systemEnabled}
              onChange={toggleSystem}
              className="sr-only peer"
            />
            <div
              className="
                w-11 h-6 bg-gray-600
                rounded-full
                peer-checked:bg-cyan-600
                after:content-['']
                after:absolute
                after:top-[2px]
                after:left-[2px]
                after:bg-white
                after:rounded-full
                after:h-5 after:w-5
                after:transition-all
                peer-checked:after:translate-x-full
              "
            ></div>
          </label>

          <span
            className={`text-sm ${
              systemEnabled ? "text-green-400" : "text-red-400"
            }`}
          >
            {systemEnabled ? "Enabled" : "Disabled"}
          </span>
        </div>
      )}

      {/* ADD ALERT */}
      <button
        onClick={() => setShowForm(!showForm)}
        className="bg-cyan-600 hover:bg-cyan-700 transition px-4 py-2 rounded-lg mb-6"
      >
        + เพิ่มการแจ้งเตือนใหม่
      </button>

      {showForm && (
        <AddAlertForm
          onSuccess={() => {
            fetchAlerts();
            setShowForm(false);
          }}
        />
      )}

      {/* ALERT LIST */}
      <div className="space-y-5">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="bg-[#1e293b] p-5 rounded-xl border border-slate-700 shadow-lg"
          >
            <div className="flex justify-between items-center">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <p className="font-semibold text-cyan-400"> {getAlertLabel(alert.type)}</p>

                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      alert.is_active
                        ? "bg-green-500/20 text-green-400"
                        : "bg-gray-500/20 text-gray-400"
                    }`}
                  >
                    {alert.is_active ? "กำลังใช้งาน" : "ปิดการใช้งาน"}
                  </span>
                </div>

                {alert.target_price && (
                  <p className="text-slate-400">Target: {alert.target_price}</p>
                )}

                {alert.percentage && (
                  <p className="text-slate-400">
                    {alert.time_window} นาที | {alert.percentage}%
                  </p>
                )}

                {alert.confidence_threshold && (
                  <p className="text-slate-400">
                    Confidence ≥ {alert.confidence_threshold}%
                  </p>
                )}
              </div>

              <div className="flex items-center gap-4">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alert.is_active}
                    onChange={() => toggleAlert(alert.id, alert.is_active)}
                    className="sr-only peer"
                  />
                  <div
                    className="
                      w-11 h-6 bg-gray-600
                      rounded-full
                      peer-checked:bg-cyan-600
                      after:content-['']
                      after:absolute
                      after:top-[2px]
                      after:left-[2px]
                      after:bg-white
                      after:rounded-full
                      after:h-5 after:w-5
                      after:transition-all
                      peer-checked:after:translate-x-full
                    "
                  ></div>
                </label>

                <button
                  onClick={() => setDeleteTarget(alert.id)}
                  className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#1e293b] p-6 rounded-xl w-[350px] border border-slate-700 shadow-2xl">
            <h2 className="text-lg font-semibold text-red-400 mb-4">
              Confirm Delete
            </h2>

            <p className="text-slate-400 mb-6">
              Are you sure you want to delete this alert?
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded bg-gray-600 hover:bg-gray-700"
              >
                Cancel
              </button>

              <button
                onClick={async () => {
                  await deleteAlert(deleteTarget);
                  setDeleteTarget(null);
                }}
                className="px-4 py-2 rounded bg-red-600 hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function AddAlertForm({ onSuccess }: { onSuccess: () => void }) {
  const [type, setType] = useState("PRICE_UP");
  const [target, setTarget] = useState("");
  const [minutes, setMinutes] = useState("");
  const [percentage, setPercentage] = useState("");
  const [confidence, setConfidence] = useState("");

  const handleSubmit = async () => {
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
  };

  return (
    <div className="bg-[#1e293b] p-6 rounded-xl mb-6 border border-slate-700 shadow-xl space-y-5">
      <h2 className="text-lg font-semibold text-cyan-400">
        สร้างการเเจ้งเตือนใหม่
      </h2>

      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        className="bg-slate-800 p-3 rounded-lg w-full border border-slate-700"
      >
        <option value="PRICE_UP">ราคาสูงกว่าค่าที่กำหนด</option>
        <option value="PRICE_DOWN">ราคาต่ำกว่าค่าที่กำหนด</option>
        <option value="VOLATILITY">ความผันผวน</option>
        <option value="PREDICT_UP">คาดการณ์ว่าราคาจะขึ้น</option>
        <option value="PREDICT_DOWN">คาดการณ์ว่าราคาจะลง</option>
        <option value="TREND_CHANGE">การเปลี่ยนแนวโน้ม (EMA ตัดกัน)</option>
      </select>

      {(type === "PRICE_UP" || type === "PRICE_DOWN") && (
        <input
          type="number"
          placeholder="Target Price"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="bg-slate-800 p-3 rounded-lg w-full border border-slate-700"
        />
      )}

      {type === "VOLATILITY" && (
        <>
          <input
            type="number"
            placeholder="Time Window (minutes)"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="bg-slate-800 p-3 rounded-lg w-full border border-slate-700"
          />
          <input
            type="number"
            placeholder="Percentage Change (%)"
            value={percentage}
            onChange={(e) => setPercentage(e.target.value)}
            className="bg-slate-800 p-3 rounded-lg w-full border border-slate-700"
          />
        </>
      )}

      {(type === "PREDICT_UP" || type === "PREDICT_DOWN") && (
        <input
          type="number"
          placeholder="Minimum Confidence (%)"
          value={confidence}
          onChange={(e) => setConfidence(e.target.value)}
          className="bg-slate-800 p-3 rounded-lg w-full border border-slate-700"
        />
      )}

      {type === "TREND_CHANGE" && (
        <div className="text-slate-400 text-sm">
          This alert triggers when EMA7 crosses EMA14.
        </div>
      )}

      <button
        onClick={handleSubmit}
        className="bg-cyan-600 hover:bg-cyan-700 transition px-4 py-3 rounded-lg w-full font-semibold"
      >
        บันทึกการแจ้งเตือน
      </button>
    </div>
  );
}
