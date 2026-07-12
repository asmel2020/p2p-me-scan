import { z } from "zod";

const cursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const orderQuerySchema = cursorPaginationSchema.extend({
  status: z.enum(["placed", "accepted", "paid", "completed", "cancelled"]).optional(),
  currency: z.string().max(10).optional(),
  orderType: z.enum(["BUY", "SELL", "RENT"]).optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

export const eventQuerySchema = cursorPaginationSchema.extend({
  eventName: z.enum(["OrderPlaced", "OrderAccepted", "BuyOrderPaid", "OrderCompleted", "CancelledOrders"]).optional(),
  orderId: z.string().optional(),
  fromBlock: z.coerce.number().int().optional(),
  toBlock: z.coerce.number().int().optional(),
});
