"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  IChartApi,
  LineSeries,
  CandlestickSeries,
  UTCTimestamp,
} from "lightweight-charts";
import { fetchActualCandles, fetchLstmCompareSeries } from "@/services/compareLstm";

export default function PredictView() {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartApiRef = useRef<IChartApi | null>(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const query = useMemo(
    () => ({ symbol: "BTCUSDT", interval: "1d", limit: 220 }),
    []
  );

  useEffect(() => {
    if (!chartRef.current) return;

    const chart = createChart(chartRef.current, {
      height: 550,
      width: chartRef.current.clientWidth || 800,
    });
    chartApiRef.current = chart;

    // ✅ Actual = Candlestick
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      borderVisible: false,
    });

    // ✅ LSTM = Line
    const predSeries = chart.addSeries(LineSeries, {
      title: "Predict Line",
      color: "#000080",
      lineWidth: 2,
      lineStyle: 2, // dashed
    });

    const run = async () => {
      try {
        setErr(null);
        setLoading(true);

        // 1) ดึง Actual candles (OHLCV)
        const candles = await fetchActualCandles(query);

        // 2) ส่งเข้า FastAPI เพื่อได้ predicted series
        const series = await fetchLstmCompareSeries(candles);

        // ✅ set candlestick (ใช้ candles จริง)
        candleSeries.setData(
          candles.map((c) => ({
            time: Math.floor(c.time) as UTCTimestamp,
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
          }))
        );

        // ✅ set LSTM line (ใช้ series ที่ได้กลับมา)
        predSeries.setData(
          series.map((d) => ({
            time: Math.floor(d.time) as UTCTimestamp,
            value: Number(d.predicted_close),
          }))
        );

        chart.timeScale().fitContent();
      } catch (e: any) {
        setErr(e?.message ?? "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    run();

    // ✅ resize on window resize
    const onResize = () => {
      if (!chartRef.current) return;
      chart.applyOptions({ width: chartRef.current.clientWidth });
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      chart.remove();
      chartApiRef.current = null;
    };
  }, [query]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">LSTM vs Actual (Candlestick)</h1>
        <div className="text-sm opacity-80">{loading ? "Loading..." : "Ready"}</div>
      </div>

      {err && (
        <div className="rounded-lg border p-3 text-sm text-red-600">{err}</div>
      )}

      <div className="rounded-xl border p-3">
        <div ref={chartRef} className="w-full h-[550px]" />
      </div>

      <div className="text-xs opacity-70 text-black">
        * แท่งเทียน = Actual (OHLC) , เส้นประ = LSTM Predicted Close
      </div>
    </div>
  );
}