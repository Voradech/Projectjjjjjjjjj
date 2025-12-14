"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickData,
  ISeriesApi,
  Time,
} from "lightweight-charts";

type PriceCandle = {
  time: number; // ms timestamp
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

type RangeKey = "7D" | "1M" | "1Y";

const RANGE_LIMIT: Record<RangeKey, number> = {
  "7D": 7,
  "1M": 30,
  "1Y": 365,
};

const ViewGraphPage = () => {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);

  // ✅ v5: ใช้ ReturnType<typeof createChart> แทน IChartApi
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);

  // ✅ เก็บ series reference
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick", Time> | null>(null);

  const [range, setRange] = useState<RangeKey>("1M");
  const [ohlc, setOhlc] = useState<PriceCandle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  // ---------- init chart once ----------
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      height: 420,
      layout: {
        background: { color: "#ffffff" },
        textColor: "#344054",
      },
      grid: {
        vertLines: { color: "#f2f4f7" },
        horzLines: { color: "#f2f4f7" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
    });

    chartRef.current = chart;

    // ✅ v5: ใช้ addSeries({ type: "Candlestick" }) แทน addCandlestickSeries()
    candleSeriesRef.current = chart.addSeries({
      type: "Candlestick",
      upColor: "#16a34a",
      downColor: "#dc2626",
      wickUpColor: "#16a34a",
      wickDownColor: "#dc2626",
      borderVisible: false,
    });

    const handleResize = () => {
      if (!chartContainerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({
        width: chartContainerRef.current.clientWidth,
      });
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);

      // ✅ removeSeries ต้องส่ง series เข้าไป
      if (chartRef.current && candleSeriesRef.current) {
        chartRef.current.removeSeries(candleSeriesRef.current);
      }

      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
    };
  }, []);

  // ---------- load data when range changes ----------
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const limit = RANGE_LIMIT[range];

        const res = await fetch(
          `http://localhost:3001/api/price?interval=1d&limit=${limit}`
        );

        if (!res.ok) throw new Error(`API error: ${res.status}`);

        const json = (await res.json()) as PriceApiResponse;
        setOhlc(Array.isArray(json.candles) ? json.candles : []);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load price data");
        setOhlc([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [range]);

  // ---------- update chart data ----------
  useEffect(() => {
    if (!candleSeriesRef.current) return;

    const data: CandlestickData<Time>[] = ohlc.map((c) => ({
      time: Math.floor(c.time / 1000) as Time, // seconds
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    candleSeriesRef.current.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [ohlc]);

  const last = ohlc.length ? ohlc[ohlc.length - 1] : null;

  return (
    <div className="p-6 space-y-4">
      {/* Header + Range Buttons */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#101828]">
          Predict View (Candlestick)
        </h1>

        <div className="flex gap-2">
          {(["7D", "1M", "1Y"] as RangeKey[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-4 py-1 rounded-full text-sm font-medium
                ${
                  range === r
                    ? "bg-[#4395FC] text-white"
                    : "border border-[#4395FC] text-[#3677CA]"
                }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* OHLC */}
      {last && (
        <div className="flex flex-wrap gap-6 text-sm text-[#344054]">
          <div>
            Open: <b>{last.open.toLocaleString()}</b>
          </div>
          <div>
            High: <b>{last.high.toLocaleString()}</b>
          </div>
          <div>
            Low: <b>{last.low.toLocaleString()}</b>
          </div>
          <div>
            Close: <b>{last.close.toLocaleString()}</b>
          </div>
        </div>
      )}

      {/* Status */}
      {loading && <p className="text-sm text-[#344054]">Loading...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Chart */}
      <div className="border rounded-xl bg-white p-3">
        <div ref={chartContainerRef} className="w-full h-[420px]" />
      </div>
    </div>
  );
};

export default ViewGraphPage;
