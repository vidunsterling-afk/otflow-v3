export interface DashboardStats {
  totalPending: number;
  totalApproved: number;
  totalRejected: number;
  todayEntries: number;
  weekEntries: number;
  totalEmployees: number;
  totalApprovedMinutes: number;
  recentEntries: Array<{
    id: string;
    workDate: string;
    status: string;
    shift: string;
    approvedTotalMinutes: number;
    normalMinutes: number;
    employee: { name: string; empId: string };
  }>;
  pendingByDay: Array<{ workDate: string; _count: { _all: number } }>;
  weekStart: string;
  weekEnd: string;
}
