import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMinutes(minutes: number): string {
  if (minutes === 0) return "0h 0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function getDayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
}

export function getWeekDates(referenceDate?: Date): string[] {
  const d = referenceDate ? new Date(referenceDate) : new Date();
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return date.toISOString().split("T")[0];
  });
}

export function getStatusColor(status: string) {
  switch (status) {
    case "APPROVED":
      return {
        bg: "var(--status-approved-bg)",
        text: "var(--status-approved-text)",
        border: "var(--status-approved-border)",
      };
    case "REJECTED":
      return {
        bg: "var(--status-rejected-bg)",
        text: "var(--status-rejected-text)",
        border: "var(--status-rejected-border)",
      };
    default:
      return {
        bg: "var(--status-pending-bg)",
        text: "var(--status-pending-text)",
        border: "var(--status-pending-border)",
      };
  }
}
