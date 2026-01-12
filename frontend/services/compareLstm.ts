const API_URL = "http://localhost:8001";

export async function fetchActualCandles(query: {
  symbol: string;
  interval: string;
  limit: number;
}) {
  const res = await fetch(
    `https://api.binance.com/api/v3/klines?symbol=${query.symbol}&interval=${query.interval}&limit=${query.limit}`
  );

  const data = await res.json();

  return data.map((k: any) => ({
    time: Math.floor(k[0] / 1000),
    open: +k[1],
    high: +k[2],
    low: +k[3],
    close: +k[4],
    volume: +k[5],
    quote_asset_volume: +k[7],
    trades: +k[8],
    taker_buy_base: +k[9],
    taker_buy_quote: +k[10],
    sentiment: 0,
  }));
}

export async function fetchLstmCompareSeries(
  candles: any[],
  horizon: number
) {
  const res = await fetch(
    `${API_URL}/predict/lstm?horizon=${horizon}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(candles),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ML API failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.series;
}export async function fetchLstmRecursiveSeries(
  candles: any[],
  steps: number
) {
  const res = await fetch(
    `http://localhost:8001/predict/lstm/recursive?steps=${steps}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(candles),
    }
  );

  if (!res.ok) {
    throw new Error(await res.text());
  }

  const data = await res.json();
  return data.series;
}
