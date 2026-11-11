import { useQuery } from '@tanstack/react-query';

import { dataScopeApi } from '@/api';
import type { DataScopeInfo } from '@shared/api.interface';

export const useDataScope = () =>
  useQuery<DataScopeInfo>({
    queryKey: ['data-scope', 'me'],
    queryFn: () => dataScopeApi.getMyDataScope(),
    staleTime: 60_000,
  });
