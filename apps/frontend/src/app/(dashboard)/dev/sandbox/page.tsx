"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSWRConfig } from "swr";

import apiClient from "@/lib/api";
import { isSandboxUiEnabled } from "@/lib/sandbox";
import { useToast } from "@/components/Toast";

type SandboxFormState = {
  senderName: string;
  senderEmail: string;
  subject: string;
  message: string;
};

type SandboxScenarioOption = {
  slug: string;
  title: string;
  description: string;
};

const initialForm: SandboxFormState = {
  senderName: "",
  senderEmail: "",
  subject: "",
  message: "",
};

export default function DevSandboxPage() {
  const router = useRouter();
  const { showToast, updateToast } = useToast();
  const { mutate } = useSWRConfig();

  const revalidateAfterSandboxWrite = async () => {
    await Promise.all([
      mutate(
        (key: unknown) =>
          typeof key === "string" && key.startsWith("/api/contacts"),
        undefined,
        { revalidate: true },
      ),
      mutate(
        (key: unknown) =>
          typeof key === "string" && key.startsWith("/api/threads"),
        undefined,
        { revalidate: true },
      ),
      mutate(
        (key: unknown) =>
          typeof key === "string" && key.startsWith("/api/focus"),
        undefined,
        { revalidate: true },
      ),
      mutate(
        (key: unknown) =>
          typeof key === "string" && key.startsWith("/api/topics"),
        undefined,
        { revalidate: true },
      ),
    ]);
  };

  const [isInjectingScenario, setIsInjectingScenario] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isSubmittingWebhook, setIsSubmittingWebhook] = useState(false);
  const [isLoadingScenario, setIsLoadingScenario] = useState(false);
  const [isLoadingScenarioList, setIsLoadingScenarioList] = useState(false);
  const [scenarioOptions, setScenarioOptions] = useState<SandboxScenarioOption[]>(
    [],
  );
  const [selectedScenarioSlug, setSelectedScenarioSlug] = useState("");
  const [form, setForm] = useState<SandboxFormState>(initialForm);

  useEffect(() => {
    if (!isSandboxUiEnabled) {
      router.replace("/");
    }
  }, [router]);

  const canSubmitWebhook = useMemo(
    () =>
      form.senderName.trim() &&
      form.senderEmail.trim() &&
      form.subject.trim() &&
      form.message.trim(),
    [form],
  );

  const selectedScenario = useMemo(
    () => scenarioOptions.find((item) => item.slug === selectedScenarioSlug),
    [scenarioOptions, selectedScenarioSlug],
  );

  const loadScenarioOptions = async () => {
    setIsLoadingScenarioList(true);
    try {
      const response = await apiClient.get<{ scenarios: SandboxScenarioOption[] }>(
        "/api/sandbox/scenarios",
      );
      const options = response.data?.scenarios ?? [];
      setScenarioOptions(options);

      if (options.length > 0) {
        setSelectedScenarioSlug((prev) =>
          prev && options.some((item) => item.slug === prev)
            ? prev
            : options[0].slug,
        );
      }
    } catch (error: any) {
      const details =
        error?.response?.data?.error || "Failed to load scenario list";
      showToast(details, "error");
    } finally {
      setIsLoadingScenarioList(false);
    }
  };

  useEffect(() => {
    void loadScenarioOptions();
  }, []);

  const loadScenarioBySlug = async (slug: string) => {
    setIsLoadingScenario(true);
    try {
      const response = await apiClient.get<{ scenario: unknown[] }>(
        `/api/sandbox/scenarios/${slug}`,
      );
      return response.data?.scenario ?? [];
    } finally {
      setIsLoadingScenario(false);
    }
  };

  const injectScenario = async () => {
    if (!selectedScenarioSlug) {
      showToast("Please choose a scenario first", "warning");
      return;
    }

    const scenarioLabel = selectedScenario?.title || selectedScenarioSlug;
    const toastId = showToast(`Injecting ${scenarioLabel}...`, "processing");
    setIsInjectingScenario(true);

    try {
      const scenarioPayload = await loadScenarioBySlug(selectedScenarioSlug);
      if (!Array.isArray(scenarioPayload) || scenarioPayload.length === 0) {
        throw new Error("Scenario payload is empty");
      }

      const response = await apiClient.post(
        "/api/sandbox/inject",
        scenarioPayload,
      );
      const created = response.data?.created;

      updateToast(
        toastId,
        `Injected: ${created?.contacts ?? 0} contacts, ${created?.threads ?? 0} threads, ${created?.messages ?? 0} messages`,
        "success",
      );
      await revalidateAfterSandboxWrite();
    } catch (error: any) {
      const details =
        error?.response?.data?.error || "Failed to inject scenario";
      updateToast(toastId, details, "error");
    } finally {
      setIsInjectingScenario(false);
    }
  };

  const clearSandboxData = async () => {
    const toastId = showToast("Clearing sandbox data...", "processing");
    setIsClearing(true);

    try {
      const response = await apiClient.delete("/api/sandbox/clear");
      const deleted = response.data?.deleted;

      updateToast(
        toastId,
        `Cleared: ${deleted?.threads ?? 0} threads, ${deleted?.messages ?? 0} messages`,
        "success",
      );
      await revalidateAfterSandboxWrite();
    } catch (error: any) {
      const details =
        error?.response?.data?.error || "Failed to clear sandbox data";
      updateToast(toastId, details, "error");
    } finally {
      setIsClearing(false);
    }
  };

  const submitFakeWebhook = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!canSubmitWebhook) {
      showToast("Please fill in all fake webhook fields", "warning");
      return;
    }

    const payload = [
      {
        scenarioName: "Fake Webhook - Single Email",
        contacts: [
          {
            email: form.senderEmail.trim(),
            name: form.senderName.trim(),
            threads: [
              {
                subject: form.subject.trim(),
                snippet: form.message.trim().slice(0, 120),
                dateOffsetMs: 5000,
                messages: [
                  {
                    from: form.senderEmail.trim(),
                    subject: form.subject.trim(),
                    body: form.message.trim(),
                    dateOffsetMs: 5000,
                  },
                ],
              },
            ],
          },
        ],
      },
    ];

    const toastId = showToast("Injecting fake webhook email...", "processing");
    setIsSubmittingWebhook(true);

    try {
      await apiClient.post("/api/sandbox/inject", payload);
      updateToast(toastId, "Fake webhook injected successfully", "success");
      await revalidateAfterSandboxWrite();
      setForm(initialForm);
    } catch (error: any) {
      const details =
        error?.response?.data?.error || "Failed to inject fake webhook";
      updateToast(toastId, details, "error");
    } finally {
      setIsSubmittingWebhook(false);
    }
  };

  if (!isSandboxUiEnabled) {
    return (
      <div className="dev-sandbox-page dev-sandbox-page--blocked flex h-full items-center justify-center p-8">
        <div className="dev-sandbox-page__blocked-card max-w-md rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <h2 className="text-lg font-semibold text-red-700">
            Sandbox is disabled
          </h2>
          <p className="mt-2 text-sm text-red-600">
            Enable sandbox UI with NEXT_PUBLIC_ENABLE_SANDBOX_UI=true or run in development mode.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="dev-sandbox-page min-h-full bg-[radial-gradient(circle_at_top_right,_#e0f2fe_0%,_#f8fafc_42%,_#ffffff_100%)] p-6 lg:p-8">
      <div className="dev-sandbox-page__container mx-auto max-w-5xl space-y-6">
        <header className="dev-sandbox-page__header rounded-3xl border border-sky-100 bg-white/80 p-6 shadow-sm backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-500">
            Developer Toolkit
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
            Sandbox Control Center
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Inject mock conversations, test edge-cases, and purge mock data
            without touching production-like records.
          </p>
        </header>

        <section className="dev-sandbox-page__actions grid gap-4 md:grid-cols-2">
          <article className="dev-sandbox-card rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">
              Load Scenario
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Choose a mock scenario and inject it into your inbox for flow
              testing.
            </p>
            <label className="dev-sandbox-card__scenario-field mt-3 grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Scenario
              </span>
              <select
                value={selectedScenarioSlug}
                onChange={(e) => setSelectedScenarioSlug(e.target.value)}
                disabled={
                  isLoadingScenarioList ||
                  isInjectingScenario ||
                  isLoadingScenario ||
                  isClearing ||
                  isSubmittingWebhook
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {scenarioOptions.length === 0 ? (
                  <option value="">No scenarios available</option>
                ) : (
                  scenarioOptions.map((option) => (
                    <option key={option.slug} value={option.slug}>
                      {option.title}
                    </option>
                  ))
                )}
              </select>
            </label>
            {selectedScenario?.description && (
              <p className="mt-2 text-xs text-slate-500">
                {selectedScenario.description}
              </p>
            )}
            <button
              type="button"
              onClick={injectScenario}
              disabled={
                scenarioOptions.length === 0 ||
                !selectedScenarioSlug ||
                isLoadingScenarioList ||
                isInjectingScenario ||
                isLoadingScenario ||
                isClearing ||
                isSubmittingWebhook
              }
              className="mt-4 inline-flex items-center rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoadingScenarioList
                ? "Loading scenarios..."
                : isInjectingScenario || isLoadingScenario
                ? "Injecting..."
                : "Load Selected Scenario"}
            </button>
          </article>

          <article className="dev-sandbox-card rounded-2xl border border-rose-100 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">
              Purge Sandbox
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Remove all mock contacts, threads, and messages for your current
              account.
            </p>
            <button
              type="button"
              onClick={clearSandboxData}
              disabled={
                isClearing || isInjectingScenario || isSubmittingWebhook
              }
              className="mt-4 inline-flex items-center rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isClearing ? "Clearing..." : "Clear All Sandbox Data"}
            </button>
          </article>
        </section>

        <section className="dev-sandbox-page__webhook rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-900">Fake Webhook</h2>
          <p className="mt-1 text-sm text-slate-600">
            Simulate one inbound email instantly to test real-time sync and AI
            enrichment chain.
          </p>

          <form
            className="dev-sandbox-page__webhook-form mt-4 grid gap-4"
            onSubmit={submitFakeWebhook}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <label className="dev-sandbox-page__field grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Sender Name
                </span>
                <input
                  type="text"
                  value={form.senderName}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, senderName: e.target.value }))
                  }
                  placeholder="Jane Customer"
                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
              </label>

              <label className="dev-sandbox-page__field grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Sender Email
                </span>
                <input
                  type="email"
                  value={form.senderEmail}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      senderEmail: e.target.value,
                    }))
                  }
                  placeholder="jane.customer@example.com"
                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
              </label>
            </div>

            <label className="dev-sandbox-page__field grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Subject
              </span>
              <input
                type="text"
                value={form.subject}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, subject: e.target.value }))
                }
                placeholder="Need update on my request"
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </label>

            <label className="dev-sandbox-page__field grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Message
              </span>
              <textarea
                value={form.message}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, message: e.target.value }))
                }
                placeholder="I have not received any update for 3 days..."
                rows={5}
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </label>

            <div className="dev-sandbox-page__webhook-actions flex items-center justify-end">
              <button
                type="submit"
                disabled={
                  !canSubmitWebhook ||
                  isSubmittingWebhook ||
                  isInjectingScenario ||
                  isClearing
                }
                className="inline-flex items-center rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmittingWebhook ? "Injecting..." : "Submit Fake Webhook"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
