import { useCallback, useEffect, useRef, useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import {
  AlertCircle,
  AlignLeft,
  ArrowLeft,
  CalendarClock,
  FileText,
  History,
  Plus,
  Save,
  Send,
  Settings2,
  Sparkles,
  Trash2,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import dayjs from 'dayjs';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProjectSingleSelect } from '@/components/daily-report/ProjectSingleSelect';
import { TaskNameField } from '@/components/daily-report/TaskNameField';
import { UserSelect } from '@/components/business-ui/user-select';
import VoiceInputButton from '@/components/voice/VoiceInputButton';
import ScheduleSendDialog from '@/components/scheduled/ScheduleSendDialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { dailyReportApi, userDepartmentApi } from '@/api';
import { getApiErrorMessage } from '@/lib/api-error';
import { useDailyReportAutosave } from '@/hooks/use-daily-report-autosave';
import { syncDailyReportToBitable, describeBitableSyncError } from '@/lib/daily-bitable-sync';
import { useCurrentUserProfile } from '@lark-apaas/client-toolkit/hooks/useCurrentUserProfile';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  APPLY_DAILY_DRAFT_EVENT,
  OPEN_AI_EMPLOYEE_EVENT,
  popDailyDraft,
  type ApplyDailyDraftDetail,
} from '@/lib/ai-draft';
import aiAvatarUrl from '@/assets/ai-assistant.png';
import {
  DEPARTMENTS,
  TASK_SOURCES,
  isDepartment,
  type Department,
  type TaskSource,
  type CreateDailyReportRequest,
  type CompletionRowKind,
  type DailyCompletionRow,
  type DailyReport,
} from '@shared/api.interface';
import {
  ALL_PROJECTS,
} from '@shared/projects';
import { Image } from '@client/src/components/ui/image';

const formSchema = z.object({
  reportDate: z.string().min(1, '请选择填报日期'),
  department: z.string().refine(
    (v): v is Department => DEPARTMENTS.includes(v as Department),
    '请选择有效的部门',
  ),
  taskSources: z
    .array(
      z
        .string()
        .refine(
          (v): v is TaskSource => TASK_SOURCES.includes(v as TaskSource),
          '请选择有效的任务来源',
        ),
    )
    .min(1, '请选择任务来源'),
  taskName: z.string(),
  projectName: z.array(z.string()).optional(),
  projectCode: z.array(z.string()).optional(),
  plmTask: z.string().optional(),
  dayCompletion: z.string().optional(),
  completionRows: z
    .array(
      z.object({
        kind: z.enum(['routine', 'project']).optional(),
        projectNames: z.array(z.string()),
        projectCodes: z.array(z.string()),
        task: z.string().optional(),
        completion: z.string().optional(),
        workHours: z.string().optional(),
      }),
    )
    .optional(),
  outputFileCount: z.string().optional(),
  assistanceNeeded: z.string().optional(),
  recipients: z.array(z.string()).min(1, '请选择汇报对象'),
  cc: z.array(z.string()).optional(),
}).superRefine((values, ctx) => {
  if (values.taskSources.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['taskSources'],
      message: '请选择任务来源',
    });
  }
});

type FormValues = {
  reportDate: string;
  department: string;
  taskSources: TaskSource[];
  taskName: string;
  projectName?: string[];
  projectCode?: string[];
  plmTask?: string;
  completionRows?: DailyCompletionRow[];
  dayCompletion?: string;
  outputFileCount?: string;
  assistanceNeeded?: string;
  recipients: string[];
  cc: string[];
};

const emptyCompletionRow = (
  kind: CompletionRowKind = 'project',
): DailyCompletionRow => ({
  kind,
  projectNames: [],
  projectCodes: [],
  task: '',
  completion: '',
});

const toRequest = (values: FormValues): CreateDailyReportRequest => {
  const rows = (values.completionRows ?? [])
    .map((row): DailyCompletionRow =>
      row.kind === 'routine'
        ? { ...row, projectNames: [], projectCodes: [], task: '' }
        : row,
    )
    .filter(
      (r) =>
        (r.projectCodes?.length ?? 0) > 0 ||
        (r.task?.trim().length ?? 0) > 0 ||
        (r.completion?.trim().length ?? 0) > 0,
    );
  const projectNames: string[] = [];
  const projectCodes: string[] = [];
  rows.forEach((r) => {
    (r.projectCodes ?? []).forEach((c: string) => {
      if (c && !projectCodes.includes(c)) projectCodes.push(c);
    });
    (r.projectNames ?? []).forEach((n: string) => {
      if (n && !projectNames.includes(n)) projectNames.push(n);
    });
  });
  const dayCompletion = rows
    .map((r) => {
      const head = [
        (r.projectNames ?? []).filter(Boolean).join('、'),
        r.task?.trim() ?? '',
      ]
        .filter(Boolean)
        .join(' · ');
      const namePart = head ? `【${head}】` : '';
      return r.completion?.trim()
        ? `${namePart}${r.completion.trim()}`
        : '';
    })
    .filter(Boolean)
    .join('\n');

  const primarySource: TaskSource = values.taskSources[0] ?? '项目任务';
  const onlyBidSource =
    values.taskSources.length === 1 && primarySource === '投标项目';
  const derivedTaskName: string =
    projectNames.length > 0
      ? projectNames.join('、')
      : values.taskSources.join('、');

  return {
    ...values,
    taskSource: primarySource,
    taskSources: values.taskSources,
    taskName: onlyBidSource
      ? '投标项目'
      : values.taskName.trim() || derivedTaskName || '工作日报',
    projectName: projectNames.length ? projectNames : undefined,
    projectCode: projectCodes.length ? projectCodes : undefined,
    plmTask: undefined,
    dayCompletion: dayCompletion || undefined,
    completionRows: rows.length ? rows : undefined,
    assistanceNeeded: values.assistanceNeeded || undefined,
    recipients: values.recipients,
    cc: values.cc,
  } as CreateDailyReportRequest;
};

const FALLBACK_DEPARTMENT = '产品创新室';

const defaultValues: FormValues = {
  reportDate: new Date().toISOString().split('T')[0],
  department: FALLBACK_DEPARTMENT,
  taskSources: ['项目任务'],
  taskName: '',
  projectName: [],
  projectCode: [],
  plmTask: '',
  completionRows: [emptyCompletionRow()],
  dayCompletion: '',
  outputFileCount: '',
  assistanceNeeded: '',
  recipients: [],
  cc: [],
};

const appendTranscribedText = (
  currentValue: string | undefined,
  text: string,
): string => (currentValue ? `${currentValue}\n${text}` : text);

const AI_TIPS = [
  '项目单选，周报 / 月报会按所选项目逐项汇总',
  '未完成事项请在「问题与协助」中说明，方便部门协同',
];

const STAGGER_CLASSES = [
  'stagger-1',
  'stagger-2',
  'stagger-3',
  'stagger-4',
] as const;

interface SectionCardProps {
  icon: LucideIcon;
  title: string;
  step: number;
  contentClassName?: string;
  children: React.ReactNode;
}

const SectionCard: React.FC<SectionCardProps> = ({
  icon: Icon,
  title,
  step,
  contentClassName,
  children,
}) => (
  <Card
    className={`animate-fade-up ${
      STAGGER_CLASSES[Math.min(step - 1, STAGGER_CLASSES.length - 1)]
    }`}
  >
    <CardHeader className="rounded-t-lg bg-slate-50/70 pb-2.5">
      <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary/[0.07] text-primary">
          <Icon className="size-4" />
        </span>
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent className={contentClassName}>{children}</CardContent>
  </Card>
);

const formHeroUrl =
  '/spark/app/app_17hcpbyjja6/runtime/api/v1/storage/object/bucket_aadk5lknep6bw_static/static%2Faadk5qviky2vq_ve_miaoda';

const DailyReportFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const isEdit = !!id;
  const fromId = isEdit ? null : searchParams.get('from');
  const [fromBaseDate, setFromBaseDate] = useState('');
  const user = useCurrentUserProfile();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as never,
    defaultValues,
  });

  const taskSources = form.watch('taskSources');
  const taskSource: TaskSource = taskSources[0] ?? '项目任务';
  const department = form.watch('department');
  const departmentTouchedRef = useRef(false);
  const { data: myDepartment } = useQuery({
    queryKey: ['my-department'],
    queryFn: userDepartmentApi.getMyDepartment,
    enabled: !isEdit,
    staleTime: 5 * 60_000,
  });

  const contactDepartmentMissing =
    !isEdit && myDepartment !== undefined && !myDepartment?.department;

  useEffect(() => {
    if (isEdit) return;
    if (myDepartment === undefined) return;
    if (departmentTouchedRef.current) return;
    if (form.getValues('department') !== FALLBACK_DEPARTMENT) return;
    const contactDepartment = myDepartment?.department;
    form.setValue(
      'department',
      contactDepartment && isDepartment(contactDepartment)
        ? contactDepartment
        : '',
    );
  }, [isEdit, myDepartment, form]);
  const { data: recipientDefaults } = useQuery({
    queryKey: ['daily-report-recipient-defaults', department],
    queryFn: () =>
      dailyReportApi.getRecipientDefaults(
        isDepartment(department) ? department : FALLBACK_DEPARTMENT,
      ),
    enabled: !isEdit && Boolean(department),
  });
  const recipientDefaultsRef = useRef(recipientDefaults);
  useEffect(() => {
    recipientDefaultsRef.current = recipientDefaults;
  }, [recipientDefaults]);

  useEffect(() => {
    if (isEdit || !recipientDefaults) return;
    if (recipientDefaults.source === 'none') return;
    if ((form.getValues('recipients') ?? []).length === 0) {
      form.setValue('recipients', recipientDefaults.recipients);
    }
    if ((form.getValues('cc') ?? []).length === 0) {
      form.setValue('cc', recipientDefaults.cc);
    }
  }, [isEdit, recipientDefaults, form]);
  const isBidProject =
    taskSources.length === 1 && taskSources[0] === '投标项目';
  const isMultiSource = taskSources.length > 1;
  const hasProjectTaskSource = taskSources.includes('项目任务');
  const isNoProjectSource =
    !isMultiSource &&
    (taskSources[0] === '部门日常' ||
      taskSources[0] === '投标项目' ||
      taskSources[0] === '临时需求' ||
      taskSources[0] === '会议安排' ||
      taskSources[0] === '跨部门协作' ||
      taskSources[0] === '其他任务' ||
      taskSources[0] === '行政工作');
  const showRoutineSection = isNoProjectSource || isMultiSource;
  const showProjectSection =
    !isNoProjectSource && (!isMultiSource || hasProjectTaskSource);
  const completionFields = useFieldArray({
    control: form.control,
    name: 'completionRows',
  });
  const watchedCompletionRows = useWatch({
    control: form.control,
    name: 'completionRows',
  });
  useEffect(() => {
    const rows = form.getValues('completionRows') ?? [];
    let next: DailyCompletionRow[] = rows.map((row) => {
      const inferred: CompletionRowKind =
        (row.projectCodes ?? []).length > 0 ||
        (row.projectNames ?? []).length > 0
          ? 'project'
          : 'routine';
      const desired: CompletionRowKind =
        showProjectSection && !showRoutineSection
          ? 'project'
          : showRoutineSection && !showProjectSection
            ? 'routine'
            : (row.kind ?? inferred);
      return row.kind === desired ? row : { ...row, kind: desired };
    });
    if (showRoutineSection && showProjectSection) {
      if (!next.some((row) => row.kind === 'routine')) {
        next = [emptyCompletionRow('routine'), ...next];
      }
      if (!next.some((row) => row.kind === 'project')) {
        next = [...next, emptyCompletionRow('project')];
      }
    }
    const unchanged =
      next.length === rows.length &&
      next.every((row, i) => row === rows[i]);
    if (!unchanged) {
      form.setValue('completionRows', next, { shouldDirty: false });
    }
  }, [form, showProjectSection, showRoutineSection]);
  const completionEntries = completionFields.fields.map((item, index) => {
    const kind: CompletionRowKind =
      watchedCompletionRows?.[index]?.kind === 'routine'
        ? 'routine'
        : 'project';
    return { fieldId: item.id, index, kind };
  });

  const handleRestoreDraft = useCallback(
    (values: FormValues): void => {
      const restored: FormValues = { ...defaultValues, ...values };
      const fallback = recipientDefaultsRef.current;
      if (fallback && fallback.source !== 'none') {
        if ((restored.recipients ?? []).length === 0) {
          restored.recipients = fallback.recipients;
        }
        if ((restored.cc ?? []).length === 0) {
          restored.cc = fallback.cc;
        }
      }
      form.reset(restored);
      toast.success('已恢复上次未提交的草稿，请核对后提交');
    },
    [form],
  );

  const hasDraftContent = useCallback((values: FormValues): boolean => {
    const rows = values.completionRows ?? [];
    return Boolean(
      values.taskName?.trim() ||
        values.plmTask?.trim() ||
        values.outputFileCount?.trim() ||
        values.assistanceNeeded?.trim() ||
        (values.recipients?.length ?? 0) > 0 ||
        (values.cc?.length ?? 0) > 0 ||
        rows.some(
          (row) =>
            (row.projectCodes?.length ?? 0) > 0 ||
            (row.projectNames?.length ?? 0) > 0 ||
            Boolean(row.completion?.trim()),
        ),
    );
  }, []);

  const { savedAt: draftSavedAt, clearDraft } = useDailyReportAutosave({
    form,
    enabled: !isEdit && !fromId,
    hasContent: hasDraftContent,
    onRestore: handleRestoreDraft,
  });

  const handleClearDraft = (): void => {
    clearDraft();
    form.reset(defaultValues);
    toast.success('已清空本机草稿，重新开始填写');
  };

  const { data: report, isLoading } = useQuery({
    queryKey: ['daily-report', id],
    queryFn: () => dailyReportApi.getDailyReport(id!),
    enabled: isEdit,
  });

  useEffect(() => {
    if (report) {
      form.reset({
        reportDate: report.reportDate,
        department: report.department,
        taskSources:
          report.taskSources && report.taskSources.length > 0
            ? report.taskSources
            : [report.taskSource],
        taskName: report.taskName,
        projectName: Array.isArray(report.projectName)
          ? report.projectName
          : ([report.projectName].filter(Boolean) as string[]),
        projectCode: Array.isArray(report.projectCode)
          ? report.projectCode
          : ([report.projectCode].filter(Boolean) as string[]),
        plmTask: report.plmTask || '',
        completionRows:
          report.completionRows && report.completionRows.length > 0
            ? report.completionRows
            : report.dayCompletion
              ? [
                  {
                    projectNames: Array.isArray(report.projectName)
                      ? report.projectName
                      : [],
                    projectCodes: Array.isArray(report.projectCode)
                      ? report.projectCode
                      : [],
                    completion: report.dayCompletion,
                  },
                ]
              : [emptyCompletionRow()],
        dayCompletion: report.dayCompletion || '',
        outputFileCount: report.outputFileCount,
        assistanceNeeded: report.assistanceNeeded || '',
        recipients: report.recipients || [],
        cc: report.cc || [],
      });
    }
  }, [report, form]);

  const [baseReportId, setBaseReportId] = useState<string | null>(null);
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);

  const applyReportToForm = useCallback(
    (report: DailyReport): void => {
      form.reset({
        reportDate: dayjs().format('YYYY-MM-DD'),
        department: report.department,
        taskSources:
          report.taskSources && report.taskSources.length > 0
            ? report.taskSources
            : [report.taskSource],
        taskName: report.taskName,
        projectName: Array.isArray(report.projectName)
          ? report.projectName
          : ([report.projectName].filter(Boolean) as string[]),
        projectCode: Array.isArray(report.projectCode)
          ? report.projectCode
          : ([report.projectCode].filter(Boolean) as string[]),
        plmTask: report.plmTask || '',
        completionRows:
          report.completionRows && report.completionRows.length > 0
            ? report.completionRows
            : report.dayCompletion
              ? [
                  {
                    projectNames: Array.isArray(report.projectName)
                      ? report.projectName
                      : [],
                    projectCodes: Array.isArray(report.projectCode)
                      ? report.projectCode
                      : [],
                    completion: report.dayCompletion,
                  },
                ]
              : [emptyCompletionRow()],
        dayCompletion: report.dayCompletion || '',
        outputFileCount: report.outputFileCount,
        assistanceNeeded: report.assistanceNeeded || '',
        recipients: report.recipients || [],
        cc: report.cc || [],
      });
      setBaseReportId(report.id);
      setFromBaseDate(report.reportDate);
      toast.success(
        `已带入 ${report.reportDate} 的日报，修改后提交将生成今日新日报`,
      );
    },
    [form],
  );

  const { data: baseReport } = useQuery({
    queryKey: ['daily-report', fromId],
    queryFn: () => dailyReportApi.getDailyReport(fromId!),
    enabled: !isEdit && Boolean(fromId),
  });

  useEffect(() => {
    if (isEdit || !baseReport) return;
    applyReportToForm(baseReport);
  }, [isEdit, baseReport, applyReportToForm]);

  const latestReportMutation = useMutation({
    mutationFn: dailyReportApi.getLatestDailyReport,
    retry: false,
    onSuccess: (report: DailyReport | null) => {
      if (!report) {
        toast('还没有可导入的历史日报，请直接填写');
        return;
      }
      applyReportToForm(report);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, '导入失败，请稍后重试'));
    },
  });

  const runImportLatest = (): void => {
    latestReportMutation.mutate();
  };

  const handleImportLatest = (): void => {
    const values = form.getValues();
    const hasContent =
      (values.taskName ?? '').trim().length > 0 ||
      (values.completionRows ?? []).some(
        (row) => (row.completion ?? '').trim().length > 0,
      );
    if (hasContent) {
      setImportConfirmOpen(true);
      return;
    }
    runImportLatest();
  };

  useEffect(() => {
    if (isEdit) return;
    const applyStoredDraft = (event?: Event): void => {
      const detail = event instanceof CustomEvent
        ? (event.detail as ApplyDailyDraftDetail | undefined)
        : undefined;
      const draft = detail?.task ?? popDailyDraft();
      if (!draft) return;
      form.reset({
        ...defaultValues,
        reportDate: new Date().toISOString().split('T')[0],
        taskSources: [draft.taskSource],
        taskName: draft.taskName,
        completionRows:
          draft.completionRows.length > 0
            ? draft.completionRows
            : [emptyCompletionRow()],
        outputFileCount: draft.outputFileCount ?? '',
        assistanceNeeded: draft.assistanceNeeded ?? '',
        recipients: recipientDefaultsRef.current?.recipients ?? [],
        cc: recipientDefaultsRef.current?.cc ?? [],
      });
      toast.success('已带入数智员工草稿，请核对后保存');
    };
    applyStoredDraft();
    window.addEventListener(APPLY_DAILY_DRAFT_EVENT, applyStoredDraft);
    return () => {
      window.removeEventListener(APPLY_DAILY_DRAFT_EVENT, applyStoredDraft);
    };
  }, [isEdit, form]);

  const syncToBitable = (report: DailyReport): void => {
    void syncDailyReportToBitable({
      report,
      reporterName: report.reporterName ?? '',
    }).catch((error: unknown) => {
      logger.error('日报同步多维表格失败', error);
      toast.error(describeBitableSyncError(error));
    });
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateDailyReportRequest) =>
      dailyReportApi.createDailyReport(data),
    retry: false,
    onSuccess: (report: DailyReport) => {
      toast.success('日报创建成功');
      clearDraft();
      queryClient.invalidateQueries({ queryKey: ['daily-reports'] });
      syncToBitable(report);
      navigate('/daily-report');
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, '创建失败，请稍后重试'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: CreateDailyReportRequest) =>
      dailyReportApi.updateDailyReport(id!, data),
    retry: false,
    onSuccess: (report: DailyReport) => {
      toast.success('日报更新成功');
      queryClient.invalidateQueries({ queryKey: ['daily-reports'] });
      queryClient.invalidateQueries({ queryKey: ['daily-report', id] });
      syncToBitable(report);
      navigate('/daily-report');
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, '更新失败，请稍后重试'));
    },
  });

  const [scheduleOpen, setScheduleOpen] = useState(false);

  const openSchedule = () => {
    setScheduleOpen(true);
  };

  const onScheduled = () => {
    setScheduleOpen(false);
    queryClient.invalidateQueries({ queryKey: ['scheduled-sends'] });
    navigate('/daily-report');
  };

  const onSubmit = (values: FormValues) => {
    const payload = toRequest(values);
    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  if (isEdit && isLoading) {
    return <div className="text-slate-500">加载中...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="animate-fade-up relative overflow-hidden rounded-2xl">
        <Image
          src={formHeroUrl}
          alt=""
          sizes="100vw"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          className="absolute inset-0 rounded-2xl"
          style={{
            backgroundImage:
              'linear-gradient(to bottom, rgba(10,20,36,0.2) 0%, rgba(10,20,36,0) 45%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(6,16,32,0.86) 0%, rgba(6,16,32,0.74) 30%, rgba(6,16,32,0.46) 56%, rgba(6,16,32,0.16) 76%, rgba(6,16,32,0) 92%)',
          }}
        />
        <div className="relative z-10 px-6 py-10 sm:px-8 md:py-14">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="max-w-2xl">
              <h1 className="text-3xl font-bold text-white sm:text-4xl">
                {isEdit ? '编辑今日日报' : '填写今日日报'}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-white sm:text-base">
                按任务逐条记录今天的工作，提交后自动纳入周报 / 月报汇总
              </p>
            </div>
            <div className="flex w-fit shrink-0 flex-wrap items-center gap-2 rounded-xl bg-slate-900/30 p-1.5 backdrop-blur-sm">
              {!isEdit && (
                <Button
                  type="button"
                  className="gap-1.5 bg-white text-primary shadow-md hover:bg-white/90"
                  onClick={handleImportLatest}
                  disabled={latestReportMutation.isPending}
                >
                  <History className="size-4" />
                  {latestReportMutation.isPending
                    ? '导入中...'
                    : '导入上一篇日报'}
                </Button>
              )}
              <Button
                asChild
                variant="outline"
                className="border-white/60 bg-transparent text-white shadow-none hover:bg-white/15 hover:text-white"
              >
                <Link to="/daily-report">
                  <ArrowLeft className="size-4" />
                  返回
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_284px]">
        <aside className="order-first animate-fade-up stagger-1 lg:order-last lg:sticky lg:top-6">
          <div className="overflow-hidden rounded-xl border border-primary/15 bg-white shadow-sm">
            <div className="flex items-center gap-3 bg-gradient-to-br from-primary/[0.08] via-white to-primary/[0.03] p-4">
              <Image
                src={aiAvatarUrl}
                alt="BSS 智能助手形象"
                className="size-11 shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm"
              />
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                  <Sparkles className="size-3.5 text-primary" />
                  BSS 智能助手
                </p>
                <p className="text-xs text-slate-500">填写小贴士</p>
              </div>
            </div>
            <ul className="space-y-3 border-t border-slate-100 p-4">
              {AI_TIPS.map((tip) => (
                <li
                  key={tip}
                  className="flex gap-2.5 text-xs leading-relaxed text-slate-600"
                >
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
            <div className="border-t border-slate-100 p-4">
              <Button
                variant="outline"
                size="sm"
                type="button"
                className="w-full gap-1.5 border-primary/25 text-primary hover:bg-primary/5"
                onClick={() =>
                  window.dispatchEvent(new CustomEvent(OPEN_AI_EMPLOYEE_EVENT))
                }
              >
                <Sparkles className="size-3.5" />
                让数智员工带我填
              </Button>
            </div>
          </div>
        </aside>

        <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {fromBaseDate && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/[0.04] px-3 py-2 text-xs text-slate-600">
              <span>
                已按 {fromBaseDate} 的日报作为底稿，可继续新增内容；提交后生成今日新日报，原日报不受影响
              </span>
              <Link
                to={`/daily-report/${baseReportId ?? fromId ?? ''}`}
                className="shrink-0 font-medium text-primary hover:underline"
              >
                查看原日报
              </Link>
            </div>
          )}
          {!isEdit && draftSavedAt && (
            <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs text-slate-500 shadow-sm backdrop-blur">
              <span className="flex items-center gap-1.5">
                <Save className="size-3.5 text-emerald-500" />
                草稿已自动保存在本机 · {dayjs(draftSavedAt).format('MM-DD HH:mm')}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-slate-500"
                onClick={handleClearDraft}
              >
                清空草稿
              </Button>
            </div>
          )}
          <SectionCard
            icon={FileText}
            title="基本信息"
            step={1}
            contentClassName="[&_label]:text-xs [&_label]:font-medium [&_label]:text-slate-500"
          >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormItem>
                  <FormLabel>姓名</FormLabel>
                  <FormControl>
                    <Input value={user?.name ?? ''} disabled placeholder="加载中" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
                <FormField
                  control={form.control}
                  name="reportDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>填报日期</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>所属部门</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(value: string) => {
                          departmentTouchedRef.current = true;
                          field.onChange(value);
                        }}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="请选择部门" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DEPARTMENTS.map((d) => (
                            <SelectItem key={d} value={d}>
                              {d}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                      {contactDepartmentMissing ? (
                        <p className="text-xs text-amber-600">
                          未匹配到飞书通讯录部门，请手动选择
                        </p>
                      ) : null}
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="taskSources"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>
                        任务来源
                        <span className="ml-0.5 text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <ToggleGroup
                          type="multiple"
                          variant="outline"
                          size="sm"
                          spacing={2}
                          value={field.value}
                          onValueChange={(values: string[]) => {
                            field.onChange(values);
                            if (!values.includes('飞书任务')) {
                              form.setValue('taskName', '');
                            }
                          }}
                          aria-label="任务来源"
                          className="flex flex-wrap justify-start gap-2"
                        >
                          {TASK_SOURCES.map((s) => (
                            <ToggleGroupItem
                              key={s}
                              value={s}
                              aria-label={`任务来源 ${s}`}
                              className="data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
                            >
                              {s}
                            </ToggleGroupItem>
                          ))}
                        </ToggleGroup>
                      </FormControl>
                      <p className="text-xs text-slate-400">
                        可多选；选中两项及以上时按部门日常填写，同时勾选「项目任务」会一并显示项目逐项填写
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {taskSources.includes('飞书任务') ? (
                  <FormField
                    control={form.control}
                    name="taskName"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>任务名称（飞书任务）</FormLabel>
                        <FormControl>
                          <TaskNameField
                            value={field.value ?? ''}
                            onChange={field.onChange}
                            taskSource="飞书任务"
                          />
                        </FormControl>
                        <p className="text-xs text-slate-400">
                          来自任务池中分配给你的飞书任务，可多选
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}
              </div>
          </SectionCard>

          <SectionCard
            icon={AlignLeft}
            title="当日完成情况"
            step={3}
            contentClassName="space-y-4 [&_label]:text-xs [&_label]:font-medium [&_label]:text-slate-500"
          >
              <div className="flex flex-wrap items-center justify-end gap-2">
                {showRoutineSection && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() =>
                      completionFields.append(emptyCompletionRow('routine'))
                    }
                  >
                    <Plus className="size-3.5" />
                    {showProjectSection ? '增行（部门日常）' : '增行+'}
                  </Button>
                )}
                {showProjectSection && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() =>
                      completionFields.append(emptyCompletionRow('project'))
                    }
                  >
                    <Plus className="size-3.5" />
                    {showRoutineSection ? '增行（项目任务）' : '增行+'}
                  </Button>
                )}
              </div>
              <div className="space-y-3">
                {completionEntries.map((entry, entryIndex) => {
                  const field = completionFields.fields[entry.index];
                  const index = entry.index;
                  if (!field) return null;
                  const isRoutine = entry.kind === 'routine';
                  const showGroupTitle =
                    showRoutineSection &&
                    showProjectSection &&
                    completionEntries.findIndex(
                      (item) => item.kind === entry.kind,
                    ) === entryIndex;
                  return (
                    <>
                      <div key={field.id} className="space-y-2">
                        {showGroupTitle ? (
                          <p className="text-xs font-medium text-slate-500">
                            {isRoutine ? '部门日常' : '项目任务'}
                          </p>
                        ) : null}
                      <div className="rounded-lg border border-slate-200 bg-slate-50/40 p-3">
                        <div
                          className={
                            isRoutine
                              ? 'grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_110px]'
                              : 'grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1.35fr)_minmax(0,2fr)_110px]'
                          }
                        >
                          {!isRoutine && (
                            <>
                              <div className="flex min-w-0 flex-col gap-1.5">
                                <span className="flex h-7 items-center text-xs font-medium text-slate-500">
                                  项目
                                </span>
                                <Controller
                                  control={form.control}
                                  name={`completionRows.${index}.projectCodes` as const}
                                  render={({ field: codesField }) => (
                                    <ProjectSingleSelect
                                      value={(codesField.value ?? [])[0] ?? ''}
                                      onChange={(code: string) => {
                                        codesField.onChange(
                                          code ? [code] : [],
                                        );
                                        form.setValue(
                                          `completionRows.${index}.projectNames` as const,
                                          code
                                            ? [
                                                ALL_PROJECTS.find(
                                                  (p) => p.code === code,
                                                )?.name ?? code,
                                              ]
                                            : [],
                                          { shouldDirty: true },
                                        );
                                      }}
                                    />
                                  )}
                                />
                              </div>
                              <div className="flex min-w-0 flex-col gap-1.5">
                                <label
                                  htmlFor={`completion-row-task-${index}`}
                                  className="flex h-7 items-center text-xs font-medium text-slate-500"
                                >
                                  任务
                                </label>
                                <Controller
                                  control={form.control}
                                  name={`completionRows.${index}.task` as const}
                                  render={({ field: taskField }) => (
                                    <Textarea
                                      id={`completion-row-task-${index}`}
                                      rows={3}
                                      placeholder="请输入该项目的任务"
                                      className="min-h-[84px] resize-y bg-white"
                                      value={taskField.value ?? ''}
                                      onChange={taskField.onChange}
                                    />
                                  )}
                                />
                              </div>
                            </>
                          )}
                          <Controller
                            control={form.control}
                            name={`completionRows.${index}.completion` as const}
                            render={({ field: compField }) => (
                              <div className="flex min-w-0 flex-col gap-1.5">
                                <div className="flex h-7 items-center justify-between gap-2">
                                  <label
                                    htmlFor={`completion-row-completion-${index}`}
                                    className="text-xs font-medium text-slate-500"
                                  >
                                    完成情况
                                  </label>
                                  <div className="flex items-center gap-1">
                                    <VoiceInputButton
                                      onTranscribed={(text: string) =>
                                        compField.onChange(
                                          appendTranscribedText(
                                            compField.value,
                                            text,
                                          ),
                                        )
                                      }
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      aria-label={`删除第 ${index + 1} 行`}
                                      onClick={() =>
                                        completionFields.remove(index)
                                      }
                                      disabled={
                                        completionFields.fields.length <= 1
                                      }
                                      className="h-7 w-7 text-slate-400 hover:text-destructive"
                                    >
                                      <Trash2 className="size-4" />
                                    </Button>
                                  </div>
                                </div>
                                <Textarea
                                  id={`completion-row-completion-${index}`}
                                  rows={isRoutine ? 6 : 3}
                                  placeholder={
                                    isRoutine
                                      ? '请输入当日完成情况'
                                      : '请输入该项目的当日完成情况'
                                  }
                                  className={
                                    isRoutine
                                      ? 'min-h-32 resize-y bg-white'
                                      : 'min-h-[84px] resize-y bg-white'
                                  }
                                  {...compField}
                                />
                              </div>
                            )}
                          />
                          <div className="flex flex-col gap-1.5">
                            <label
                              htmlFor={`completion-row-hours-${index}`}
                              className="flex h-7 items-center text-xs font-medium text-slate-500"
                            >
                              工时
                            </label>
                            <Controller
                              control={form.control}
                              name={`completionRows.${index}.workHours` as const}
                              render={({ field: hoursField }) => (
                                <Input
                                  id={`completion-row-hours-${index}`}
                                  type="text"
                                  autoComplete="off"
                                  placeholder="如 3.5h"
                                  className="h-10 bg-white"
                                  value={hoursField.value ?? ''}
                                  onChange={hoursField.onChange}
                                />
                              )}
                            />
                          </div>
                        </div>
                      </div>
                      </div>
                    </>
                  );
                })}
              </div>
          </SectionCard>

          <SectionCard
            icon={Settings2}
            title="产出"
            step={4}
            contentClassName="[&_label]:text-xs [&_label]:font-medium [&_label]:text-slate-500 [&_input]:tabular-nums"
          >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="outputFileCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>输出文件数量</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="如：3套图纸 / 2份文档"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
          </SectionCard>

          <SectionCard
            icon={AlertCircle}
            title="问题与协助"
            step={5}
            contentClassName="space-y-4 [&_label]:text-xs [&_label]:font-medium [&_label]:text-slate-500"
          >
              <FormField
                control={form.control}
                name="assistanceNeeded"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between gap-2">
                      <FormLabel>需协助事项</FormLabel>
                      <VoiceInputButton
                        onTranscribed={(text: string) =>
                          field.onChange(
                            appendTranscribedText(field.value, text),
                          )
                        }
                      />
                    </div>
                    <FormControl>
                      <Textarea
                        rows={3}
                        placeholder="请输入需协助事项"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
          </SectionCard>

          <SectionCard
            icon={Users}
            title="汇报与抄送"
            step={6}
            contentClassName="grid grid-cols-1 md:grid-cols-2 gap-5 [&_label]:text-xs [&_label]:font-medium [&_label]:text-slate-500"
          >
            <FormField
              control={form.control}
              name="recipients"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    汇报给谁
                    <span className="ml-0.5 text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <UserSelect
                      multiple
                      valueType="string"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="请选择汇报对象"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cc"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>抄送给谁</FormLabel>
                  <FormControl>
                    <UserSelect
                      multiple
                      valueType="string"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="请选择抄送对象"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {!isEdit && recipientDefaults && recipientDefaults.source !== 'none' && (
              <p className="flex items-center gap-1.5 text-xs text-slate-500 md:col-span-2">
                <Sparkles className="size-3.5 text-primary" />
                已按{recipientDefaults.source === 'self' ? '你上次日报' : '部门常用'}的设置自动填入汇报 / 抄送对象，可直接修改
              </p>
            )}
          </SectionCard>

          <div className="sticky bottom-0 z-10 flex flex-wrap justify-end gap-3 rounded-xl border-t border-slate-200 bg-white/85 px-1 py-3 backdrop-blur-md">
            <Button variant="outline" type="button" asChild>
              <Link to="/daily-report">取消</Link>
            </Button>
            {!isEdit && (
              <Button
                variant="outline"
                type="button"
                className="gap-1.5"
                onClick={openSchedule}
              >
                <CalendarClock className="size-4" />
                定时发送
              </Button>
            )}
            <Button
              type="submit"
              className="shadow-sm"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              <Send className="size-4" />
              {createMutation.isPending || updateMutation.isPending
                ? '提交中...'
                : '提交'}
            </Button>
          </div>
        </form>
        </Form>
      </div>
      {!isEdit && (
        <AlertDialog open={importConfirmOpen} onOpenChange={setImportConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>导入上一篇日报？</AlertDialogTitle>
              <AlertDialogDescription>
                当前已填写的内容会被上一篇日报覆盖，导入后仍可继续修改。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setImportConfirmOpen(false);
                  runImportLatest();
                }}
              >
                导入并覆盖
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {!isEdit && (
        <ScheduleSendDialog
          open={scheduleOpen}
          onOpenChange={setScheduleOpen}
          report={toRequest(form.getValues())}
          onScheduled={onScheduled}
        />
      )}
    </div>
  );
};

export default DailyReportFormPage;
