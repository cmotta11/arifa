import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

interface OnboardingInput {
  client_name: string;
  client_type: "natural" | "corporate";
  entity_name: string;
  jurisdiction: "bvi" | "panama" | "belize";
  contact_email: string;
  contact_name: string;
}

interface OnboardingResponse {
  guest_link_token: string;
  kyc_id: string;
  client_id: string;
  entity_id: string;
  expires_at: string;
}

async function submitOnboarding(
  data: OnboardingInput
): Promise<OnboardingResponse> {
  return api.post<OnboardingResponse>("/compliance/onboarding/", data);
}

export function useSubmitOnboarding() {
  return useMutation({
    mutationFn: (data: OnboardingInput) => submitOnboarding(data),
  });
}
