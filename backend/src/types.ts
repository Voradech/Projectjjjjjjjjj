// โครงสร้างข้อมูล kline/candlestick ของ Binance
export type BinanceKline = [
  number, // open time
  string, // open
  string, // high
  string, // low
  string, // close
  string, // volume
  number | string, // close time (บางทีเป็น number)
  string, // quote asset volume
  number, // number of trades
  string, // taker buy base asset volume
  string, // taker buy quote asset volume
  string  // ignore
];

export type PriceCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};
