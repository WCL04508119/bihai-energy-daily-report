import { useState } from 'react';
import { Loader2, Sparkles, TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Markdown } from '@/components/ui/markdown';
import { managerDashboardApi } from '@/api';
import type { ManagerDashboardQuery } from '@/api/manager-dashboard';
import { getApiErrorMessage } from '@/lib/api-error';
import { streamManagerAnalysis } from '@/lib/manager-analysis';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  MANAGER_ANALYSIS_DIMENSIONS,
  MANAGER_ANALYSIS_DIMENSION_LABELS,
  type ManagerAnalysisContext,
  type ManagerAnalysisDimension,
} from '@shared/api.interface';

const EXAMPLE_REQUIREMENTS: string[] = [
  '分析本期卡点最集中的部门和项目',
  '哪些项目推进滞后，原因是什么',
  '总结各部门完成情况并提出协调建议',
];

interface AiAnalysisPanelProps {
  params: ManagerDashboardQuery;
  hasData: boolean;
}

const AiAnalysisPanel: React.FC<AiAnalysisPanelProps> = ({
  params,
  hasData,
}) => {
  const [dimension, setDimension] =
    useState<ManagerAnalysisDimension>('all');
  const [requirement, setRequirement] = useState('');
  const [output, setOutput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async (): Promise<void> => {
    if (isGenerating || !hasData) return;
    setIsGenerating(true);
    setErrorMessage('');
    setOutput('');
    try {
      const context: ManagerAnalysisContext =
        await managerDashboardApi.getAnalysisContext(params);
      if (context.totals.reportCount === 0) {
        setErrorMessage('本期暂无日报数据，无法生成分析');
        return;
      }
      await streamManagerAnalysis({
        context,
        dimension,
        requirement: requirement.trim(),
        onProgress: (text: string) => setOutput(text),
      });
    } catch (error) {
      logger.error('管理者看板 AI 分析失败', error);
      const apiMessage: string = getApiErrorMessage(error, '');
      setErrorMessage(
        apiMessage ||
          (error instanceof Error ? error.message : '') ||
          'AI 分析失败，请稍后重试',
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="card-lift animate-fade-up border-primary/15">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-800">
                AI 分析
              </h2>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                基于本期日报数据，多维度分析卡点与完成情况；可填写关注点，也可直接自动生成
              </p>
            </div>
          </div>
          <ToggleGroup
            type="single"
            value={dimension}
            onValueChange={(value: string) => {
              if (!value) return;
              setDimension(value as ManagerAnalysisDimension);
            }}
            className="rounded-lg bg-slate-100 p-1"
          >
            {MANAGER_ANALYSIS_DIMENSIONS.map(
              (item: ManagerAnalysisDimension) => (
                <ToggleGroupItem
                  key={item}
                  value={item}
                  aria-label={MANAGER_ANALYSIS_DIMENSION_LABELS[item]}
                  className="px-3 text-sm data-[state=on]:bg-white data-[state=on]:text-primary"
                >
                  {MANAGER_ANALYSIS_DIMENSION_LABELS[item]}
                </ToggleGroupItem>
              ),
            )}
          </ToggleGroup>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex-1 space-y-1.5">
            <label
              htmlFor="manager-analysis-requirement"
              className="text-xs font-medium text-slate-500"
            >
              分析需求（选填）
            </label>
            <Textarea
              id="manager-analysis-requirement"
              rows={2}
              placeholder="例如：重点看热工室本周的卡点，哪些项目需要协调资源"
              value={requirement}
              onChange={(event) => setRequirement(event.target.value)}
            />
          </div>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !hasData}
            className="shrink-0"
          >
            {isGenerating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {isGenerating ? '分析中…' : '自动生成'}
          </Button>
        </div>

        {!hasData ? (
          <p className="text-xs text-slate-400">
            本期暂无日报数据，暂不能生成分析。
          </p>
        ) : null}

        {errorMessage ? (
          <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs leading-relaxed text-rose-700">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            <span className="break-words">{errorMessage}</span>
          </div>
        ) : null}

        {output ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
            <Markdown className="text-sm leading-relaxed text-slate-700">
              {output}
            </Markdown>
            {isGenerating ? (
              <p className="mt-2 animate-pulse text-xs text-slate-400">
                生成中…
              </p>
            ) : null}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 p-4">
            <p className="text-xs text-slate-500">可以试试这些分析需求：</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {EXAMPLE_REQUIREMENTS.map((text: string) => (
                <Button
                  key={text}
                  variant="outline"
                  size="sm"
                  className="text-xs font-normal"
                  onClick={() => setRequirement(text)}
                >
                  {text}
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AiAnalysisPanel;
