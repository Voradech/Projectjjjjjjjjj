"use client";

import { useEffect } from "react";
import { socket } from "@/lib/socket";

type Props = {
  userId: number;
  onNewNotification: (data: any) => void;
};

export default function NotificationProvider({
  userId,
  onNewNotification,
}: Props) {

  useEffect(() => {
    socket.emit("join", userId);

    socket.on("new_notification", (data: any) => {
      console.log("🔔 Realtime:", data);
      onNewNotification(data);
    });

    return () => {
      socket.off("new_notification");
    };
  }, [userId]);

  return null;
}