import cron from "node-cron";
import { checkAlerts } from "./checkAlerts";

// รันทุก 1 นาที
cron.schedule("* * * * *", async () => {
  console.log("⏱ Running alert check...");
  await checkAlerts();
});