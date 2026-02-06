"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createChart, CandlestickSeries, Time } from "lightweight-charts";

type RangeKey = "7D" | "1M" | "1Y" | "ALL";
type Candle = { time: number; open: number; high: number; low: number; close: number };

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

// เลือกช่วงเวลา -> interval ที่เหมาะ (เร็ว + realtime ดี)
const RANGE_INTERVAL: Record<RangeKey, string> = {
  "7D": "1h",
  "1M": "1h",
  "1Y": "1d",
  "ALL": "1d",
};
const RANGE_LIMIT: Record<RangeKey, number> = {
  "7D": 7 * 24,
  "1M": 30 * 24,
  "1Y": 365,
  "ALL": 1000,
};
const WS_STREAM: Record<string, string> = {
  "1m": "btcusdt@kline_1m",
  "1h": "btcusdt@kline_1h",
  "1d": "btcusdt@kline_1d",
};

function toSecTime(t: number): Time {
  return (t > 10_000_000_000 ? Math.floor(t / 1000) : t) as Time; // ms->sec
}

export default function ViewGraphPage() {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartApiRef = useRef<ReturnType<typeof createChart> | null>(null);
  const seriesRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [range, setRange] = useState<RangeKey>("1M");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const interval = useMemo(() => RANGE_INTERVAL[range], [range]);
  const limit = useMemo(() => RANGE_LIMIT[range], [range]);

  // init chart once
  useEffect(() => {
    if (!chartRef.current) return;

    const chart = createChart(chartRef.current, {
      height: 500,
      width: chartRef.current.clientWidth || 700,

      //  เส้นตาราง/ขอบกราฟ
      grid: {
        vertLines: { visible: true },
        horzLines: { visible: true },
      },
      rightPriceScale: { borderVisible: true },
      timeScale: { borderVisible: true, timeVisible: true, secondsVisible: false },
      crosshair: { vertLine: { visible: true }, horzLine: { visible: true } },
    });

    chartApiRef.current = chart;

    const series = chart.addSeries(CandlestickSeries);
    seriesRef.current = series;

    const onResize = () => {
      if (!chartRef.current) return;
      chart.applyOptions({ width: chartRef.current.clientWidth });
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      wsRef.current?.close();
      chart.remove();
      chartApiRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  async function fetchCandles(opts?: { endTimeMs?: number; limit?: number }) {
    const q = new URLSearchParams({
      symbol: "BTCUSDT",
      interval,
      limit: String(Math.min(opts?.limit ?? limit, 1000)),
    });
    if (opts?.endTimeMs) q.set("endTime", String(opts.endTimeMs));

    const res = await fetch(`${API_BASE}/api/price?${q.toString()}`);
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const json = await res.json();
    return json.candles as Candle[];
  }

  const setChartData = (all: Candle[]) => {
    seriesRef.current?.setData(
      all.map((c) => ({
        time: toSecTime(c.time),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );
  };

  // load for selected range + start realtime
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setErr(null);

      try {
        wsRef.current?.close();
        wsRef.current = null;

        const data = await fetchCandles({ limit });
        if (cancelled) return;

        const sorted = [...data].sort((a, b) => a.time - b.time);
        setCandles(sorted);
        setChartData(sorted);
        chartApiRef.current?.timeScale().fitContent();

        // realtime via Binance WS (เร็วสุด)
        const stream = WS_STREAM[interval] ?? WS_STREAM["1m"];
        const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${stream}`);
        wsRef.current = ws;

        ws.onmessage = (evt) => {
          try {
            const msg = JSON.parse(evt.data);
            const k = msg?.k;
            if (!k) return;

            const updated: Candle = {
              time: Number(k.t),
              open: Number(k.o),
              high: Number(k.h),
              low: Number(k.l),
              close: Number(k.c),
            };

            seriesRef.current?.update({
              time: toSecTime(updated.time),
              open: updated.open,
              high: updated.high,
              low: updated.low,
              close: updated.close,
            });

            setCandles((prev) => {
              if (prev.length === 0) return [updated];
              const last = prev[prev.length - 1];
              if (last.time === updated.time) {
                const next = prev.slice();
                next[next.length - 1] = updated;
                return next;
              }
              return [...prev, updated];
            });
          } catch { }
        };
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Fetch failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [interval, limit]);

  // load more (ย้อนหลังเพิ่ม “สุดลิมิต” ครั้งละ 1000)
  const loadMore = async () => {
    if (candles.length === 0) return;
    setLoading(true);
    setErr(null);

    try {
      const earliest = candles[0].time;
      const more = await fetchCandles({ endTimeMs: earliest - 1, limit: 1000 });

      const merged = new Map<number, Candle>();
      for (const c of [...more, ...candles]) merged.set(c.time, c);

      const all = Array.from(merged.values()).sort((a, b) => a.time - b.time);
      setCandles(all);
      setChartData(all);
      chartApiRef.current?.timeScale().fitContent();
    } catch (e: any) {
      setErr(e?.message ?? "Load more failed");
    } finally {
      setLoading(false);
    }
  };

  // Load ALL (max): ดึงย้อนหลังต่อเนื่อง แล้วเอา “ทั้งหมด” มาแสดงบนกราฟ
  const loadAllAndShowOnChart = async () => {
    setLoading(true);
    setErr(null);

    try {
      let all = [...candles].sort((a, b) => a.time - b.time);

      if (all.length === 0) {
        const first = await fetchCandles({ limit: 1000 });
        all = [...first].sort((a, b) => a.time - b.time);
        setCandles(all);
        setChartData(all);
      }

      let endTime = all[0]?.time ? all[0].time - 1 : undefined;

      const MAX_ROUNDS = 300;     // เพิ่มได้อีก (300*1000 = 300k แท่ง)
      const SLEEP_MS = 120;       //  เร็วขึ้นหน่อย
      const UPDATE_EVERY = 5;     //  อัปเดตกราฟทุก 5 รอบ

      for (let i = 0; i < MAX_ROUNDS; i++) {
        if (!endTime) break;

        const more = await fetchCandles({ endTimeMs: endTime, limit: 1000 });
        if (!more || more.length === 0) break;

        const merged = new Map<number, Candle>();
        for (const c of [...more, ...all]) merged.set(c.time, c);
        all = Array.from(merged.values()).sort((a, b) => a.time - b.time);

        endTime = all[0].time - 1;

        //  ไม่ต้อง set chart ทุกครั้ง (กันกระตุก)
        if (i % UPDATE_EVERY === 0) {
          setCandles(all);
          setChartData(all);
        }

        await new Promise((r) => setTimeout(r, SLEEP_MS));
      }

      //  อัปเดตรอบสุดท้าย + fitContent ครั้งเดียว
      setCandles(all);
      setChartData(all);
      chartApiRef.current?.timeScale().fitContent();
    } catch (e: any) {
      setErr(e?.message ?? "Load ALL failed");
    } finally {
      setLoading(false);
    }
  };


  return (<div>
    <div className="w-full p-4 space-y-3">

      <div className="flex items-center py-5">
      

     
      
      </div>

      


    </div>
    <div className="relative w-full border rounded-xl p-2">
      {/* ตัวกราฟ */}
      <div ref={chartRef} className="w-full" />

      {/* ปุ่มเลือก range (ขวาล่าง) */}

    </div>
    <div>
      <div className="flex gap-1.5 backdrop-blur rounded-lg shadow px-2 py-2 justify-end ">
        {(["7D", "1M", "1Y", "ALL"] as RangeKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setRange(k)}
            className={`w-8 h-8 text-xs rounded-lg transition
    ${range === k
                ? "bg-[#34D399] text-black"
                : "bg-white hover:bg-gray-200"
              }`}
          >
            {k}
          </button>


        ))}
      </div>
    </div>
  </div>
  );
}
