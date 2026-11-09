import React from 'react';

interface ReportStat {
  label: string;
  value: string | number;
  suffix?: string;
}

interface ReportHeaderProps {
  title: string;
  subtitle: string;
  meta?: string;
  stats: ReportStat[];
}

const ReportHeader: React.FC<ReportHeaderProps> = ({ title, subtitle, meta, stats }) => {
  return (
    <div className="animate-fade-up overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-[hsl(0_70%_26%)] via-[hsl(0_70%_36%)] to-[hsl(0_60%_44%)] text-white shadow-sm">
      <div className="px-6 py-6 lg:px-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-white/60">
          BSS · 工作报告
        </p>
        <h1 className="mt-2.5 text-2xl font-bold leading-tight lg:text-[28px]">{title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/85">
          <span>{subtitle}</span>
          {meta ? (
            <>
              <span className="h-3.5 w-px bg-white/25" aria-hidden />
              <span className="text-white/70">{meta}</span>
            </>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-2 border-t border-white/15 bg-white/[0.07] lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="border-r border-white/10 px-6 py-3.5 last:border-r-0">
            <p className="text-xs text-white/65">{stat.label}</p>
            <p className="mt-0.5 truncate text-lg font-semibold tabular-nums">
              {stat.value}
              {stat.suffix ? (
                <span className="ml-0.5 text-xs font-normal text-white/70">{stat.suffix}</span>
              ) : null}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReportHeader;
