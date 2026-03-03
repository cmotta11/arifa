import { useCallback, useEffect, useRef, useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";

interface UseAutoSaveOptions<T> {
  data: T;
  onSave: (data: T) => void;
  delay?: number;
  enabled?: boolean;
}

interface UseAutoSaveResult {
  isSaving: boolean;
  lastSavedAt: Date | null;
  triggerSave: () => void;
}

export function useAutoSave<T>({
  data,
  onSave,
  delay = 1000,
  enabled = true,
}: UseAutoSaveOptions<T>): UseAutoSaveResult {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const debouncedData = useDebounce(data, delay);
  const previousDataRef = useRef<string>("");
  const onSaveRef = useRef(onSave);
  const isFirstRender = useRef(true);

  // Keep onSave ref current to avoid stale closures
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  // Auto-save when debounced data changes
  useEffect(() => {
    if (!enabled) return;

    // Skip the first render to avoid saving initial data
    if (isFirstRender.current) {
      isFirstRender.current = false;
      previousDataRef.current = JSON.stringify(debouncedData);
      return;
    }

    const serialized = JSON.stringify(debouncedData);
    if (serialized === previousDataRef.current) return;

    previousDataRef.current = serialized;
    setIsSaving(true);

    try {
      onSaveRef.current(debouncedData);
      setLastSavedAt(new Date());
    } finally {
      // Small delay to show saving indicator
      setTimeout(() => setIsSaving(false), 300);
    }
  }, [debouncedData, enabled]);

  const triggerSave = useCallback(() => {
    if (!enabled) return;
    setIsSaving(true);
    try {
      onSaveRef.current(data);
      setLastSavedAt(new Date());
    } finally {
      setTimeout(() => setIsSaving(false), 300);
    }
  }, [data, enabled]);

  return { isSaving, lastSavedAt, triggerSave };
}
