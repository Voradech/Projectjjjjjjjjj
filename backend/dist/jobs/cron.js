"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_cron_1 = __importDefault(require("node-cron"));
const checkAlerts_1 = require("./checkAlerts");
// รันทุก 1 นาที
node_cron_1.default.schedule("* * * * *", async () => {
    console.log("⏱ Running alert check...");
    await (0, checkAlerts_1.checkAlerts)();
});
