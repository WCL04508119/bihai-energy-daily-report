import {
  isTaskSource,
  type DailyCompletionRow,
  type TaskSource,
} from '@shared/api.interface';

export interface DailyDraftTask {
  taskSource: TaskSource;
  taskName: string;
  completionRows: DailyCompletionRow[];
  outputFileCount?: string;
  assistanceNeeded?: string;
}

export interface ExtractedDraft {
  body: string;
  tasks: DailyDraftTask[];
}

const DRAFT_STORAGE_KEY = 'bss:daily-report-draft';
export const APPLY_DAILY_DRAFT_EVENT = 'bss:apply-daily-draft';
export const OPEN_AI_EMPLOYEE_EVENT = 'bss:open-ai-employee';

export interface ApplyDailyDraftDetail {
  task?: DailyDraftTask;
}

let pendingDraft: DailyDraftTask | null = null;

const JSON_BLOCK_PATTERN = /```json\s*([\s\S]*?)```/iu;
const JSON_BLOCK_START = /```json/iu;

const asText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const asTextArray = (value: unknown): string[] | undefined => {
  if (Array.isArray(value)) {
    const items = value
      .filter((item): item is string => typeof item === 'string')
      .map((item: string) => item.trim())
      .filter((item: string) => item.length > 0);
    return items.length > 0 ? items : undefined;
  }
  const single = asText(value);
  return single ? [single] : undefined;
};

const toCompletionRow = (raw: unknown): DailyCompletionRow => {
  const record = (raw && typeof raw === 'object' ? raw : {}) as Record<
    string,
    unknown
  >;
  return {
    projectNames: asTextArray(record.projectNames) ?? [],
    projectCodes: asTextArray(record.projectCodes) ?? [],
    completion: asText(record.completion) ?? '',
  };
};

const toCompletionRows = (
  record: Record<string, unknown>,
): DailyCompletionRow[] => {
  const rawRows = Array.isArray(record.completionRows) ? record.completionRows : [];
  const rows = rawRows.map((item: unknown) => toCompletionRow(item));
  if (rows.length > 0) return rows;
  const legacyRow = toCompletionRow({
    projectNames: record.projectName,
    projectCodes: record.projectCode,
    completion: record.dayCompletion,
  });
  return [legacyRow];
};

const toDraftTask = (raw: unknown): DailyDraftTask | null => {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const taskName = asText(record.taskName);
  if (!taskName) return null;
  const source = asText(record.taskSource) ?? '';
  return {
    taskName,
    taskSource: isTaskSource(source) ? source : '项目任务',
    completionRows: toCompletionRows(record),
    outputFileCount: asText(record.outputFileCount),
    assistanceNeeded: asText(record.assistanceNeeded),
  };
};

export const stripJsonBlock = (text: string): string => {
  const index = text.search(JSON_BLOCK_START);
  return index >= 0 ? text.slice(0, index).trimEnd() : text.trim();
};

export const extractDraft = (text: string): ExtractedDraft => {
  const match = text.match(JSON_BLOCK_PATTERN);
  if (!match || match.index === undefined) {
    return { body: text.trim(), tasks: [] };
  }
  const body = (
    text.slice(0, match.index) + text.slice(match.index + match[0].length)
  ).trim();
  try {
    const parsed = JSON.parse(match[1]) as { tasks?: unknown };
    const list = Array.isArray(parsed.tasks) ? parsed.tasks : [];
    const tasks = list
      .map((item: unknown) => toDraftTask(item))
      .filter((item: DailyDraftTask | null): item is DailyDraftTask => item !== null);
    return { body, tasks };
  } catch {
    return { body: text.trim(), tasks: [] };
  }
};

export const saveDailyDraft = (task: DailyDraftTask): void => {
  pendingDraft = task;
  try {
    sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(task));
  } catch {
    // sessionStorage 不可用时靠内存副本传递，忽略即可
  }
};

export const popDailyDraft = (): DailyDraftTask | null => {
  const memoryDraft = pendingDraft;
  pendingDraft = null;
  if (memoryDraft) {
    try {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // 忽略：内存副本已取到
    }
    return memoryDraft;
  }
  try {
    const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    return toDraftTask(JSON.parse(raw));
  } catch {
    return null;
  }
};
