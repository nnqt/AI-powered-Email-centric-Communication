export interface SandboxScenarioMessage {
  from?: string;
  to?: string[];
  subject?: string;
  body: string;
  snippet?: string;
  labelIds?: string[];
  date?: string;
  dateOffsetMs?: number;
}

export interface SandboxScenarioTelegramMessage {
  senderId?: string;
  text: string;
  date?: string;
  dateOffsetMs?: number;
  isOutbound?: boolean;
}

export interface SandboxScenarioTelegramChat {
  chatId: string;
  title: string;
  type?: "private" | "group" | "channel";
  unreadCount?: number;
  messages: SandboxScenarioTelegramMessage[];
  date?: string;
  dateOffsetMs?: number;
}

export interface SandboxScenarioTelegramContact {
  telegramId: string;
  telegramUsername?: string;
  telegramName?: string;
  chats: SandboxScenarioTelegramChat[];
}

export interface SandboxScenarioThread {
  subject: string;
  snippet?: string;
  participants?: string[];
  messages: SandboxScenarioMessage[];
  isRead?: boolean;
  isArchived?: boolean;
  date?: string;
  dateOffsetMs?: number;
}

export interface SandboxScenarioContact {
  email?: string;
  name?: string;
  org?: string;
  language?: string;
  threads?: SandboxScenarioThread[];
  telegram?: SandboxScenarioTelegramContact;
}

export interface SandboxScenario {
  scenarioName?: string;
  contacts: SandboxScenarioContact[];
}

export type SandboxInjectPayload = SandboxScenario[];
