import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { CalendarClock, CircleAlert, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
import { UserDisplay } from '@/components/business-ui/user-display';
import { scheduledSendApi } from '@/api';
import { getApiErrorMessage } from '@/lib/api-error';
import type { ScheduledReportSend } from '@shared/api.interface';

const statusStyle: Record<string, string> = {
  pending: 'border-amber-200 bg-amber-50 text-amber-700',
  failed: 'border-rose-200 bg-rose-50 text-rose-700',
};

const statusLabel: Record<string, string> = {
  pending: '待发送',
  failed: '发送失败',
};

const ScheduledSendsCard: React.FC = () => {
  const queryClient = useQueryClient();
  const [cancelId, setCancelId] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['scheduled-sends'],
    queryFn: () => scheduledSendApi.getMyScheduledSends(),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => scheduledSendApi.cancelScheduledSend(id),
    retry: false,
    onSuccess: () => {
      toast.success('已取消该定时发送');
      queryClient.invalidateQueries({ queryKey: ['scheduled-sends'] });
      setCancelId(null);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, '取消失败，请稍后重试'));
    },
  });

  const visible = useMemo(
    () =>
      (data?.items ?? []).filter(
        (item) => item.status === 'pending' || item.status === 'failed',
      ),
    [data],
  );

  if (visible.length === 0) {
    return null;
  }

  return (
    <Card className="animate-fade-up stagger-1 border-primary/15">
      <CardContent className="p-4 lg:p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
          <CalendarClock className="size-4 text-primary" />
          我的定时发送
        </div>
        <div className="space-y-2">
          {visible.map((item: ScheduledReportSend) => (
            <div
              key={item.id}
              className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50/50 p-3 md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums text-primary">
                    {dayjs(item.sendAt).format('HH:mm')}
                  </span>
                  <span className="text-sm font-medium text-slate-800">
                    {item.report.taskName}
                  </span>
                  <Badge variant="outline" className={statusStyle[item.status]}>
                    {statusLabel[item.status]}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>填报日期 {item.report.reportDate}</span>
                  <span className="text-slate-300">|</span>
                  <span>通知对象</span>
                  {item.recipientIds.length > 0 ? (
                    <UserDisplay value={item.recipientIds} size="small" />
                  ) : (
                    <span className="text-slate-400">
                      未填汇报人/抄送人，到点仅提交
                    </span>
                  )}
                </div>
                {item.status === 'failed' && item.errorMsg && (
                  <p className="flex items-center gap-1.5 text-xs text-rose-600">
                    <CircleAlert className="size-3.5 shrink-0" />
                    <span className="break-words">{item.errorMsg}</span>
                  </p>
                )}
              </div>
              {item.status === 'pending' && (
                <AlertDialog
                  open={cancelId === item.id}
                  onOpenChange={(o) => !o && setCancelId(null)}
                >
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`取消定时发送 ${item.report.taskName}`}
                      className="gap-1 text-slate-500 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setCancelId(item.id)}
                    >
                      <X className="size-3.5" />
                      取消发送
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>确认取消定时发送</AlertDialogTitle>
                      <AlertDialogDescription>
                        取消后这份日报不会自动提交，也不会通知汇报人与抄送人，确定要取消吗？
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>再想想</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => cancelMutation.mutate(item.id)}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        {cancelMutation.isPending ? '取消中...' : '确认取消'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ScheduledSendsCard;
