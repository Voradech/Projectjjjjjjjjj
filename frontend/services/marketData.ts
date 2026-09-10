import axios from "axios";

const BINANCE_API = "https://api.binance.com/api/v3/klines";

export async function fetchActualCandles(params: {
  symbol: string;
  interval: string;
  limit: number;
}) {
  const res = await axios.get(BINANCE_API, {
    params,
  });

  return res.data.map((d: any[]) => ({
    time: Math.floor(d[0] / 1000),
    open: Number(d[1]),
    high: Number(d[2]),
    low: Number(d[3]),
    close: Number(d[4]),
    volume: Number(d[5]),
    quote_asset_volume: Number(d[7]),
    trades: Number(d[8]),
    taker_buy_base: Number(d[9]),
    taker_buy_quote: Number(d[10]),
    sentiment: 0,
  }));
}
