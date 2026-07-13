import apiClient from '@/api/client';
import type { Order, OrderDetail, OrderEvent, PaginatedResponse, OrderQueryParams } from '../types';

export async function fetchOrders(params: OrderQueryParams = {}): Promise<PaginatedResponse<Order>> {
  const { data } = await apiClient.get<PaginatedResponse<Order>>('/orders', { params });
  return data;
}

export async function fetchOrder(orderId: number): Promise<OrderDetail> {
  const { data } = await apiClient.get<OrderDetail>(`/orders/${orderId}`);
  return data;
}

export async function fetchOrderEvents(orderId: number): Promise<{ orderId: number; events: OrderEvent[]; total: number }> {
  const { data } = await apiClient.get<{ orderId: number; events: OrderEvent[]; total: number }>(`/orders/${orderId}/events`);
  return data;
}
