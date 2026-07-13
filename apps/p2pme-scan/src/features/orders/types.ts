export interface Order {
  id: string;
  orderId: number;
  user: string;
  merchant: string;
  recipientAddr: string;
  acceptedMerchant: string;
  usdc: number;
  fiat: number;
  orderType: 'BUY' | 'SELL' | 'RENT';
  currency: string;
  status: 'placed' | 'accepted' | 'paid' | 'completed' | 'cancelled';
  createdBlock: number;
  updatedBlock: number;
  blockTimestamp: string;
  blockTimestampUnix: number;
  updatedAt: string;
}

export interface OrderEvent {
  id: string;
  orderId: number;
  eventName: 'OrderPlaced' | 'OrderAccepted' | 'BuyOrderPaid' | 'OrderCompleted' | 'CancelledOrders';
  user: string;
  merchant: string;
  recipientAddr: string;
  acceptedMerchant: string;
  usdc: number;
  fiat: number;
  orderType: string;
  currency: string;
  blockNumber: number;
  blockTimestamp: string;
  blockTimestampUnix: number;
  txHash: string;
  logIndex: number | null;
}

export interface OrderDetail extends Order {
  events: OrderEvent[];
}

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
}

export interface StatsResponse {
  orders: number;
  byStatus: { status: string; total: number }[];
  byCurrency: { currency: string; totalUsdc: number; totalFiat: number; count: number }[];
}

export interface OrderQueryParams {
  cursor?: string;
  limit?: number;
  status?: string;
  currency?: string;
  orderType?: string;
  fromDate?: string;
  toDate?: string;
}

export interface StatsQueryParams {
  fromDate?: string;
  toDate?: string;
  currency?: string;
}

export interface EventQueryParams {
  cursor?: string;
  limit?: number;
  eventName?: string;
  orderId?: number;
  fromBlock?: number;
  toBlock?: number;
}
