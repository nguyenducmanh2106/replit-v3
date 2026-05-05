import { createRootRoute, Outlet } from "@tanstack/react-router";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import "@/index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

export const Route = createRootRoute({
  component: RootLayout,
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "LMS",
      },
    ],
  }),
});

function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Outlet />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
