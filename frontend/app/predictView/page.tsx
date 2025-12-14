"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createChart, IChartApi, LineSeries,UTCTimestamp } from "lightweight-charts";
import {
  fetchActualCandles,
  fetchLstmCompareSeries,
} from "@/services/compareLstm";

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
      height: 728,
      width: chartRef.current.clientWidth || 900,
    });
    chartApiRef.current = chart;

    // ✅ v5: addSeries(LineSeries)
    const actualSeries = chart.addSeries(LineSeries, { 
      title: "Actual",
      color: "#2563eb",     // น้ำเงิน (Actual)
      lineWidth: 2,
    });
    const predSeries = chart.addSeries(LineSeries, { 
      title: "LSTM",  
      color: "#f97316",     // ส้ม (LSTM)
    lineWidth: 2,
    lineStyle: 2,         // เส้นประ (ช่วยแยกชัด)
  }); 
    const run = async () => {
      try {
        setErr(null);
        setLoading(true);

        const candles = await fetchActualCandles(query);
        const series = await fetchLstmCompareSeries(candles);

        const actualData = series.map((d) => ({
          time: Math.floor(d.time) as UTCTimestamp,
          value: Number(d.actual_close),
        }));

        const predData = series.map((d) => ({
          time: Math.floor(d.time) as UTCTimestamp,
          value: Number(d.predicted_close),
        }));

        actualSeries.setData(actualData);
        predSeries.setData(predData);

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
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">LSTM vs Actual</h1>
        <div className="text-sm opacity-80">
          {loading ? "Loading..." : "Ready"}
        </div>
      </div>

      {err && (
        <div className="rounded-lg border p-3 text-sm text-red-600">{err}</div>
      )}

      <div className="rounded-xl border p-3">
        {/* ✅ ต้องมีความสูง/กว้างแน่นอน */}
        <div ref={chartRef} className="w-full h-[728px]" />
      </div>

      <div className="text-xs opacity-70">
        * เส้น 1 = Actual Close, เส้น 2 = LSTM Predicted Close
      </div>
    </div>
  );
}
