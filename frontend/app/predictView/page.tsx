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
import {
  fetchActualCandles,
  fetchLstmRecursiveSeries,
} from "@/services/compareLstm";

type ModelType = "rf" | "gb" | "lstm";
type Horizon = 1 | 7 | 14;

type Trend = "bullish" | "bearish" | "sideways";
type Signal = "BUY" | "SELL" | "HOLD";

export default function PredictView() {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartApiRef = useRef<IChartApi | null>(null);

  const actualSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const predictSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const [model, setModel] = useState<ModelType>("lstm");
  const [horizon, setHorizon] = useState<Horizon>(1);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ---- Decision result ----
  const [trend, setTrend] = useState<Trend | null>(null);
  const [signal, setSignal] = useState<Signal | null>(null);
  const [changePct, setChangePct] = useState<number | null>(null);

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
    return () => chart.remove();
  }, []);

  // ---------- Helper: calculate trend ----------
  const calcTrend = (lastClose: number, futureClose: number) => {
    const pct = ((futureClose - lastClose) / lastClose) * 100;
    setChangePct(pct);

    if (pct > 2) {
      setTrend("bullish");
      setSignal("BUY");
    } else if (pct > 0.5) {
      setTrend("bullish");
      setSignal("HOLD");
    } else if (pct < -2) {
      setTrend("bearish");
      setSignal("SELL");
    } else if (pct < -0.5) {
      setTrend("bearish");
      setSignal("HOLD");
    } else {
      setTrend("sideways");
      setSignal("HOLD");
    }
  };

  // ---------- Predict ----------
  const runPredict = async () => {
    try {
      setErr(null);
      setLoading(true);
      setTrend(null);
      setSignal(null);
      setChangePct(null);

      const candles = await fetchActualCandles(query);
      if (!chartApiRef.current) return;

      const lastClose = candles[candles.length - 1].close;

      // reset series
      if (actualSeriesRef.current)
        chartApiRef.current.removeSeries(actualSeriesRef.current);
      if (predictSeriesRef.current)
        chartApiRef.current.removeSeries(predictSeriesRef.current);

      // ----- Actual candlestick -----
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

      // ----- Prediction line -----
      predictSeriesRef.current = chartApiRef.current.addSeries(LineSeries, {
        lineWidth: 2,
      });

      // ===== RF / GB =====
      if (model !== "lstm") {
        const res = await fetch(
          `http://localhost:8001/predict?model=${model}&horizon=${horizon}`,
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
        const futureClose = data.predicted_close;

        const nextTime =
          (candles[candles.length - 1].time + 86400) as UTCTimestamp;

        predictSeriesRef.current.setData([
          { time: nextTime, value: futureClose },
        ]);

        calcTrend(lastClose, futureClose);
        chartApiRef.current.timeScale().fitContent();
        return;
      }

      // ===== LSTM (recursive multi-step) =====
      const series = await fetchLstmRecursiveSeries(candles, horizon);

      predictSeriesRef.current.setData(
        series.map((d: any) => ({
          time: d.time as UTCTimestamp,
          value: d.predicted_close,
        }))
      );

      const futureClose = series[series.length - 1].predicted_close;
      calcTrend(lastClose, futureClose);

      chartApiRef.current.timeScale().fitContent();
    } catch (e: any) {
      setErr(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  // ================= UI =================
  return (
    <div className="p-4 space-y-4">
      <h1 className="pt-10 text-xl font-semibold text-white">
        Bitcoin Trend Prediction (Decision Support)
      </h1>

      <div className="flex gap-4 items-center pr-2">
        <select
          value={model}
          onChange={(e) => setModel(e.target.value as ModelType)}
          className="border border-white text-white rounded px-3 py-1"
        >
          <option value="rf">Random Forest</option>
          <option value="gb">Gradient Boosting</option>
          <option value="lstm">LSTM</option>
        </select>

        <select
          value={horizon}
          onChange={(e) => setHorizon(Number(e.target.value) as Horizon)}
          className="border rounded px-3 py-1 border-white text-white"
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

      {err && <div className="text-red-600 text-sm">{err}</div>}

      {/* ---- Trend Result ---- */}
      {trend && signal && changePct !== null && (
        <div className="rounded border p-4 text-white">
          <div className="text-sm opacity-70">
             Next {horizon} days
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

          <div className="mt-1">
            Trend: <span className="capitalize font-semibold font-bold">{trend}</span>
          </div>
        </div>
      )}

      <div className="rounded-xl border p-3 w-[80%] mx-auto">
        <div ref={chartRef} className="w-full h-[500px]" />
        <div className="text-xs opacity-70 mt-2">
          Candlestick = Actual | Line = Forecasted Trend
        </div>
      </div>
    </div>
  );
}
