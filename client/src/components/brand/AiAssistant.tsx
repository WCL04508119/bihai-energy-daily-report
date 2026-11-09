import aiAvatarUrl from '@/assets/ai-assistant.png';
import { cn } from '@/lib/utils';
import { Image } from '@client/src/components/ui/image';

interface AiAssistantProps {
  onOpen?: () => void;
  className?: string;
  compact?: boolean;
}

export const AiAssistant: React.FC<AiAssistantProps> = ({
  onOpen,
  className,
  compact = false,
}) => (
  <button
    type="button"
    onClick={onOpen}
    className={cn(
      'group relative w-full overflow-hidden rounded-xl border border-primary/15 bg-gradient-to-br from-primary/[0.08] via-white to-primary/[0.03] text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_8px_24px_-8px_rgba(178_34_34_0.35)]',
      compact ? 'p-2' : 'p-3',
      className,
    )}
    aria-label="打开碧海数智员工"
  >
    <span className="pointer-events-none absolute -right-6 -top-8 size-20 rounded-full bg-primary/10 blur-2xl transition-opacity duration-300 group-hover:opacity-80" />
    <div className="relative flex items-center gap-2.5">
      <span className="relative shrink-0">
        <Image
          src={aiAvatarUrl}
          alt="碧海数智员工形象"
          className={cn(
            'rounded-full object-cover ring-2 ring-white shadow-sm transition-transform duration-300 group-hover:scale-105',
            compact ? 'size-8' : 'size-11',
          )}
        />
        <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-emerald-500 ring-2 ring-white" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-800">碧海数智员工</p>
        <p className="truncate text-xs text-slate-500">
          让数智员工帮你写日报 / 周报
        </p>
      </div>
    </div>
  </button>
);
