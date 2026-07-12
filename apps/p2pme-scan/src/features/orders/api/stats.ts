import apiClient from '@/api/client';
import type { StatsResponse, StatsQueryParams } from '../types';

export async function fetchStats(params?: StatsQueryParams): Promise<StatsResponse> {
  const { data } = await apiClient.get<StatsResponse>('/stats', { params });
  return data;
}
