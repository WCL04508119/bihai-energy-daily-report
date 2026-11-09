import { Link } from 'react-router-dom';
import { Sun, Wind, Droplets, Trees, PenLine, ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Image } from '@client/src/components/ui/image';

const heroUrl =
  '/spark/app/app_17hcpbyjja6/runtime/api/v1/storage/object/bucket_aadk5lknep6bw_static/static%2Faadk5qviky2vq_ve_miaoda';

const natureIcons = [
  { icon: Sun, label: '能源' },
  { icon: Wind, label: '大气' },
  { icon: Droplets, label: '水' },
  { icon: Trees, label: '土壤' },
];

const WelcomeHero = () => {
  return (
    <div className="animate-fade-up relative min-h-[400px] w-full overflow-hidden rounded-2xl text-white shadow-lg shadow-primary/10 md:min-h-[360px]">
      {/* 插画铺满整卡作为背景 */}
      <Image
        src={heroUrl}
        alt=""
        sizes="100vw"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* 顶部轻渐变，保证上缘文字可读 */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(to bottom, rgba(10,20,36,0.22) 0%, rgba(10,20,36,0) 45%)',
        }}
      />
      {/* 全宽从左深蓝平滑渐到右侧透明，无硬边；整体调轻，保持插画清晰 */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(6,16,32,0.88) 0%, rgba(6,16,32,0.8) 26%, rgba(6,16,32,0.55) 50%, rgba(6,16,32,0.22) 72%, rgba(6,16,32,0) 90%)',
        }}
      />

      {/* 文案区——左侧通高、大而实的新蓝渐变遮罩承载文字，向右淡出露出插画 */}
      <div className="relative z-10 flex h-full flex-col justify-center gap-5 px-6 py-10 sm:px-8 lg:px-12 lg:py-14 md:max-w-[72%]">
        <div className="inline-flex w-fit items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1 backdrop-blur-sm">
          {natureIcons.map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1 text-xs font-medium text-white/90"
            >
              <Icon className="size-3.5" />
              {label}
            </span>
          ))}
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold leading-snug text-white sm:text-4xl lg:text-5xl">
            致力于能源 大气 水 土壤<span className="text-amber-300">的和谐</span>
          </h1>
          <div className="flex items-center gap-3">
            <span className="h-6 w-1 rounded-full bg-amber-300" />
            <p className="text-base font-semibold tracking-wide text-white/95 sm:text-lg">
              碧海工作汇报系统
            </p>
          </div>
        </div>

        <p className="max-w-xl text-sm leading-relaxed text-white/80 sm:text-base">
          辛苦一天，留下成果——愿你的每一份努力都被认真看见，
          <br className="hidden sm:block" />
          点滴积累，汇成碧海。
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Button asChild size="lg" className="bg-white text-[hsl(0_72%_38%)] shadow-sm hover:bg-white/95">
            <Link to="/daily-report/new">
              <PenLine className="size-4" />
              开始今日日报
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <span className="text-xs text-white/70">记录工作进展，系统自动汇总周报与月报</span>
        </div>
      </div>
    </div>
  );
};

export default WelcomeHero;