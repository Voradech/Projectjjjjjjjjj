"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  IChartApi,
  LineSeries,
  CandlestickSeries,
  UTCTimestamp,
  ISeriesApi,
} from "lightweight-charts";
import { predictTrend,TrendResult } from "@/services/prediction";
import { fetchActualCandles } from "@/services/marketData";

type ModelType = "rf" | "gb" | "lstm";
type Horizon = 1 | 7 | 14;

type Trend = "Bullish" | "Bearish" | "sideways";
type Signal = "BUY" | "SELL" | "HOLD";

export default function PredictView() {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartApiRef = useRef<IChartApi | null>(null);
  const actualSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [model, setModel] = useState<ModelType>("lstm");
  const [horizon, setHorizon] = useState<Horizon>(1);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [trend, setTrend] = useState<Trend | null>(null);
  const [signal, setSignal] = useState<Signal | null>(null);


  const query = useMemo(
    () => ({ symbol: "BTCUSDT", interval: "1d", limit: 220 }),
    []
  );

  // ---------- Chart init ----------
  useEffect(() => {
    if (!chartRef.current) return;

    const chart = createChart(chartRef.current, {
      height: 520,
      width: chartRef.current.clientWidth || 900,
      layout: {
        background: { color: "#FFFFFF" },
        textColor: "",
      },
      grid: {
        vertLines: { visible: true },
        horzLines: { visible: true },
      },
      rightPriceScale: { borderVisible: true },
      timeScale: {
        borderVisible: true,
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: { vertLine: { visible: true }, horzLine: { visible: true } },
    });
    chartApiRef.current = chart;
    return () => chart.remove();
  }, []);



  // ---------- Predict ----------

const runPredict = async () => {
  try {
    setErr(null);
    setLoading(true);
    setTrend(null);
    setSignal(null);
    
    const candles = await fetchActualCandles(query);
    if (!chartApiRef.current) return;

    // ----- draw actual price -----
    if (actualSeriesRef.current)
      chartApiRef.current.removeSeries(actualSeriesRef.current);

    actualSeriesRef.current = chartApiRef.current.addSeries(
      CandlestickSeries,
      {
        upColor: "#22c55e",
        downColor: "#ef4444",
        wickUpColor: "#22c55e",
        wickDownColor: "#ef4444",
        borderVisible: false,
      }
    );

    actualSeriesRef.current.setData(
      candles.map((c: any) => ({
        time: c.time as UTCTimestamp,
        open: +c.open,
        high: +c.high,
        low: +c.low,
        close: +c.close,
      }))
    );

    // ----- call prediction service -----
    const res = await predictTrend(
      model,
      candles[candles.length - 1], // ใช้แท่งล่าสุด
      {
        candles,
        horizon,
      }
    );

    // ----- map result to UI -----

  if (res?.trend && res?.signal) {
  setTrend(res.trend === "UP" ? "Bullish" : "Bearish");
  setSignal(res.signal);
  }


    chartApiRef.current.timeScale().fitContent();
  } catch (e: any) {
    setErr(e?.message ?? "Unknown error");
  } finally {
    setLoading(false);
  }
};

  // ================= UI =================
  return (
    <div className="p-6 space-y-5">
      <h1 className="pt-10 text-2xl font-semibold text-white">
        Bitcoin Trend Prediction (Decision Support)
      </h1>

      <div className="flex gap-4 items-center">
        <select
          value={model}
          onChange={(e) => setModel(e.target.value as ModelType)}
          className="border rounded px-3 py-1 bg-black text-white"
        >
          <option value="lstm">LSTM</option>
          <option value="rf">Random Forest</option>
          <option value="gb">Gradient Boosting</option>
        </select>

        <select
          value={horizon}
          onChange={(e) => setHorizon(Number(e.target.value) as Horizon)}
          className="border rounded px-3 py-1 bg-black   text-white"
        >
          <option value={1}>1 Day</option>
          <option value={7}>7 Days</option>
          <option value={14}>14 Days</option>
        </select>

        <button
          onClick={runPredict}
          className="rounded bg-blue-600 px-4 py-1 text-white"
        >
          {loading ? "Predicting..." : "Predict"}
        </button>
      </div>

      {err && <div className="text-red-500">{err}</div>}

      {trend && signal && (
        <div className="rounded border p-4 text-white">
          <div className="text-sm opacity-70">Next {horizon} days</div>
          <div
            className={`text-3xl font-bold ${
              trend === "Bullish"
                ? "text-green-400"
                : trend === "Bearish"
                ? "text-red-400"
                : "text-yellow-300"
            }`}
          >
            {trend}
          </div>
          <div
            className={`text-3xl font-bold ${
              signal === "BUY"
                ? "text-green-400"
                : signal === "SELL"
                ? "text-red-400"
                : "text-yellow-300"
            }`}
          >
            {signal}
          </div>
          
        {/*     <div>
              Trend: <span className="font-bold">{trend}</span>{" "}
              {changePct !== null && (
                <span className="opacity-70">({changePct.toFixed(2)}%)</span>
              )}
            </div> */}
        </div>
      )}

      <div className="rounded-xl border w-[80%] mx-auto p-3">
        <div ref={chartRef} className="w-full h-[520px]" />
        <div className="text-xs text-white opacity-70 mt-2">
          Actual | 🔵 Past Prediction | 🟢 Future Prediction
        </div>
      </div>
    </div>
  );
}
