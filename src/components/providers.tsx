"use client";

import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            classNames: {
              toast: "text-center justify-center",
              title: "text-center w-full",
              description: "text-center w-full",
            },
            style: {
              background: "var(--bg-card)",
              border: "1px solid var(--border-base)",
              color: "var(--text-primary)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-dropdown)",
            },
          }}
        />
      </QueryClientProvider>
    </SessionProvider>
  );
}
