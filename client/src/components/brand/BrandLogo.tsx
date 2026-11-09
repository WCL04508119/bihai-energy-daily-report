import logoUrl from '@/assets/logo-report-system.png';
import { cn } from '@/lib/utils';
import { Image } from '@client/src/components/ui/image';

interface BrandLogoProps {
  className?: string;
  height?: number;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ className, height = 48 }) => (
  <Image
    src={logoUrl}
    alt="碧海工作汇报系统 · BSS 碧海能源"
    style={{ height }}
    className={cn('w-auto select-none', className)}
    draggable={false}
  />
);
