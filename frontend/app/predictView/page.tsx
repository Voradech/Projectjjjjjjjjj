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
import { fetchActualCandles, fetchLstmCompareSeries } from "@/services/compareLstm";

type ModelType = "rf" | "gb" | "lstm";
type Horizon = 1 | 7 | 14;

export default function PredictView() {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartApiRef = useRef<IChartApi | null>(null);

  //  เก็บ series reference
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const predSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const [model, setModel] = useState<ModelType>("lstm");
  const [horizon, setHorizon] = useState<Horizon>(1);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<number | null>(null);

  const query = useMemo(
    () => ({ symbol: "BTCUSDT", interval: "1d", limit: 220 }),
    []
  );

  // ---------- Chart init ----------
  useEffect(() => {
    if (!chartRef.current) return;

    const chart = createChart(chartRef.current, {
      height: 500,
      width: chartRef.current.clientWidth,
    });

    chartApiRef.current = chart;

    return () => {
      chart.remove();
      chartApiRef.current = null;
    };
  }, []);

  // ---------- Predict ----------
  const runPredict = async () => {
    try {
      setErr(null);
      setLoading(true);
      setResult(null);

      const candles = await fetchActualCandles(query);

      // ===== RF / GB =====
      if (model !== "lstm") {
        const res = await fetch(
          `http://localhost:8000/predict?model=${model}&horizon=${horizon}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...candles[candles.length - 1],
              sentiment: 0,
            }),
          }
        );

        const data = await res.json();
        setResult(data.predicted_close);
        return;
      }

      // ===== LSTM =====
      if (!chartApiRef.current) return;

      // ✅ ลบ series เก่าก่อน
      if (candleSeriesRef.current) {
        chartApiRef.current.removeSeries(candleSeriesRef.current);
        candleSeriesRef.current = null;
      }
      if (predSeriesRef.current) {
        chartApiRef.current.removeSeries(predSeriesRef.current);
        predSeriesRef.current = null;
      }

      // ✅ สร้าง series ใหม่
      candleSeriesRef.current = chartApiRef.current.addSeries(
        CandlestickSeries,
        {
          upColor: "#22c55e",
          downColor: "#ef4444",
          wickUpColor: "#22c55e",
          wickDownColor: "#ef4444",
          borderVisible: false,
        }
      );

      predSeriesRef.current = chartApiRef.current.addSeries(LineSeries, {
        color: "#1e40af",
        lineWidth: 2,
        lineStyle: 2,
      });

      const series = await fetchLstmCompareSeries(candles, horizon);

      candleSeriesRef.current.setData(
        candles.map((c) => ({
          time: Math.floor(c.time) as UTCTimestamp,
          open: +c.open,
          high: +c.high,
          low: +c.low,
          close: +c.close,
        }))
      );

      predSeriesRef.current.setData(
        series.map((d) => ({
          time: Math.floor(d.time) as UTCTimestamp,
          value: +d.predicted_close,
        }))
      );

      chartApiRef.current.timeScale().fitContent();
    } catch (e: any) {
      setErr(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  // ================== UI ==================
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">
        Bitcoin Prediction (Multi-Model)
      </h1>

      <div className="flex gap-4 items-center">
        <select
          value={model}
          onChange={(e) => setModel(e.target.value as ModelType)}
          className="border rounded px-3 py-1"
        >
          <option value="rf">Random Forest</option>
          <option value="gb">Gradient Boosting</option>
          <option value="lstm">LSTM</option>
        </select>

        <select
          value={horizon}
          onChange={(e) => {
            const value = e.target.value;
            if (value === "1") setHorizon(1);
            else if (value === "7") setHorizon(7);
            else setHorizon(14);
          }}
          className="border rounded px-3 py-1"
        />



        <button
          onClick={runPredict}
          className="rounded bg-blue-600 px-4 py-1 text-white"
        >
          {loading ? "Predicting..." : "Predict"}
        </button>
      </div>

      {err && <div className="text-red-600 text-sm">{err}</div>}

      {model !== "lstm" && result !== null && (
        <div className="rounded border p-4">
          <div className="text-sm opacity-70">
            Model: {model.toUpperCase()} | Horizon: t+{horizon}
          </div>
          <div className="text-2xl font-semibold">
            Predicted Close: {result.toFixed(2)} USD
          </div>
        </div>
      )}

      {model === "lstm" && (
        <div className="rounded-xl border p-3">
          <div ref={chartRef} className="w-full h-[500px]" />
          <div className="text-xs opacity-70 mt-2">
            Candlestick = Actual | Dashed Line = LSTM Prediction (t+{horizon})
          </div>
        </div>
      )}
    </div>
  );
}
