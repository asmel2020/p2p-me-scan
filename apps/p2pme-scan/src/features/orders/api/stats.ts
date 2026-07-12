import apiClient from '@/api/client';
import type { StatsResponse } from '../types';

export async function fetchStats(): Promise<StatsResponse> {
  const { data } = await apiClient.get<StatsResponse>('/stats');
  return data;
}
