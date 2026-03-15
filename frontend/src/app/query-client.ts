import { MutationCache, QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api-client";
import { useToastStore } from "@/stores/toast-store";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
  mutationCache: new MutationCache({
    onError: (error) => {
      const message =
        error instanceof ApiError ? error.message : "Unknown error";
      useToastStore.getState().addToast(`Mutation failed: ${message}`, "error");
    },
  }),
});
