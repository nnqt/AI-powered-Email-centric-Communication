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
  email: string;
  name?: string;
  org?: string;
  language?: string;
  threads: SandboxScenarioThread[];
}

export interface SandboxScenario {
  scenarioName?: string;
  contacts: SandboxScenarioContact[];
}

export type SandboxInjectPayload = SandboxScenario[];
