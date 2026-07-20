"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

export function TimePill() {
  const [time, setTime] = useState("");
  const [is24Hour, setIs24Hour] = useState(true);

  useEffect(() => {
    const updateTime = () => {
      setTime(
        new Intl.DateTimeFormat("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: !is24Hour,
        }).format(new Date()),
      );
    };

    updateTime();

    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, [is24Hour]);

  return (
    <button
      type="button"
      onClick={() => setIs24Hour((prev) => !prev)}
      className="inline-flex h-11 items-center gap-2.5 text-sm font-medium text-gray-700 transition-opacity hover:opacity-80"
      title={`Switch to ${is24Hour ? "12-hour" : "24-hour"} format`}
    >
      <Clock className="h-4 w-4 text-gray-500" />
      <span>{time}</span>
    </button>
  );
}
