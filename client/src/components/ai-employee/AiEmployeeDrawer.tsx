import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  CalendarRange,
  Check,
  Copy,
  FilePlus2,
  FileText,
  Send,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import aiAvatarUrl from '@/assets/ai-assistant.png';
import { Image } from '@/components/ui/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from '@/components/ui/drawer';
import { getDailyReports } from '@/api/daily-report';
import { ALL_PROJECTS } from '@shared/projects';
import { TASK_SOURCES } from '@shared/api.interface';
import { useCurrentUserProfile } from '@lark-apaas/client-toolkit/hooks/useCurrentUserProfile';
import { capabilityClient } from '@lark-apaas/client-toolkit';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { cn } from '@/lib/utils';
import {
  APPLY_DAILY_DRAFT_EVENT,
  extractDraft,
  saveDailyDraft,
  stripJsonBlock,
  type ApplyDailyDraftDetail,
  type DailyDraftTask,
} from '@/lib/ai-draft';
import type { DailyReport } from '@shared/api.interface';

type AnyRecord = Record<string, unknown>;

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
  tasks?: DailyDraftTask[];
}

interface AiEmployeeDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PLUGIN_INSTANCE_ID = 'bihai_smart_employee_daily_report_1';
const WEEK_PAGE_SIZE = 100;
const WEEK_MAX_PAGES = 5;
const NEW_REPORT_PATH = '/daily-report/new';
const RETRY_DELAY_MS = 800;

const isAsyncIterable = (value: unknown): value is AsyncIterable<AnyRecord> => {
  if (!value) return false;
  const candidate = value as { [Symbol.asyncIterator]?: unknown };
  return typeof candidate[Symbol.asyncIterator] === 'function';
};

const normalizeStream = (resultOrStream: unknown): AsyncIterable<AnyRecord> => {
  if (isAsyncIterable(resultOrStream)) return resultOrStream;
  if (
    resultOrStream &&
    typeof resultOrStream === 'object' &&
    'output' in (resultOrStream as AnyRecord) &&
    isAsyncIterable((resultOrStream as AnyRecord).output)
  ) {
    return (resultOrStream as AnyRecord).output as AsyncIterable<AnyRecord>;
  }
  throw new Error('Invalid callStream result');
};

const toDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getWeekRange = (): { startDate: string; endDate: string } => {
  const today = new Date();
  const weekday = today.getDay();
  const offset = weekday === 0 ? 6 : weekday - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - offset);
  return { startDate: toDateString(monday), endDate: toDateString(today) };
};

const fetchWeekReports = async (
  reporterId: string,
  startDate: string,
  endDate: string,
): Promise<DailyReport[]> => {
  const collected: DailyReport[] = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;
  while (collected.length < total && page <= WEEK_MAX_PAGES) {
    const response = await getDailyReports({
      reporterId,
      startDate,
      endDate,
      page,
      pageSize: WEEK_PAGE_SIZE,
    });
    collected.push(...response.items);
    total = response.total;
    if (response.items.length === 0) break;
    page += 1;
  }
  return collected.sort((a: DailyReport, b: DailyReport) =>
    a.reportDate.localeCompare(b.reportDate),
  );
};

const DRAFT_JSON_TEMPLATE = `{"tasks":[{"taskSource":"项目任务","taskName":"","completionRows":[{"projectNames":[],"projectCodes":[],"completion":""}],"outputFileCount":"","assistanceNeeded":""}]}`;

const PROJECT_CATALOG = ALL_PROJECTS.map(
  (p) => `${p.name}（${p.code}）`,
).join('、');

const buildDailyPrompt = (material: string): string => `你是一名企业工作日报撰写助手，服务对象是北京碧海能源装备有限公司的员工。请根据员工提供的素材（可能是口述、随手记录、飞书群聊天记录、会议纪要），整理成当天的工作日报。

要求：
1. 按「任务」逐条归纳，同一件事不要拆成多条；群聊中的寒暄、表情、与工作无关的消息直接忽略。
2. 每条任务必须输出以下字段，字段名与日报表单一一对应：taskSource（任务来源）、taskName（任务名称）、completionRows（当日完成情况，按项目分行）、outputFileCount（输出文件数量）、assistanceNeeded（需协助事项）。
3. taskSource 只能从以下选项取值：${TASK_SOURCES.join('、')}。
4. completionRows 是数组，每行代表一个项目当天的完成情况：projectNames 写项目名称、projectCodes 写项目编号、completion 写当天具体做了什么和产出；一个任务涉及多个项目时输出多行，行内 projectNames 与 projectCodes 个数和顺序要一一对应。
5. projectNames / projectCodes 只能从下列项目清单中选取（名称与编号必须成对引用，不得自造项目）：${PROJECT_CATALOG}。素材里没有对应项目时留空数组 []，并在 completion 里写清楚工作内容。
6. outputFileCount 是文本口径，按素材写清楚产出，例如「3张图+1份文档」；没有产出时留空字符串。
7. assistanceNeeded 写需要他人或部门协助的卡点；没有卡点留空字符串。
8. 不编造素材中没有的事实，确实缺失的信息留空字符串，不要写「待补充」。
9. 先输出一段简洁的中文日报正文供员工阅读核对，然后在末尾追加一个 json 代码块，严格按下面结构输出，字段名不可改动、不要添加注释：

\`\`\`json
${DRAFT_JSON_TEMPLATE}
\`\`\`

员工提供的素材：
${material}`;

const DAILY_GUIDE_MESSAGE = `好的，我来带你一步步填今天的日报。请告诉我下面这些信息（可以一次性说完，也可以分几条发我）：

1. 今天主要做了哪几件事（任务名称、属于哪个项目或项目编号）
2. 每件事具体做了什么、产出了什么（图纸、文件、方案等，比如「3张图+1份文档」）
3. 有没有卡点或需要他人协助的地方

也可以直接从飞书群里把今天的工作聊天记录粘贴给我，我按事项帮你归纳成规范日报。`;

const buildWeeklyPrompt = (
  reports: DailyReport[],
  startDate: string,
  endDate: string,
): string => {
  const lines = reports
    .map((report: DailyReport) => {
      const blocker = report.assistanceNeeded || '无';
      const content = report.dayCompletion || '待补充';
      return `- ${report.reportDate}｜${report.taskSource}｜${report.taskName}｜当日完成情况：${content}｜产出文件数：${report.outputFileCount}｜卡点：${blocker}`;
    })
    .join('\n');

  return `你是一名企业工作周报撰写助手，服务对象是北京碧海能源装备有限公司的员工。请根据本周的真实日报记录，生成一份本周工作周报草稿。

要求：
1. 按任务来源分组（部门日常、项目任务、投标项目、临时需求、会议安排、跨部门协作），组内逐条列出任务名称与本周进展。
2. 单独输出「本周产出」「工时合计」「完成情况概览」。
3. 单独输出「卡点与问题」，把日报中的困难、需要的协助集中呈现。
4. 语言正式、结构清晰，不编造未提供的记录。

统计周期：${startDate} 至 ${endDate}
本周日报记录（共 ${reports.length} 条）：
${lines}`;
};

const buildPolishPrompt = (material: string): string => `你是一名企业公文写作助手，服务对象是北京碧海能源装备有限公司的员工。请把下面这段日报内容润色为更专业、更凝练、更符合企业日报规范的表述。

要求：
1. 保留原有事实、数据与结论，不得编造、不得夸大。
2. 使用书面化的动宾结构表述，去除口语与冗余。
3. 直接输出润色后的日报正文，不要附加解释。

原文：
${material}`;

const getErrorMessage = (error: unknown, fallback: string): string => {
  const response = (error as { response?: { data?: { error?: { message?: string } } } })
    ?.response;
  return response?.data?.error?.message ?? fallback;
};

const streamText = async (
  prompt: string,
  onDelta: (text: string) => void,
): Promise<string> => {
  const streamResult: unknown = await capabilityClient
    .load(PLUGIN_INSTANCE_ID)
    .callStream('textGenerate', { prompt });
  let accumulated = '';
  for await (const chunk of normalizeStream(streamResult)) {
    const piece = typeof chunk.content === 'string' ? chunk.content : '';
    if (!piece) continue;
    accumulated += piece;
    onDelta(accumulated);
  }
  return accumulated;
};

const streamTextWithRetry = async (
  prompt: string,
  onDelta: (text: string) => void,
): Promise<string> => {
  try {
    return await streamText(prompt, onDelta);
  } catch (error) {
    logger.warn('数智员工首次生成失败，正在重试', error);
    await new Promise((resolve: (value: void) => void) =>
      window.setTimeout(resolve, RETRY_DELAY_MS),
    );
    return await streamText(prompt, onDelta);
  }
};

export const AiEmployeeDrawer: React.FC<AiEmployeeDrawerProps> = ({
  open,
  onOpenChange,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const user = useCurrentUserProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const idRef = useRef(0);

  const busy = isGenerating || isPreparing;

  useEffect(() => {
    if (!open) return;
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  const nextId = (): string => {
    idRef.current += 1;
    return `msg-${idRef.current}`;
  };

  const generate = async (
    prompt: string,
    userText: string,
    parseDraft: boolean,
  ): Promise<void> => {
    if (isGenerating) return;
    const assistantId = nextId();
    setMessages((prev: ChatMessage[]) => [
      ...prev,
      { id: nextId(), role: 'user', content: userText },
      { id: assistantId, role: 'assistant', content: '', streaming: true },
    ]);
    setIsGenerating(true);
    try {
      const raw = await streamTextWithRetry(prompt, (partial: string) => {
        const visible = stripJsonBlock(partial);
        setMessages((prev: ChatMessage[]) =>
          prev.map((message: ChatMessage) =>
            message.id === assistantId
              ? { ...message, content: visible }
              : message,
          ),
        );
      });
      const parsed = parseDraft
        ? extractDraft(raw)
        : { body: raw.trim(), tasks: [] };
      setMessages((prev: ChatMessage[]) =>
        prev.map((message: ChatMessage) =>
          message.id === assistantId
            ? {
                ...message,
                content:
                  parsed.body ||
                  '本次没有生成内容，请补充更具体的素材后重试。',
                tasks: parsed.tasks,
                streaming: false,
              }
            : message,
        ),
      );
    } catch (error) {
      logger.error('数智员工生成失败', error);
      toast.error(
        getErrorMessage(
          error,
          '数智员工服务暂时不可用，请稍后重试（已自动重试一次）',
        ),
      );
      setMessages((prev: ChatMessage[]) =>
        prev.filter((message: ChatMessage) => message.id !== assistantId),
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSend = async (): Promise<void> => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    await generate(buildDailyPrompt(text), text, true);
  };

  const handleDailyDraft = async (): Promise<void> => {
    if (busy) return;
    const material = input.trim();
    if (!material) {
      setMessages((prev: ChatMessage[]) => [
        ...prev,
        { id: nextId(), role: 'assistant', content: DAILY_GUIDE_MESSAGE },
      ]);
      return;
    }
    setInput('');
    await generate(buildDailyPrompt(material), material, true);
  };

  const handleWeeklyDraft = async (): Promise<void> => {
    if (busy) return;
    const reporterId = user?.user_id;
    if (!reporterId) {
      toast.error('用户信息加载中，请稍后重试');
      return;
    }
    setIsPreparing(true);
    try {
      const { startDate, endDate } = getWeekRange();
      const reports = await fetchWeekReports(reporterId, startDate, endDate);
      if (reports.length === 0) {
        toast.error('本周暂无日报记录，请先填写日报后再生成周报草稿');
        return;
      }
      const userText = `写本周周报草稿（${startDate} 至 ${endDate}，共 ${reports.length} 条日报）`;
      await generate(
        buildWeeklyPrompt(reports, startDate, endDate),
        userText,
        false,
      );
    } catch (error) {
      logger.error('获取本周日报失败', error);
      toast.error(getErrorMessage(error, '获取本周日报失败，请稍后重试'));
    } finally {
      setIsPreparing(false);
    }
  };

  const handlePolish = async (): Promise<void> => {
    if (busy) return;
    const material = input.trim();
    if (!material) {
      toast.error('请先在输入框填写需要润色的日报内容');
      return;
    }
    setInput('');
    await generate(buildPolishPrompt(material), material, false);
  };

  const handleApplyDraft = (task: DailyDraftTask): void => {
    saveDailyDraft(task);
    const onNewPage = location.pathname.replace(/\/+$/u, '') === NEW_REPORT_PATH;
    if (onNewPage) {
      window.dispatchEvent(
        new CustomEvent<ApplyDailyDraftDetail>(APPLY_DAILY_DRAFT_EVENT, {
          detail: { task },
        }),
      );
      toast.success('已带入当前日报表单，请核对后保存');
    } else {
      toast.success('已带入日报表单，请核对后保存');
      navigate(NEW_REPORT_PATH);
    }
    onOpenChange(false);
  };

  const handleCopy = async (message: ChatMessage): Promise<void> => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id);
      toast.success('日报草稿已复制到剪贴板');
    } catch (error) {
      logger.error('复制失败', error);
      toast.error('复制失败，请手动选择文本复制');
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-[480px]">
        <div className="relative flex shrink-0 items-center gap-3 bg-gradient-to-br from-primary to-primary/85 px-5 py-4 text-primary-foreground">
          <span className="pointer-events-none absolute -right-10 -top-12 size-32 rounded-full bg-white/15 blur-xl" />
          <Image
            src={aiAvatarUrl}
            alt="碧海数智员工形象"
            width={48}
            height={48}
            className="size-12 shrink-0 rounded-full object-cover ring-4 ring-white/40"
          />
          <div className="relative min-w-0 flex-1">
            <DrawerTitle className="text-base text-primary-foreground">
              碧海数智员工
            </DrawerTitle>
            <DrawerDescription className="truncate text-xs text-primary-foreground/85">
              带你填日报：说一段话或粘贴群记录，我整理好直接填进表单
            </DrawerDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="relative text-primary-foreground hover:bg-white/15"
            aria-label="关闭数智员工面板"
            onClick={() => onOpenChange(false)}
          >
            <X className="size-4" />
          </Button>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 space-y-4 overflow-y-auto bg-slate-50/60 px-4 py-4"
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-primary/15 bg-white px-4 py-6 text-center">
              <Image
                src={aiAvatarUrl}
                alt="碧海数智员工形象"
                width={56}
                height={56}
                className="size-14 rounded-full object-cover ring-2 ring-primary/15"
              />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-800">
                  我是碧海数智员工
                </p>
                <p className="text-xs leading-relaxed text-slate-500">
                  告诉我你今天做了什么，或者把飞书群里的工作聊天记录粘贴进来，我整理成规范日报并一键填进表单，你核对后保存即可。
                </p>
              </div>
            </div>
          ) : null}

          {messages.map((message: ChatMessage) => (
            <div
              key={message.id}
              className={cn(
                'flex gap-2',
                message.role === 'user' ? 'justify-end' : 'justify-start',
              )}
            >
              {message.role === 'assistant' ? (
                <Image
                  src={aiAvatarUrl}
                  alt="碧海数智员工形象"
                  width={32}
                  height={32}
                  className="mt-0.5 size-8 shrink-0 rounded-full object-cover ring-2 ring-white"
                />
              ) : null}
              <div
                className={cn(
                  'max-w-[78%] rounded-xl px-3 py-2 text-sm leading-relaxed',
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-slate-200/80 bg-white text-slate-700 shadow-sm',
                )}
              >
                <p className="whitespace-pre-wrap break-words">
                  {message.content}
                  {message.streaming ? (
                    <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-primary align-middle" />
                  ) : null}
                </p>
                {message.role === 'assistant' && message.content ? (
                  <div className="mt-2 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 px-2 text-xs text-slate-500 hover:text-primary"
                      aria-label="复制全文"
                      onClick={() => handleCopy(message)}
                    >
                      {copiedId === message.id ? (
                        <Check className="size-3.5" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                      复制全文
                    </Button>
                  </div>
                ) : null}
                {message.role === 'assistant' &&
                message.tasks &&
                message.tasks.length > 0 ? (
                  <div className="mt-1 space-y-1.5 border-t border-slate-100 pt-2">
                    <p className="text-[11px] font-medium text-slate-500">
                      一键带入日报表单
                    </p>
                    {message.tasks.map(
                      (task: DailyDraftTask, index: number) => (
                        <Button
                          key={`${message.id}-task-${index}`}
                          variant="outline"
                          size="sm"
                          className="h-auto w-full justify-start gap-1.5 border-primary/25 py-1.5 text-left text-xs leading-snug text-primary hover:bg-primary/5"
                          aria-label={`带入表单：${task.taskName}`}
                          onClick={() => handleApplyDraft(task)}
                        >
                          <FilePlus2 className="size-3.5 shrink-0" />
                          <span className="truncate">
                            带入表单：{task.taskName}
                          </span>
                        </Button>
                      ),
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          ))}

          {isGenerating ? (
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <Sparkles className="size-3.5 text-primary" />
              数智员工正在起草中…
            </p>
          ) : null}
        </div>

        <div className="shrink-0 space-y-3 border-t border-slate-200/70 bg-white px-4 py-3">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-primary/20 text-primary hover:bg-primary/5"
              disabled={busy}
              onClick={handleDailyDraft}
            >
              <FileText className="size-3.5" />
              写今日日报草稿
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-primary/20 text-primary hover:bg-primary/5"
              disabled={busy}
              onClick={handleWeeklyDraft}
            >
              <CalendarRange className="size-3.5" />
              写本周周报草稿
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-primary/20 text-primary hover:bg-primary/5"
              disabled={busy}
              onClick={handlePolish}
            >
              <Wand2 className="size-3.5" />
              润色日报内容
            </Button>
          </div>

          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSend();
            }}
          >
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="说说今天做了什么，或粘贴飞书群聊天记录"
              disabled={busy}
              aria-label="与数智员工对话的输入框"
              className="flex-1"
            />
            <Button
              type="submit"
              size="icon"
              aria-label="发送"
              disabled={busy || input.trim().length === 0}
            >
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default AiEmployeeDrawer;
