import { ForbiddenError } from "@/features/errors/403";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(errors)/403")({
  component: ForbiddenError,
});
