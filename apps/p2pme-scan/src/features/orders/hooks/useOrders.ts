import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { fetchOrders, fetchOrder } from '../api/orders';
import type { OrderQueryParams } from '../types';

export function useOrders(params: OrderQueryParams = {}) {
  return useQuery({
    queryKey: ['orders', params],
    queryFn: () => fetchOrders(params),
  });
}

export function useOrdersInfinite(params: Omit<OrderQueryParams, 'cursor'> = {}) {
  return useInfiniteQuery({
    queryKey: ['orders', 'infinite', params],
    queryFn: ({ pageParam }) => fetchOrders({ ...params, cursor: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
  });
}

export function useOrder(orderId: string) {
  return useQuery({
    queryKey: ['order', orderId],
    queryFn: () => fetchOrder(orderId),
    enabled: !!orderId,
  });
}
