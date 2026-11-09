import { capabilityClient } from '@lark-apaas/client-toolkit';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type { DailyReport } from '@shared/api.interface';
import {
  buildTemplatePrompt,
  parseTemplateNarrative,
  type TemplateNarrative,
} from '@/lib/report-template';

export const TEMPLATE_AI_PLUGIN_ID = 'bihai_smart_employee_daily_report_1';

type StreamChunk = Record<string, unknown>;

const isAsyncIterable = (value: unknown): value is AsyncIterable<StreamChunk> => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { [Symbol.asyncIterator]?: unknown };
  return typeof candidate[Symbol.asyncIterator] === 'function';
};

const normalizeStream = (resultOrStream: unknown): AsyncIterable<StreamChunk> => {
  if (isAsyncIterable(resultOrStream)) return resultOrStream;
  if (
    typeof resultOrStream === 'object' &&
    resultOrStream !== null &&
    'output' in resultOrStream
  ) {
    const output = (resultOrStream as { output?: unknown }).output;
    if (isAsyncIterable(output)) return output;
  }
  throw new Error('Invalid callStream result');
};

export async function generateTemplateNarrative(params: {
  period: 'week' | 'month';
  reports: DailyReport[];
  onProgress?: (text: string) => void;
}): Promise<TemplateNarrative> {
  const { period, reports, onProgress } = params;
  if (reports.length === 0) {
    return { summaryPoints: [], nextPlanRows: [] };
  }

  const prompt: string = buildTemplatePrompt(period, reports);
  const stream = capabilityClient
    .load(TEMPLATE_AI_PLUGIN_ID)
    .callStream('textGenerate', { prompt });

  let accumulated = '';
  for await (const chunk of normalizeStream(stream)) {
    const piece = typeof chunk.content === 'string' ? chunk.content : '';
    if (!piece) continue;
    accumulated += piece;
    onProgress?.(accumulated);
  }

  const narrative: TemplateNarrative | null =
    parseTemplateNarrative(accumulated);
  if (!narrative) {
    logger.error('模板叙述解析失败', accumulated.slice(0, 500));
    throw new Error('AI 返回内容无法解析，请重试');
  }
  return narrative;
}
