"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getKlines = void 0;
const express_1 = require("express");
const router = (0, express_1.Router)();
// ✅ 2. ใส่ return type Promise<Kline[]>
const getKlines = async ({ symbol = "BTCUSDT", interval = "1d", limit = 1, } = {}) => {
    const params = new URLSearchParams({
        symbol,
        interval,
        limit: String(Math.min(limit, 1000)),
    });
    const url = `https://api.binance.com/api/v3/klines?${params.toString()}`;
    const r = await fetch(url);
    if (!r.ok) {
        throw new Error("Binance error");
    }
    const data = await r.json();
    // ✅ 3. บอก type ของ k ให้ชัด
    return data.map((k) => ({
        time: Number(k[0]),
        open: Number(k[1]),
        high: Number(k[2]),
        low: Number(k[3]),
        close: Number(k[4]),
    }));
};
exports.getKlines = getKlines;
exports.default = router;
