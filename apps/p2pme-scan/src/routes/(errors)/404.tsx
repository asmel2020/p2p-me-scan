import { NotFoundError } from "@/features/errors/404";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(errors)/404")({
  component: NotFoundError,
});
