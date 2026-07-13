import { z } from "zod";
import { createFileRoute } from "@tanstack/react-router";
import { OrdersPage } from "@/features/orders/page";

const searchSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().default(25),
  orderId: z.coerce.number().optional(),
});

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  component: () => <OrdersPage />,
});
