import dayjs from 'dayjs';

export type ReportPeriodType = 'weekly' | 'monthly';

export const getWeekStartIso = (base: Date = new Date()): string => {
  const weekday: number = base.getDay();
  const offset: number = weekday === 0 ? 6 : weekday - 1;
  return dayjs(base).subtract(offset, 'day').format('YYYY-MM-DD');
};

export const getWeekEndIso = (weekStart: string): string =>
  dayjs(weekStart).add(6, 'day').format('YYYY-MM-DD');

export const getCurrentMonthIso = (): string => dayjs().format('YYYY-MM');

export const formatWeekLabel = (
  weekStart: string,
  weekEnd?: string,
): string => {
  const end: string = weekEnd || getWeekEndIso(weekStart);
  return `${dayjs(weekStart).format('YYYY年MM/DD')} ~ ${dayjs(end).format('MM/DD')}`;
};

export const formatMonthLabel = (reportMonth: string): string =>
  dayjs(`${reportMonth}-01`).format('YYYY年M月');

export const formatDateTime = (iso: string): string =>
  iso ? dayjs(iso).format('YYYY-MM-DD HH:mm') : '-';

export const getMonthRange = (
  reportMonth: string,
): { startDate: string; endDate: string } => {
  const start = dayjs(`${reportMonth}-01`);
  return {
    startDate: start.format('YYYY-MM-DD'),
    endDate: start.endOf('month').format('YYYY-MM-DD'),
  };
};

export const getPeriodRange = (
  periodType: ReportPeriodType,
  periodValue: string,
): { startDate: string; endDate: string } =>
  periodType === 'weekly'
    ? { startDate: periodValue, endDate: getWeekEndIso(periodValue) }
    : getMonthRange(periodValue);

export const getPeriodLabel = (
  periodType: ReportPeriodType,
  periodValue: string,
): string =>
  periodType === 'weekly'
    ? formatWeekLabel(periodValue)
    : formatMonthLabel(periodValue);
