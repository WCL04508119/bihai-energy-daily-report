import React from 'react';
import { Download } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';

import { Button } from '@/components/ui/button';
import { downloadFileByUrl } from '@/utils/download-file';
import { reportDocumentApi } from '@/api';
import { getApiErrorMessage } from '@/lib/api-error';
import type {
  ReportDocument,
  ReportDocumentType,
} from '@shared/api.interface';

interface ExportDocumentButtonProps {
  reportType: ReportDocumentType;
  reportId: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export const ExportDocumentButton: React.FC<ExportDocumentButtonProps> = ({
  reportType,
  reportId,
  variant = 'outline',
  size = 'default',
  className,
}) => {
  const downloadFile = (url: string, fileName: string): void => {
    downloadFileByUrl(`${window.location.origin}${url}`, fileName);
  };

  const exportMutation = useMutation({
    mutationFn: () =>
      reportDocumentApi.exportReportDocument({ reportType, reportId }),
    retry: false,
    onSuccess: (result: ReportDocument) => {
      downloadFile(result.downloadUrl, result.fileName);
      toast.success(`已导出「${result.title}」`);
    },
    onError: (error: unknown) => {
      logger.error('导出报告文档失败', error);
      toast.error(getApiErrorMessage(error, '导出失败，请稍后重试'));
    },
  });

  return (
    <>
      <Button
      variant={variant}
      size={size}
      className={className}
      disabled={exportMutation.isPending}
      onClick={() => exportMutation.mutate()}
    >
      <Download className="size-4" />
      {exportMutation.isPending ? '导出中...' : '导出 DOC'}
    </Button>
    </>
  );
};

export default ExportDocumentButton;
