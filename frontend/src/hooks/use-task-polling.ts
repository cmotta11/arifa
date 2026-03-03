import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";

interface TaskStatusResponse {
  status: "pending" | "running" | "completed" | "failed";
  data?: unknown;
  error?: string;
}

interface UseTaskPollingOptions {
  taskId: string | null;
  enabled?: boolean;
  interval?: number;
}

interface UseTaskPollingResult {
  status: TaskStatusResponse["status"] | null;
  data: unknown;
  isPolling: boolean;
  error: string | null;
}

export function useTaskPolling({
  taskId,
  enabled = true,
  interval = 2000,
}: UseTaskPollingOptions): UseTaskPollingResult {
  const [status, setStatus] = useState<TaskStatusResponse["status"] | null>(null);
  const [data, setData] = useState<unknown>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!taskId || !enabled) {
      setIsPolling(false);
      return;
    }

    const poll = async () => {
      try {
        const response = await api.get<TaskStatusResponse>(
          `/compliance/tasks/${taskId}/status/`,
        );
        setStatus(response.status);

        if (response.status === "completed") {
          setData(response.data ?? null);
          setIsPolling(false);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        } else if (response.status === "failed") {
          setError(response.error ?? "Task failed");
          setIsPolling(false);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Polling failed");
        setIsPolling(false);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    };

    setIsPolling(true);
    setError(null);
    setData(null);
    setStatus(null);

    // Initial poll immediately
    poll();

    // Then poll at interval
    intervalRef.current = setInterval(poll, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [taskId, enabled, interval]);

  return { status, data, isPolling, error };
}
