import type { ReactNode } from 'react';

import { Image } from '@client/src/components/ui/image';

const heroUrl =
  '/spark/app/app_17hcpbyjja6/runtime/api/v1/storage/object/bucket_aadk5lknep6bw_static/static%2Faadk5qviky2vq_ve_miaoda';

interface EnergyHeroProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

const EnergyHero: React.FC<EnergyHeroProps> = ({ title, description, action }) => {
  return (
    <div className="animate-fade-up relative overflow-hidden rounded-2xl">
      <Image
        src={heroUrl}
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
      <div className="relative z-10 px-6 py-8 sm:px-8 md:py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="max-w-2xl min-w-0">
            <h1 className="text-2xl font-bold text-white sm:text-3xl">{title}</h1>
            {description ? (
              <p className="mt-2 text-sm leading-relaxed text-white/85 sm:text-base">
                {description}
              </p>
            ) : null}
          </div>
          {action ? (
            <div className="shrink-0 sm:pt-0.5">{action}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default EnergyHero;