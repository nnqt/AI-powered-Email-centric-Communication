import easyOneCustomerSingleTopicScenario from "@/lib/mock-data/scenario-easy-one-customer-single-topic.json";
import easyOneCustomerMultiTopicNoiseScenario from "@/lib/mock-data/scenario-easy-one-customer-multi-topic-noise.json";
import easyOneCustomerLongThreadScenario from "@/lib/mock-data/scenario-easy-one-customer-long-thread.json";
import mediumOneCustomerMultiEmailScenario from "@/lib/mock-data/scenario-medium-one-customer-multi-email.json";
import mediumMultiCustomerMultiEmailScenario from "@/lib/mock-data/scenario-medium-multi-customer-multi-email.json";
import hardMultiCustomerEmailTelegramScenario from "@/lib/mock-data/scenario-hard-multi-customer-email-telegram.json";
import hardReleaseWarRoomScenario from "@/lib/mock-data/scenario-hard-release-war-room.json";
import integrationOneCustomerEmailTelegramScenario from "@/lib/mock-data/scenario-integration-one-customer-email-telegram.json";
import integrationMultiCustomerSharedTopicScenario from "@/lib/mock-data/scenario-integration-multi-customer-shared-topic.json";
import integrationMultiChannelNoiseEscalationScenario from "@/lib/mock-data/scenario-integration-multi-channel-noise-escalation.json";
import integrationTelegramOnlyPrivateUpsertScenario from "@/lib/mock-data/scenario-integration-telegram-only-private-upsert.json";

export type SandboxScenarioSlug =
  | "easy-one-customer-single-topic"
  | "easy-one-customer-multi-topic-noise"
  | "easy-one-customer-long-thread"
  | "medium-one-customer-multi-email"
  | "medium-multi-customer-multi-email"
  | "hard-multi-customer-email-telegram"
  | "hard-release-war-room"
  | "integration-one-customer-email-telegram"
  | "integration-multi-customer-shared-topic"
  | "integration-multi-channel-noise-escalation"
  | "integration-telegram-only-private-upsert";

export interface SandboxScenarioRegistryItem {
  slug: SandboxScenarioSlug;
  title: string;
  description: string;
  scenario: unknown[];
}

const SANDBOX_SCENARIO_REGISTRY: SandboxScenarioRegistryItem[] = [
  {
    slug: "easy-one-customer-single-topic",
    title: "Easy - Một khách hàng có một chủ đề qua email",
    description:
      "Một khách hàng, một định danh email, một chủ đề theo dõi cốt lõi.",
    scenario: easyOneCustomerSingleTopicScenario,
  },
  {
    slug: "easy-one-customer-multi-topic-noise",
    title: "Easy - Một khách hàng có nhiều chủ đề và email nhiễu",
    description:
      "Tăng độ phức tạp với chuỗi thư không liên quan và email marketing từ cùng khách hàng.",
    scenario: easyOneCustomerMultiTopicNoiseScenario,
  },
  {
    slug: "easy-one-customer-long-thread",
    title: "Easy - Một khách hàng có chuỗi thư email dài",
    description:
      "Email nghiệp vụ dài và trang trọng, kèm chuỗi thư newsletter ưu tiên thấp.",
    scenario: easyOneCustomerLongThreadScenario,
  },
  {
    slug: "medium-one-customer-multi-email",
    title: "Medium - Một khách hàng dùng nhiều email",
    description:
      "Cùng một khách hàng liên hệ bằng email PM và tài chính cho các nội dung theo dõi liên quan.",
    scenario: mediumOneCustomerMultiEmailScenario,
  },
  {
    slug: "medium-multi-customer-multi-email",
    title: "Medium - Nhiều khách hàng với nhiều kênh email",
    description:
      "Hai khách hàng, chủ đề hỗn hợp, và chuỗi thư thông tin không cần hành động.",
    scenario: mediumMultiCustomerMultiEmailScenario,
  },
  {
    slug: "hard-multi-customer-email-telegram",
    title: "Hard - Nhiều khách hàng qua email và Telegram",
    description:
      "Nội dung theo dõi đến song song từ email và Telegram.",
    scenario: hardMultiCustomerEmailTelegramScenario,
  },
  {
    slug: "hard-release-war-room",
    title: "Hard - Escalation phòng chiến dịch release",
    description:
      "Sự cố phát hành khẩn cấp được đẩy mức cảnh báo qua email và Telegram với nhiều bên liên quan.",
    scenario: hardReleaseWarRoomScenario,
  },
  {
    slug: "integration-one-customer-email-telegram",
    title: "Tích hợp - Một khách hàng, một chủ đề qua email và Telegram",
    description:
      "Bài kiểm thử liên kênh để kiểm tra hợp nhất nội dung theo dõi cùng chủ đề trên hai kênh.",
    scenario: integrationOneCustomerEmailTelegramScenario,
  },
  {
    slug: "integration-multi-customer-shared-topic",
    title: "Tích hợp - Nhiều khách hàng cùng một chủ đề liên phòng ban",
    description:
      "Bài kiểm thử liên khách hàng để kiểm tra nhóm chủ đề khi PM và Finance cùng theo dõi một mục tiêu.",
    scenario: integrationMultiCustomerSharedTopicScenario,
  },
  {
    slug: "integration-multi-channel-noise-escalation",
    title: "Tích hợp - Đa kênh, có nhiễu và leo thang cảnh báo",
    description:
      "Bài kiểm thử tích hợp nâng cao: Telegram khẩn cấp, email nghiệp vụ và email nhiễu cùng tồn tại.",
    scenario: integrationMultiChannelNoiseEscalationScenario,
  },
  {
    slug: "integration-telegram-only-private-upsert",
    title: "Tích hợp - Telegram private tạo contact mới không cần email",
    description:
      "Bài kiểm thử hồi quy cho case Telegram-only: inbound private message phải materialize contact ngay cả khi không có thread email.",
    scenario: integrationTelegramOnlyPrivateUpsertScenario,
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
