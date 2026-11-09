import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CalendarClock, Send } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserSelect } from '@/components/business-ui/user-select';
import { scheduledSendApi } from '@/api';
import { getApiErrorMessage } from '@/lib/api-error';
import type { CreateDailyReportRequest } from '@shared/api.interface';

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

const getTodayInShanghai = (): string =>
  new Date(Date.now() + SHANGHAI_OFFSET_MS).toISOString().slice(0, 10);

const buildTodaySlots = (): string[] => {
  const dateStr = getTodayInShanghai();
  const slots: string[] = [];
  for (let hour = 0; hour <= 23; hour += 1) {
    for (const minute of [0, 30]) {
      const slot = `${String(hour).padStart(2, '0')}:${minute === 0 ? '00' : '30'}`;
      const slotTime = new Date(`${dateStr}T${slot}:00+08:00`).getTime();
      if (slotTime > Date.now() + 2 * 60 * 1000) {
        slots.push(slot);
      }
    }
  }
  return slots;
};

interface ScheduleSendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: CreateDailyReportRequest;
  onScheduled: () => void;
}

const ScheduleSendDialog: React.FC<ScheduleSendDialogProps> = ({
  open,
  onOpenChange,
  report,
  onScheduled,
}) => {
  const [sendTime, setSendTime] = useState<string | undefined>(undefined);
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const slots = buildTodaySlots();

  const createMutation = useMutation({
    mutationFn: () =>
      scheduledSendApi.createScheduledSend({
        report,
        sendDate: getTodayInShanghai(),
        sendTime: sendTime ?? '',
        recipientIds,
      }),
    retry: false,
    onSuccess: () => {
      toast.success(
        `已设置定时发送，今天 ${sendTime ?? ''} 将自动提交日报并通知接收人`,
      );
      onScheduled();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, '设置定时发送失败，请稍后重试'));
    },
  });

  const confirm = () => {
    if (!sendTime) {
      toast.error('请选择发送时间');
      return;
    }
    if (recipientIds.length === 0) {
      toast.error('请至少选择一位接收人');
      return;
    }
    createMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/[0.07] text-primary">
              <CalendarClock className="size-4" />
            </span>
            定时发送日报
          </DialogTitle>
          <DialogDescription>
            到所选时间后，系统会自动把这份日报正式提交，并以飞书消息发送给所选接收人。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">
              今天发送时间（整点 / 半点）
            </label>
            {slots.length > 0 ? (
              <Select value={sendTime} onValueChange={setSendTime}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="请选择发送时间" />
                </SelectTrigger>
                <SelectContent>
                  {slots.map((slot) => (
                    <SelectItem key={slot} value={slot}>
                      今天 {slot}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                今天已没有可选的发送时间，可直接保存日报，或明天再设置定时发送。
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">
              接收人（可选部门领导或具体同事）
            </label>
            <UserSelect
              multiple
              value={recipientIds}
              onChange={setRecipientIds}
              placeholder="搜索并选择接收人"
            />
            {recipientIds.length === 0 && (
              <p className="text-xs text-slate-400">
                可多选；日报内容将以飞书消息发送给所选接收人。
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            type="button"
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button
            type="button"
            className="shadow-sm"
            disabled={
              !sendTime ||
              recipientIds.length === 0 ||
              createMutation.isPending
            }
            onClick={confirm}
          >
            <Send className="size-4" />
            {createMutation.isPending ? '设置中...' : '确认定时发送'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ScheduleSendDialog;
