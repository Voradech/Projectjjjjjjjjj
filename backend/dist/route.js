"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const router = express_1.default.Router();
router.get("/price", async (req, res) => {
    try {
        const symbol = req.query.symbol || "BTCUSDT";
        const interval = req.query.interval || "1d";
        const limit = Number(req.query.limit || 100);
        const url = `https://api.binance.com/api/v3/klines` +
            `?symbol=${encodeURIComponent(symbol)}` +
            `&interval=${encodeURIComponent(interval)}` +
            `&limit=${Number.isFinite(limit) ? limit : 100}`;
        const response = await (0, node_fetch_1.default)(url);
        if (!response.ok) {
            return res.status(502).json({
                error: "Binance API error",
                status: response.status
            });
        }
        const data = (await response.json());
        const formatted = data.map((item) => ({
            time: item[0],
            open: Number(item[1]),
            high: Number(item[2]),
            low: Number(item[3]),
            close: Number(item[4])
        }));
        return res.json({
            symbol,
            interval,
            limit,
            candles: formatted
        });
    }
    catch (err) {
        return res.status(500).json({
            error: "Failed to fetch price data"
        });
    }
});
exports.default = router;
