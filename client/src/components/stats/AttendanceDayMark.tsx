import {
  ATTENDANCE_DAY_STATE_LABELS,
  type AttendanceDayCell,
  type AttendanceDayState,
} from '@shared/api.interface';

interface AttendanceDayMarkProps {
  cell?: AttendanceDayCell;
  supplementDates?: string[];
}

const AttendanceDayMark: React.FC<AttendanceDayMarkProps> = ({
  cell,
  supplementDates,
}) => {
  const state: AttendanceDayState = cell?.state ?? 'missing';
  const backfilled: string[] = supplementDates ?? [];

  const titleParts: string[] = [ATTENDANCE_DAY_STATE_LABELS[state]];
  if (state === 'supplement' && cell?.submittedOn) {
    titleParts.push(`${cell.submittedOn} 提交`);
  }
  if (backfilled.length > 0) {
    titleParts.push(`该日补交了 ${backfilled.join('、')} 的日报`);
  }

  return (
    <span
      className="relative inline-flex size-7 items-center justify-center"
      title={titleParts.join('，')}
    >
      {state === 'missing' ? (
        <span className="text-rose-600">✗</span>
      ) : (
        <span
          className={
            state === 'supplement'
              ? 'font-semibold text-amber-600'
              : 'text-emerald-600'
          }
        >
          ✓
        </span>
      )}
      {state === 'supplement' ? (
        <span className="absolute right-0 top-0 rounded bg-amber-100 px-0.5 text-[9px] font-medium leading-3 text-amber-700">
          补
        </span>
      ) : backfilled.length > 0 ? (
        <span className="absolute right-0 top-0 rounded-full bg-amber-500 px-1 text-[9px] font-bold leading-3 text-white">
          {backfilled.length}
        </span>
      ) : null}
    </span>
  );
};

export default AttendanceDayMark;
