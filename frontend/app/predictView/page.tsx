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

import { predictPrice } from "@/services/prediction";
import { fetchActualCandles } from "@/services/marketData";

type Horizon = 1 | 7 | 14;
type Trend = "Bullish" | "Bearish" | "sideways";
type Signal = "BUY" | "SELL" | "HOLD";
type Confidence = "HIGH" | "MEDIUM" | "LOW";

export default function PredictView() {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartApiRef = useRef<IChartApi | null>(null);
  const actualSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const predictSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const [horizon, setHorizon] = useState<Horizon>(1);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [trend, setTrend] = useState<Trend | null>(null);
  const [signal, setSignal] = useState<Signal | null>(null);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const query = useMemo(
    () => ({ symbol: "BTCUSDT", interval: "1d", limit: 220 }),
    [],
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
      crosshair: {
        vertLine: { visible: true },
        horzLine: { visible: true },
      },
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
      setSelectedModel(null);

      const candles = await fetchActualCandles(query);

      if (!chartApiRef.current) return;

      // ---------- ACTUAL PRICE ----------
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
        },
      );

      const sortedCandles = [...candles].sort((a, b) => a.time - b.time);

      actualSeriesRef.current.setData(
        sortedCandles.map((c: any) => ({
          time: c.time as UTCTimestamp,
          open: +c.open,
          high: +c.high,
          low: +c.low,
          close: +c.close,
        })),
      );

      // ---------- CLEAR OLD PREDICTION ----------
      if (predictSeriesRef.current) {
        chartApiRef.current.removeSeries(predictSeriesRef.current);
        predictSeriesRef.current = null;
      }

      // ================= BACKEND (AUTO MODEL) =================
      const res = await predictPrice(horizon);

      console.log("Last candle close:", candles[candles.length - 1].close);
      console.log("API current price:", res.prediction.current_price);
      console.log("API Response:", res);
      console.log("Direction:", res.prediction.direction);
      console.log("Predicted Price:", res.prediction.predicted_price);
      console.log("Predicted Return:", res.prediction.predicted_return);

      setSelectedModel(res.best_model);

      predictSeriesRef.current = chartApiRef.current.addSeries(LineSeries, {
        color: "#2563eb",
        lineWidth: 2,
        lineStyle: 1, // dashed
      });
      const lastCandle = sortedCandles[sortedCandles.length - 1];

      const startTime = Math.floor(
        new Date(res.prediction.current_date).getTime() / 1000,
      ) as UTCTimestamp;

      const endTime = Math.floor(
        new Date(res.prediction.predicted_date).getTime() / 1000,
      ) as UTCTimestamp;
      predictSeriesRef.current.setData([
        {
          time: startTime,
          value: res.prediction.current_price,
        },
        {
          time: endTime,
          value: res.prediction.predicted_price,
        },
      ]);

      console.log("=== Prediction Line Debug ===");
      console.log(
        "Start:",
        new Date(startTime * 1000).toISOString(),
        res.prediction.current_price,
      );
      console.log(
        "End:",
        new Date(endTime * 1000).toISOString(),
        res.prediction.predicted_price,
      );
      const direction = res.prediction.direction;

      setTrend(
        direction === "UP"
          ? "Bullish"
          : direction === "DOWN"
            ? "Bearish"
            : "sideways",
      );

      setSignal(
        direction === "UP" ? "BUY" : direction === "DOWN" ? "SELL" : "HOLD",
      );

      // ---------- CONFIDENCE (FROM METRICS) ----------
      const acc = res.model_metrics.direction_accuracy;
      if (acc >= 0.55) setConfidence("HIGH");
      else if (acc >= 0.52) setConfidence("MEDIUM");
      else setConfidence("LOW");

      chartApiRef.current.timeScale().fitContent();
    } catch (e: any) {
      setErr(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  };
  const trendTH: Record<Trend, string> = {
  Bullish: "ขาขึ้น",
  Bearish: "ขาลง",
  sideways: "Sideway / แกว่งตัว",
};

const signalTH: Record<Signal, string> = {
  BUY: "ซื้อ",
  SELL: "ขาย",
  HOLD: "ถือรอ",
};

const confidenceTH: Record<Confidence, string> = {
  HIGH: "สูง",
  MEDIUM: "ปานกลาง",
  LOW: "ต่ำ",
};
  // ================= UI =================
  return (
    <div className="min-h-screen p-6 text-white space-y-6 py-14">
      {/* ================= HEADER ================= */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">Bitcoin Trend Prediction</h1>  
      </div>

      {/* ================= CONTROL ================= */}
      <div className="flex flex-wrap gap-4 items-center bg-zinc-900 border border-zinc-800 rounded-xl p-4 ">
        <div className="flex items-center gap-2">
          <span className="text-sm opacity-70">Prediction</span>
          <select
            value={horizon}
            onChange={(e) => setHorizon(Number(e.target.value) as Horizon)}
            className="rounded bg-black border border-zinc-700 px-3 py-1"
          >
            <option value={1}>1 Day</option>
            <option value={7}>7 Days</option>
            <option value={14}>14 Days</option>
          </select>
        </div>

        <button
          onClick={runPredict}
          disabled={loading}
          className="ml-auto rounded-lg bg-blue-600 hover:bg-blue-500 px-5 py-2 font-semibold disabled:opacity-50"
        >
          {loading ? "Predicting..." : " Prediction "}
        </button>
      </div>

      {err && (
        <div className="rounded-lg bg-red-500/10 border border-red-500 text-red-400 p-3">
          {err}
        </div>
      )}

      {/* ================= RESULT ================= */}
      {trend && signal && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5">
            <div className="text-sm opacity-60">Market Trend</div>
            <div className="text-3xl font-bold mt-1">{trend ? trendTH[trend] : "-"}</div>
          </div>

          <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5">
            <div className="text-sm opacity-60">Trading Signal</div>
            <div
              className={`text-3xl font-bold mt-1 ${
                signal === "BUY"
                  ? "text-green-400"
                  : signal === "SELL"
                    ? "text-red-400"
                    : "text-zinc-300"
              }`}
            >
              {signal ? signalTH[signal] : "-"}
            </div>
          </div>

          <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5 space-y-2">
            <div className="text-sm opacity-60">Next {horizon} day(s)</div>
     
{/* 
            {confidence && (
              <span
                className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                  confidence === "HIGH"
                    ? "bg-green-500/20 text-green-400"
                    : confidence === "MEDIUM"
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-zinc-500/20 text-zinc-300"
                }`}
              >
                Confidence: {confidence}
              </span>
            )} */}
          </div>
        </div>
      )}

      {/* ================= CHART ================= */}
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
        <div ref={chartRef} className="w-full h-[520px]" />
        <div className="text-xs opacity-60 mt-2">
          Candlestick = Actual Price | Dashed Line = Auto-selected Model
          Forecast
        </div>
      </div>
    </div>
  );
}
