"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const price_service_1 = require("../services/price.service");
const router = (0, express_1.Router)();
router.get("/price", async (req, res) => {
    try {
        const symbol = String(req.query.symbol ?? "BTCUSDT");
        const interval = String(req.query.interval ?? "1d");
        const limit = Number(req.query.limit ?? 1);
        const candles = await (0, price_service_1.getKlines)({ symbol, interval, limit });
        res.json({ symbol, interval, candles });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
