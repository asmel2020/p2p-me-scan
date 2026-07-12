import { ServerError } from "@/features/errors/500";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(errors)/500")({
  component: ServerError,
});
