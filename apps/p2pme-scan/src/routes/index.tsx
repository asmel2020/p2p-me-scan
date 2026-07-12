import { createFileRoute } from "@tanstack/react-router";
import { OrdersPage } from "@/features/orders/page";

export const Route = createFileRoute("/")({
  component: () => <OrdersPage />,
});
