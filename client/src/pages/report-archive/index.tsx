import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Eye,
  Trash2,
} from 'lucide-react';
import dayjs from 'dayjs';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';
import EnergyHero from '@/components/brand/EnergyHero';
import { Image } from '@/components/ui/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DocxDocumentPreview } from '@/components/report/DocxDocumentPreview';
import { reportDocumentApi } from '@/api';
import { getApiErrorMessage } from '@/lib/api-error';
import { downloadFileByUrl } from '@/utils/download-file';
import aiAvatarUrl from '@/assets/ai-assistant.png';
import {
  REPORT_DOCUMENT_TYPES,
  REPORT_DOCUMENT_TYPE_LABELS,
  isReportDocumentType,
  type ReportDocument,
  type ReportDocumentListQuery,
  type ReportDocumentType,
} from '@shared/api.interface';
const PAGE_SIZE = 20;

const ALL_TYPES_VALUE = 'all';

const TYPE_BADGE_CLASS: Record<ReportDocumentType, string> = {
  weekly: 'border-sky-200 bg-sky-50 text-sky-700',
  monthly: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  'department-weekly': 'border-amber-200 bg-amber-50 text-amber-700',
  'department-monthly': 'border-primary/20 bg-primary/[0.07] text-primary',
};

const ReportArchivePage: React.FC = () => {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<string>(ALL_TYPES_VALUE);
  const [page, setPage] = useState(1);
  const [previewItem, setPreviewItem] = useState<ReportDocument | null>(null);

  const query: ReportDocumentListQuery = useMemo(() => {
    const next: ReportDocumentListQuery = { page, pageSize: PAGE_SIZE };
    if (isReportDocumentType(typeFilter)) {
      next.reportType = typeFilter;
    }
    return next;
  }, [typeFilter, page]);

  const { data, isLoading } = useQuery({
    queryKey: ['report-documents', query],
    queryFn: () => reportDocumentApi.getReportDocuments(query),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => reportDocumentApi.deleteReportDocument(id),
    retry: false,
    onSuccess: () => {
      toast.success('已删除该导出记录');
      queryClient.invalidateQueries({ queryKey: ['report-documents'] });
    },
    onError: (error: unknown) => {
      logger.error('删除报告归档失败', error);
      toast.error(getApiErrorMessage(error, '删除失败，请稍后重试'));
    },
  });

  const handleTypeChange = (value: string): void => {
    setTypeFilter(value);
    setPage(1);
  };

  const items: ReportDocument[] = data?.items ?? [];
  const total: number = data?.total ?? 0;
  const totalPages: number = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <EnergyHero
        title="报告归档"
        description="集中查看已导出的周报 / 月报 Word 文档，可随时下载或清理"
        action={
          <div className="inline-flex items-center gap-2 rounded-lg bg-white/95 px-3 py-2 shadow-sm">
            <span className="text-xs font-medium text-slate-600">报告类型</span>
              <Select value={typeFilter} onValueChange={handleTypeChange}>
                <SelectTrigger className="w-40 border-slate-200 bg-white" aria-label="按报告类型筛选">
                  <SelectValue placeholder="全部类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_TYPES_VALUE}>全部类型</SelectItem>
                  {REPORT_DOCUMENT_TYPES.map((type: ReportDocumentType) => (
                    <SelectItem key={type} value={type}>
                      {REPORT_DOCUMENT_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }
      />

      <Card className="animate-fade-up stagger-1 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Clock className="size-4 text-primary" />
            导出记录
          </div>
          <span className="text-xs text-slate-500 tabular-nums">
            共 {total} 份文档
          </span>
        </div>

        {isLoading ? (
          <CardContent className="space-y-3 p-4">
            {[0, 1, 2].map((row: number) => (
              <div key={row} className="flex items-center gap-3">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="ml-auto h-8 w-20 rounded-md" />
              </div>
            ))}
          </CardContent>
        ) : items.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {items.map((item: ReportDocument) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-primary/[0.02]"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-slate-800">
                      {item.title}
                    </span>
                    <Badge
                      variant="outline"
                      className={TYPE_BADGE_CLASS[item.reportType]}
                    >
                      {REPORT_DOCUMENT_TYPE_LABELS[item.reportType]}
                    </Badge>
                  </div>
                  <p className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Clock className="size-3.5" />
                    {dayjs(item.createdAt).format('YYYY-MM-DD HH:mm')}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewItem(item)}
                  >
                    <Eye className="size-4" />
                    预览
                  </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadFileByUrl(`${window.location.origin}${item.downloadUrl}`, item.fileName)}
                >
                  <Download className="size-4" />
                  下载
                </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`删除 ${item.title}`}
                        className="text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                        disabled={
                          deleteMutation.isPending &&
                          deleteMutation.variables === item.id
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>删除导出记录</AlertDialogTitle>
                        <AlertDialogDescription>
                          将删除「{item.title}」的归档记录，已下载的文件不受影响。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => deleteMutation.mutate(item.id)}
                        >
                          删除
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <CardContent className="py-14">
            <Empty>
              <EmptyHeader>
                <div className="mb-2 flex justify-center">
                  <Image
                    src={aiAvatarUrl}
                    alt="BSS 智能助手形象"
                    className="size-16 rounded-full object-cover shadow-sm ring-2 ring-primary/10"
                  />
                </div>
                <EmptyTitle>暂无导出的报告文档</EmptyTitle>
                <EmptyDescription>
                  在周报 / 月报详情页点击「导出 DOC」即可在此归档
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        )}
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-label="上一页"
            disabled={page <= 1}
            onClick={() => setPage((prev: number) => Math.max(1, prev - 1))}
          >
            <ChevronLeft className="size-4" />
            上一页
          </Button>
          <span className="text-xs text-slate-500 tabular-nums">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            aria-label="下一页"
            disabled={page >= totalPages}
            onClick={() =>
              setPage((prev: number) => Math.min(totalPages, prev + 1))
            }
          >
            下一页
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}

      <Dialog
        open={previewItem !== null}
        onOpenChange={(open: boolean) => {
          if (!open) setPreviewItem(null);
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{previewItem?.fileName ?? '报告预览'}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-auto">
            {previewItem && (
              <DocxDocumentPreview
                url={`${window.location.origin}${previewItem.downloadUrl}`}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReportArchivePage;
