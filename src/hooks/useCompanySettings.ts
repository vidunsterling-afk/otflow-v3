"use client";

import { useQuery } from "@tanstack/react-query";

interface CompanySettings {
  logo: string | null;
  companyName: string;
}

export function useCompanySettings() {
  const { data, isLoading } = useQuery<CompanySettings>({
    queryKey: ["company-settings"],
    queryFn: () => fetch("/api/settings/logo").then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  return {
    logo: data?.logo ?? null,
    companyName: data?.companyName ?? "",
    isLoading,
  };
}
