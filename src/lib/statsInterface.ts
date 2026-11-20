import { Status } from "./types";

interface DashboardEntry {
  id: string;
  workDate: string;
  status: Status;
  shift: string;
  approvedTotalMinutes: number;
  normalMinutes: number;
  createdAt?: string;
  employee: { name: string; empId: string };
}

export interface DashboardStats {
  totalPending: number;
  totalApproved: number;
  totalRejected: number;
  todayEntries: number;
  weekEntries: number;
  lastWeekEntries: number;
  approvedThisWeek: number;
  totalEmployees: number;
  totalApprovedMinutes: number;
  pendingOldestHours: number | null;
  pendingStaleCount: number;
  recentEntries: DashboardEntry[];
  pendingQueue: DashboardEntry[];
  topEmployees: Array<{
    empId: string;
    name: string;
    totalMinutes: number;
    entries: number;
  }>;
  pendingByDay: Array<{ workDate: string; _count: { _all: number } }>;
  weekStart: string;
  weekEnd: string;
}
