"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const rss_parser_1 = __importDefault(require("rss-parser"));
const router = (0, express_1.Router)();
const parser = new rss_parser_1.default({ timeout: 5000 });
router.get("/", async (req, res) => {
    try {
        const limit = Number(req.query.limit) || 20;
        const feeds = [
            {
                source: "CoinDesk",
                url: "https://www.coindesk.com/arc/outboundfeeds/rss/",
            },
            {
                source: "Cointelegraph",
                url: "https://cointelegraph.com/rss",
            },
        ];
        let items = [];
        for (const f of feeds) {
            try {
                const feed = await parser.parseURL(f.url);
                const mapped = (feed.items || []).map((it) => ({
                    title: it.title || "",
                    url: it.link || "",
                    source: f.source,
                    publishedAt: new Date(it.isoDate || it.pubDate || 0),
                }));
                items = items.concat(mapped);
            }
            catch (err) {
                console.error("RSS error:", f.source);
            }
        }
        // ✅ sort newest first
        items.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
        return res.json({
            items: items.slice(0, limit),
        });
    }
    catch (err) {
        console.error("News API error:", err);
        return res.status(500).json({ items: [] });
    }
});
exports.default = router;
