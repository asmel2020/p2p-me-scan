import { useQuery } from '@tanstack/react-query';
import { fetchEvents } from '../api/events';
import type { EventQueryParams } from '../types';

export function useEvents(params: EventQueryParams = {}) {
  return useQuery({
    queryKey: ['events', params],
    queryFn: () => fetchEvents(params),
  });
}
