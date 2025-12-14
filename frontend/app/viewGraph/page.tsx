"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type PriceCandle = {
  time: number; // timestamp (ms)
  open: number;
  high: number;
  low: number;
  close: number;
};

type PriceApiResponse = {
  symbol: string;
  interval: string;
  limit: number;
  candles: PriceCandle[];
};

const formatDate = (ts: number) => {
  const d = new Date(ts);
  // แสดงแบบสั้น ๆ (ปรับได้)
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};

const Page = () => {
  const [priceData, setPriceData] = useState<PriceCandle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const r = await fetch("http://localhost:3001/api/price");
        if (!r.ok) throw new Error(`API error: ${r.status}`);

        const json = (await r.json()) as PriceApiResponse;

        // กันพังถ้า API ไม่ส่ง candles มา
        setPriceData(Array.isArray(json.candles) ? json.candles : []);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load price data");
        setPriceData([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const lastClose = priceData.length
    ? priceData[priceData.length - 1].close
    : null;

  const chartData = useMemo(() => {
    // เพิ่ม field ที่ใช้โชว์บนกราฟ (label)
    return priceData.map((c) => ({
      ...c,
      dateLabel: formatDate(c.time),
    }));
  }, [priceData]);

  return (
    <div className="p-6 space-y-4">
      <div className="text-xl font-semibold text-[#101828] flex items-center justify-center">
        Bitcoin
      </div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#101828]">Predict View</h1>
        {lastClose !== null && (
          <div className="text-sm text-[#344054]">
            Latest Close:{" "}
            <span className="font-semibold">{lastClose.toLocaleString()}</span>
          </div>
        )}
      </div>

      {loading && <p className="text-sm text-[#344054]">Loading...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && priceData.length === 0 && (
        <p className="text-sm text-[#344054]">No data</p>
      )}

      {!loading && !error && priceData.length > 0 && (
        <div className="w-full h-[420px] border rounded-xl bg-[#1E293B] p-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                tickFormatter={(v) => formatDate(Number(v))}
                minTickGap={24}
              />
              <YAxis
                domain={["auto", "auto"]}
                tickFormatter={(v) => Number(v).toLocaleString()}
              />
              <Tooltip
                labelFormatter={(label) => formatDate(Number(label))}
                formatter={(value: any, name: any) => {
                  if (typeof value === "number") {
                    return [value.toLocaleString(), name];
                  }
                  return [value, name];
                }}
              />
              <Line
                type="monotone"
                dataKey="close"
                dot={false}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ถ้าอยากดู raw JSON ด้วย (เอาไว้ดีบัก) */}
      {/* <details className="border rounded-xl p-4 bg-white">
        <summary className="cursor-pointer text-sm text-[#3677CA]">
          Show raw data (debug)
        </summary>
        <pre className="mt-3 text-xs overflow-auto">
          {JSON.stringify(priceData, null, 2)}
        </pre>
      </details> */}
    </div>
  );
};

export default Page;
