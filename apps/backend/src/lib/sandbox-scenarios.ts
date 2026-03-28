import angryCustomerScenario from "@/lib/mock-data/scenario-angry-customer.json";
import paymentDisputeScenario from "@/lib/mock-data/scenario-payment-dispute.json";

export type SandboxScenarioSlug = "angry-customer" | "payment-dispute";

export interface SandboxScenarioRegistryItem {
  slug: SandboxScenarioSlug;
  title: string;
  description: string;
  scenario: unknown[];
}

const SANDBOX_SCENARIO_REGISTRY: SandboxScenarioRegistryItem[] = [
  {
    slug: "angry-customer",
    title: "Khach Hang Buc Xuc - Don Hang Giao Tre",
    description:
      "Thread 4 email ngat quang, ket thuc bang yeu cau chua duoc dap ung de test Smart Reply.",
    scenario: angryCustomerScenario,
  },
  {
    slug: "payment-dispute",
    title: "Tranh Chap Thanh Toan - Tru Tien Hai Lan",
    description:
      "Thread 4 email chuyen cap tai chinh, khach hang dang cho cam ket cu the de test Smart Reply.",
    scenario: paymentDisputeScenario,
  },
];

export function getSandboxScenarioList() {
  return SANDBOX_SCENARIO_REGISTRY.map(({ slug, title, description }) => ({
    slug,
    title,
    description,
  }));
}

export function getSandboxScenarioBySlug(slug: string) {
  return SANDBOX_SCENARIO_REGISTRY.find((item) => item.slug === slug);
}
