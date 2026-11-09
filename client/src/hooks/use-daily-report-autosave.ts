import { useCallback, useEffect, useRef, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { logger } from '@lark-apaas/client-toolkit/logger';

interface DailyReportDraftSnapshot<TValues> {
  values: TValues;
  savedAt: string;
}

const STORAGE_KEY = 'bss:daily-report-autosave:v1';
const AUTOSAVE_DELAY = 800;

const readDailyReportDraft = <TValues,>(): DailyReportDraftSnapshot<TValues> | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DailyReportDraftSnapshot<TValues> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.values || typeof parsed.savedAt !== 'string') return null;
    return parsed;
  } catch (error) {
    logger.warn('读取日报草稿失败', error);
    return null;
  }
};

const writeDailyReportDraft = <TValues,>(values: TValues): string | null => {
  const savedAt = new Date().toISOString();
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ values, savedAt }),
    );
    return savedAt;
  } catch (error) {
    logger.warn('自动保存日报草稿失败', error);
    return null;
  }
};

export const clearDailyReportDraft = (): void => {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    logger.warn('清除日报草稿失败', error);
  }
};

interface UseDailyReportAutosaveOptions<TValues> {
  form: UseFormReturn<TValues>;
  enabled: boolean;
  hasContent: (values: TValues) => boolean;
  onRestore: (values: TValues) => void;
}

interface UseDailyReportAutosaveResult {
  savedAt: string | null;
  clearDraft: () => void;
}

export const useDailyReportAutosave = <TValues,>({
  form,
  enabled,
  hasContent,
  onRestore,
}: UseDailyReportAutosaveOptions<TValues>): UseDailyReportAutosaveResult => {
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const restoredRef = useRef(false);

  useEffect(() => {
    if (!enabled || restoredRef.current) return;
    restoredRef.current = true;
    const snapshot = readDailyReportDraft<TValues>();
    if (!snapshot || !hasContent(snapshot.values)) return;
    onRestore(snapshot.values);
    setSavedAt(snapshot.savedAt);
  }, [enabled, hasContent, onRestore]);

  useEffect(() => {
    if (!enabled) return;
    const subscription = form.watch(() => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        const current = form.getValues();
        if (!hasContent(current)) {
          clearDailyReportDraft();
          setSavedAt(null);
          return;
        }
        const timestamp = writeDailyReportDraft(current);
        if (timestamp) setSavedAt(timestamp);
      }, AUTOSAVE_DELAY);
    });
    return () => {
      subscription.unsubscribe();
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, form, hasContent]);

  const clearDraft = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    clearDailyReportDraft();
    setSavedAt(null);
  }, []);

  return { savedAt, clearDraft };
};
