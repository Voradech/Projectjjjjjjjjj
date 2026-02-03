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

import { predictLSTM, predictTrend } from "@/services/prediction";
import { fetchActualCandles } from "@/services/marketData";

type ModelType = "rf" | "gb" | "lstm";
type Horizon = 1 | 7 | 14;

type Trend = "Bullish" | "Bearish" | "sideways";
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

  const [trend, setTrend] = useState<Trend | null>(null);
  const [signal, setSignal] = useState<Signal | null>(null);
  const [confidence, setConfidence] =
    useState<"HIGH" | "MEDIUM" | "LOW" | null>(null);

  const query = useMemo(
    () => ({ symbol: "BTCUSDT", interval: "1d", limit: 220 }),
    []
  );

  // ================= CHART INIT =================
  useEffect(() => {
    if (!chartRef.current) return;

    const chart = createChart(chartRef.current, {
      height: 520,
      width: chartRef.current.clientWidth || 900,
      layout: {
        background: { color: "#ffffff" },
        textColor: "#000000",
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

  // ================= PREDICT =================
  const runPredict = async () => {
    try {
      setLoading(true);
      setErr(null);
      setTrend(null);
      setSignal(null);
      setConfidence(null);

      const candles = await fetchActualCandles(query);
      if (!chartApiRef.current) return;

      // ----- ACTUAL PRICE -----
      if (actualSeriesRef.current) {
        chartApiRef.current.removeSeries(actualSeriesRef.current);
      }

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

      // ----- CLEAR OLD PREDICTION -----
      if (predictSeriesRef.current) {
        chartApiRef.current.removeSeries(predictSeriesRef.current);
        predictSeriesRef.current = null;
      }

      // ================= BACKEND =================
      let res: any;

      // ---------- LSTM ----------
      if (model === "lstm") {
        res = await predictLSTM(candles, horizon);

        predictSeriesRef.current = chartApiRef.current.addSeries(LineSeries, {
          color: "#22c55e",
          lineWidth: 2,
          lineStyle: 1, // dashed
        });

        if (res?.series) {
          const baseClose = Number(candles[candles.length - 1].close);

          const lineData = res.series.map((p: any) => ({
            time: p.time as UTCTimestamp,
            value: baseClose * (1 + p.predicted_return),
          }));


          predictSeriesRef.current.setData(lineData);
        }
      }

      // ---------- RF / GB ----------
      else {
        const MIN_HISTORY = 30;
        const recentCandles = candles.slice(-MIN_HISTORY);

        res = await predictTrend(recentCandles, model);
      }

      // ================= UI SIGNAL =================
      if (res?.trend) {
        const uiTrend =
          res.trend === "UP"
            ? "Bullish"
            : res.trend === "DOWN"
            ? "Bearish"
            : "sideways";

        setTrend(uiTrend);

        setSignal(
          res.trend === "UP"
            ? "BUY"
            : res.trend === "DOWN"
            ? "SELL"
            : "HOLD"
        );
      }

      if (res?.confidence) {
        setConfidence(res.confidence);
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
          className="border rounded px-3 py-1 bg-black text-white"
          disabled={model !== "lstm"}
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
          <div className="text-sm opacity-70">
            Next {model === "lstm" ? horizon : "1–14"} days
          </div>

          <div className="text-3xl font-bold">{trend}</div>
          <div className="text-3xl font-bold">{signal}</div>

          {confidence && (
            <div className="mt-2 text-sm opacity-80">
              Confidence: <span className="font-semibold">{confidence}</span>
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border w-[80%] mx-auto p-3">
        <div ref={chartRef} className="w-full h-[520px]" />
        <div className="text-xs text-white opacity-70 mt-2">
          Candlestick = Actual Price | Dashed Line = LSTM Forecast
        </div>
      </div>
    </div>
  );
}
