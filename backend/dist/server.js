"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = void 0;
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const admin_1 = __importDefault(require("./routes/admin"));
require("./jobs/cron");
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const price_1 = __importDefault(require("./routes/price"));
const auth_1 = require("./routes/auth");
const checkAlerts_1 = require("./jobs/checkAlerts");
const pool_1 = require("./db/pool");
const route_1 = __importDefault(require("./route"));
const alert_1 = __importDefault(require("./routes/alert"));
const news_1 = __importDefault(require("./routes/news"));
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
exports.io = new socket_io_1.Server(server, {
    cors: {
        origin: process.env.CORS_ORIGIN,
        credentials: true,
    },
});
exports.io.on("connection", (socket) => {
    console.log(" Client connected:", socket.id);
    socket.on("join", (userId) => {
        socket.join(`user_${userId}`);
        console.log("User joined room:", userId);
    });
    socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
    });
});
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
}));
app.use("/api/alerts", alert_1.default);
app.get("/test-alert", async (req, res) => {
    await (0, checkAlerts_1.checkAlerts)();
    res.json({ message: "Check executed" });
});
app.use("/route", route_1.default);
app.use("/auth", auth_1.authRouter);
app.use("/alerts", alert_1.default);
app.use("/api", price_1.default);
app.use("/api/admin", admin_1.default);
app.use("/api/news", news_1.default);
app.get("/", async (_req, res) => {
    try {
        const result = await pool_1.pool.query("SELECT NOW() as server_time");
        res.status(200).json({
            api: "running",
            database: {
                status: "ok",
                message: "Database connected",
                serverTime: result.rows[0].server_time,
            },
        });
    }
    catch (error) {
        res.status(500).json({
            api: "running",
            database: {
                status: "error",
                message: "Database connection failed",
                error: error.message,
            },
        });
    }
});
setInterval(() => {
    (0, checkAlerts_1.checkAlerts)().catch(console.error);
}, 10000);
server.listen(8000, () => {
    console.log("🚀 Backend running on port 8000");
});
