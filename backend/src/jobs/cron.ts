import cron from "node-cron";
import { checkAlerts } from "./checkAlerts";

// รันทุก 1 นาที
cron.schedule("* * * * *", async () => {
  await checkAlerts();
});