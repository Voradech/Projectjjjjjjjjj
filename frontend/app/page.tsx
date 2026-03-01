"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  Time,
  ColorType,
} from "lightweight-charts";

type RangeKey = "7D" | "1M" | "1Y" | "ALL";
type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

const RANGE_INTERVAL: Record<RangeKey, string> = {
  "7D": "1h",
  "1M": "1h",
  "1Y": "1d",
  ALL: "1d",
};
const RANGE_LIMIT: Record<RangeKey, number> = {
  "7D": 7 * 24,
  "1M": 30 * 24,
  "1Y": 365,
  ALL: 1000,
};
const WS_STREAM: Record<string, string> = {
  "1m": "btcusdt@kline_1m",
  "1h": "btcusdt@kline_1h",
  "1d": "btcusdt@kline_1d",
};

function toSecTime(t: number): Time {
  return (t > 10_000_000_000 ? Math.floor(t / 1000) : t) as Time; 
}

export default function ViewGraphPage() {
  const chartContainerRef = useRef<HTMLDivElement | null>(null); 
  const chartApiRef = useRef<ReturnType<typeof createChart> | null>(null);
  const seriesRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [range, setRange] = useState<RangeKey>("1M");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const interval = useMemo(() => RANGE_INTERVAL[range], [range]);
  const limit = useMemo(() => RANGE_LIMIT[range], [range]);

  useEffect(() => {
    if (!chartContainerRef.current) return;
    const chart = createChart(chartContainerRef.current, {
      height: 500,
      width: chartContainerRef.current.clientWidth,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#94a3b8",
      },
      grid: {
        vertLines: { color: "#334155" },
        horzLines: { color: "#334155" },
      },
      rightPriceScale: {
        borderColor: "#475569",
        borderVisible: true,
      },
      timeScale: {
        borderColor: "#475569",
        borderVisible: true,
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: {
          color: "#94a3b8",
          width: 1,
          style: 3,
          labelBackgroundColor: "#475569",
        },
        horzLine: {
          color: "#94a3b8",
          width: 1,
          style: 3,
          labelBackgroundColor: "#475569",
        },
      },
    });
    chartApiRef.current = chart;

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981", 
      downColor: "#ef4444", 
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });
    seriesRef.current = series;

    const onResize = () => {
      if (!chartContainerRef.current) return;
      chart.applyOptions({ width: chartContainerRef.current.clientWidth });
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

    const res = await fetch(`${API_BASE}/route/price?${q.toString()}`, {
      headers: {
        "ngrok-skip-browser-warning": "true",
      },
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const json = await res.json();
    return json.candles as Candle[];
  }

  const setChartData = (all: Candle[]) => {
    if (all.length === 0) return;

    const mappedData = all.map((c) => ({
      time: toSecTime(c.time),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    seriesRef.current?.setData(mappedData);
  };

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
            
          } catch {}
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

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] w-full p-4 md:p-8">
      {/* Main Glass Card Container */}
      <div className="w-full max-w-6xl bg-[#1e293b]/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl shadow-2xl p-6 md:p-8">
        {/* Header Section: Title & Controls */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-2">
              <span className="w-3 h-8 bg-emerald-500 rounded-full inline-block"></span>
              BTC / USDT
            </h2>
            <p className="text-slate-400 text-sm mt-1 ml-5">
              Bitcoin Price Chart
            </p>
          </div>

          {/* Time Range Selector (Segmented Control style) */}
          <div className="bg-slate-900/60 p-1.5 rounded-xl border border-slate-700/50 flex gap-1">
            {(["7D", "1M", "1Y", "ALL"] as RangeKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setRange(k)}
                className={`
                  px-4 py-1.5 text-sm font-medium rounded-lg transition-all duration-200
                  ${
                    range === k
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                      : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                  }
                `}
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        {/* Loading / Error State Overlay */}
        {loading && candles.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 z-10 rounded-3xl backdrop-blur-sm">
            <span className="text-emerald-400 animate-pulse">
              Loading data...
            </span>
          </div>
        )}

        {err && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center">
            Error: {err}
          </div>
        )}

        {/* Chart Container */}
        <div className="relative w-full h-[500px] rounded-2xl overflow-hidden border border-slate-700/30 bg-slate-900/20 shadow-inner">
          <div ref={chartContainerRef} className="w-full h-full" />
        </div>

        {/* Footer Info (Optional) */}
        <div className="mt-4 flex justify-between items-center text-xs text-slate-500">
          {/*              <span>Data source: Binance API</span>
           */}{" "}
          <span
            className={`flex items-center gap-1.5 ${wsRef.current ? "text-emerald-400" : "text-slate-500"}`}
          >
            <span
              className={`w-2 h-2 rounded-full ${wsRef.current ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`}
            ></span>
            {wsRef.current ? "Live Connection" : "Connecting..."}
          </span>
        </div>
      </div>
    </div>
  );
}
