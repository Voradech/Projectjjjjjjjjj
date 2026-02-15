"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  IChartApi,
  LineSeries,
  CandlestickSeries,
  UTCTimestamp,
  ISeriesApi,
  ColorType,
} from "lightweight-charts";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Zap, 
  Clock, 
  BarChart2, 
  BrainCircuit, 
  Loader2, 
  Search 
} from "lucide-react";

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
  const backtestSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const [trend, setTrend] = useState<Trend | null>(null);
  const [signal, setSignal] = useState<Signal | null>(null);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const query = useMemo(
    () => ({ symbol: "BTCUSDT", interval: "1d", limit: 220 }),
    []
  );

  // ================= CHART INIT (THEMED) =================
  useEffect(() => {
    if (!chartRef.current) return;

    const chart = createChart(chartRef.current, {
      height: 500,
      width: chartRef.current.clientWidth,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" }, // Transparent background
        textColor: "#94a3b8", // Slate-400
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.05)" },
        horzLines: { color: "rgba(255, 255, 255, 0.05)" },
      },
      rightPriceScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
      },
      timeScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
        timeVisible: true,
      },
      crosshair: {
        vertLine: {
          color: "#818cf8",
          width: 1,
          style: 1,
          labelBackgroundColor: "#818cf8",
        },
        horzLine: {
          color: "#818cf8",
          width: 1,
          style: 1,
          labelBackgroundColor: "#818cf8",
        },
      },
    });

    chartApiRef.current = chart;

    // Responsive Chart
    const handleResize = () => {
      if (chartRef.current) {
        chart.applyOptions({ width: chartRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, []);

  // ================= PREDICT LOGIC (UNCHANGED) =================
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
          upColor: "#10b981", // Emerald-500
          downColor: "#ef4444", // Red-500
          wickUpColor: "#10b981",
          wickDownColor: "#ef4444",
          borderVisible: false,
        }
      );

      const sortedCandles = [...candles].sort((a, b) => a.time - b.time);

      actualSeriesRef.current.setData(
        sortedCandles.map((c: any) => ({
          time: c.time as UTCTimestamp,
          open: +c.open,
          high: +c.high,
          low: +c.low,
          close: +c.close,
        }))
      );

      // ---------- CLEAR OLD PREDICTION ----------
      if (predictSeriesRef.current) {
        chartApiRef.current.removeSeries(predictSeriesRef.current);
        predictSeriesRef.current = null;
      }

      // ================= BACKEND (AUTO MODEL) =================
      const res = await predictPrice(horizon);
      setSelectedModel(res.best_model);
      // ================= BACKTEST (ย้อนหลัง 30 วัน) =================

// ลบเส้นเก่าก่อน
    if (backtestSeriesRef.current) {
      chartApiRef.current.removeSeries(backtestSeriesRef.current);
      backtestSeriesRef.current = null;
    } 

    const backtestData = (res.backtest_series ?? []).map((p: any) => ({
      time: Math.floor(new Date(p.date).getTime() / 1000) as UTCTimestamp,
      value: p.price,
    }));
    backtestSeriesRef.current = chartApiRef.current.addSeries(LineSeries, {
      color: "#facc15", // สีเหลือง
      lineWidth: 2,
    });

    backtestSeriesRef.current.setData(backtestData);

    // เอาเส้นราคาด้านขวาออกให้ดูสะอาด
    backtestSeriesRef.current.applyOptions({
      priceLineVisible: false,
    });

      predictSeriesRef.current = chartApiRef.current.addSeries(LineSeries, {
        color: "#3b82f6", // Blue-500
        lineWidth: 2,
        crosshairMarkerVisible: true,
      });
      
      const startTime = Math.floor(
        new Date(res.prediction.current_date).getTime() / 1000
      ) as UTCTimestamp;

      const endTime = Math.floor(
        new Date(res.prediction.predicted_date).getTime() / 1000
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

      const direction = res.prediction.direction;

      setTrend(
        direction === "UP"
          ? "Bullish"
          : direction === "DOWN"
            ? "Bearish"
            : "sideways"
      );

      setSignal(
        direction === "UP" ? "BUY" : direction === "DOWN" ? "SELL" : "HOLD"
      );

      // ---------- CONFIDENCE ----------
      const acc = res.model_metrics.direction_accuracy;
      if (acc >= 0.55) setConfidence("HIGH");
      else if (acc >= 0.52) setConfidence("MEDIUM");
      else setConfidence("LOW");

      const dataLen = sortedCandles.length;
      chartApiRef.current.timeScale().setVisibleLogicalRange({
        from: dataLen - 10,         
        to: dataLen + horizon + 5,    
      });
      
    } catch (e: any) {
    
      setErr(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const trendTH: Record<Trend, string> = {
    Bullish: "แนวโน้มขาขึ้น",
    Bearish: "แนวโน้มขาลง",
    sideways: "Sideway / แกว่งตัว",
  };

  const signalTH: Record<Signal, string> = {
    BUY: "ซื้อ (BUY)",
    SELL: "ขาย (SELL)",
    HOLD: "ถือรอ (HOLD)",
  };

  const trendIcon = {
    Bullish: <TrendingUp className="text-emerald-400" size={32} />,
    Bearish: <TrendingDown className="text-red-400" size={32} />,
    sideways: <Minus className="text-gray-400" size={32} />,
  };

  // ================= UI RENDER =================
  return (
    <div className="relative min-h-screen bg-[#020617] text-white p-6 md:p-12 overflow-hidden font-sans">
      
      {/* Background Effects */}
      <div className="absolute w-[600px] h-[600px] bg-indigo-500/10 blur-3xl rounded-full top-[-100px] left-[-100px] pointer-events-none" />
      <div className="absolute w-[500px] h-[500px] bg-emerald-500/10 blur-3xl rounded-full bottom-0 right-0 pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <BrainCircuit className="text-emerald-400" size={32} />
              <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                Bitcoin Predictor
              </span>
            </h1>
            <p className="text-gray-400 text-sm mt-1 ml-1">
              วิเคราะห์แนวโน้มราคา Bitcoin ด้วย Machine Learning
            </p>
          </div>
        </header>

        {/* Control Bar */}
        <div className="flex flex-wrap gap-4 items-center bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center gap-3 px-2">
            <Clock className="text-emerald-400" size={20} />
            <span className="text-sm font-medium text-gray-300">ระยะเวลาคาดการณ์ (Horizon):</span>
          </div>
          
          <div className="relative">
            <select
              value={horizon}
              onChange={(e) => setHorizon(Number(e.target.value) as Horizon)}
              className="appearance-none bg-[#0B1120] border border-white/10 text-white rounded-lg pl-4 pr-10 py-2.5 hover:border-emerald-500/50 focus:border-emerald-400 focus:outline-none transition cursor-pointer"
            >
              <option value={1}>1 วัน (Day)</option>
              <option value={7}>7 วัน (Week)</option>
              <option value={14}>14 วัน (2 Weeks)</option>
            </select>
            {/* Custom Arrow */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </div>

          <button
            onClick={runPredict}
            disabled={loading}
            className="ml-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-2.5 px-6 rounded-lg transition-all shadow-lg hover:shadow-blue-500/20 flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed transform active:scale-95"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
            {loading ? "กำลังวิเคราะห์..." : "เริ่มวิเคราะห์ (Predict)"}
          </button>
        </div>

        {/* Error Message */}
        {err && (
          <div className="animate-in fade-in slide-in-from-top-2 rounded-xl bg-red-500/10 border border-red-500/50 text-red-200 p-4 flex items-center gap-3">
             <div className="bg-red-500/20 p-2 rounded-full"><TrendingDown size={20} /></div>
             {err}
          </div>
        )}

        {/* Results Grid */}
        {trend && signal && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Card 1: Trend */}
            <div className="bg-white/[0.05] backdrop-blur-xl border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:border-emerald-500/30 transition-all">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <BarChart2 size={80} />
              </div>
              <div className="text-sm text-gray-400 mb-2">แนวโน้มตลาด (Trend)</div>
              <div className={`text-2xl font-bold flex items-center gap-2 ${
                  trend === 'Bullish' ? 'text-emerald-400' : trend === 'Bearish' ? 'text-red-400' : 'text-gray-300'
              }`}>
                 {trendIcon[trend]}
                 {trendTH[trend]}
              </div>
            </div>

            {/* Card 2: Signal */}
            <div className="bg-white/[0.05] backdrop-blur-xl border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:border-emerald-500/30 transition-all">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Zap size={80} />
              </div>
              <div className="text-sm text-gray-400 mb-2">สัญญาณการเทรด (Signal)</div>
              <div className={`text-3xl font-extrabold flex items-center gap-2 ${
                  signal === "BUY" ? "text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]" 
                  : signal === "SELL" ? "text-red-400 drop-shadow-[0_0_10px_rgba(248,113,113,0.3)]" 
                  : "text-gray-300"
              }`}>
                 {signalTH[signal]}
              </div>
            </div>

            {/* Card 3: Model Info */}
            <div className="bg-white/[0.05] backdrop-blur-xl border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:border-emerald-500/30 transition-all">
               <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <BrainCircuit size={80} />
              </div>
              <div className="text-sm text-gray-400 mb-2">โมเดลที่ใช้ & ระยะเวลา</div>
           
              <div className="text-sm text-indigo-300 mt-1">
                 Next {horizon} Day(s) Forecast
              </div>
            </div>
          </div>
        )}

        {/* Chart Container */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-1 shadow-2xl">
          <div className="bg-[#0B1120]/50 rounded-xl p-4">
             <div className="flex items-center justify-between mb-4 px-2">
                <h3 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
                  <Search size={18} className="text-gray-500" />
                  Price Chart & Forecast
                </h3>
                <div className="flex gap-4 text-xs">
                   <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                      <span className="text-gray-400">ราคาจริง (Actual)</span>
                   </div>
                   <div className="flex items-center gap-1.5">
                      <div className="w-6 h-0.5 border-t-2 border-dashed border-blue-500"></div>
                      <span className="text-gray-400">ทำนาย (Predicted)</span>
                   </div>
                </div>
             </div>
             
             {/* Chart Element */}
             <div ref={chartRef} className="w-full h-[500px] rounded-lg overflow-hidden" />
          </div>
        </div>

      </div>
    </div>
  );
}