import { useQuery } from '@tanstack/react-query';
import { fetchStats } from '../api/stats';
import type { StatsQueryParams } from '../types';

export function useStats(params?: StatsQueryParams) {
  return useQuery({
    queryKey: ['stats', params],
    queryFn: () => fetchStats(params),
  });
}
