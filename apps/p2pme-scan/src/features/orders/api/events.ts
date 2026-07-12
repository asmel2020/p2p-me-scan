import apiClient from '@/api/client';
import type { OrderEvent, PaginatedResponse, EventQueryParams } from '../types';

export async function fetchEvents(params: EventQueryParams = {}): Promise<PaginatedResponse<OrderEvent>> {
  const { data } = await apiClient.get<PaginatedResponse<OrderEvent>>('/events', { params });
  return data;
}
