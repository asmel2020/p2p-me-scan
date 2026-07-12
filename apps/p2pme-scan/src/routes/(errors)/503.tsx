import { ServiceUnavailableError } from "@/features/errors/503";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(errors)/503")({
  component: ServiceUnavailableError,
});
