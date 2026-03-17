import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { emitToUser } from "@/lib/socketServer";
import { AIService } from "@/modules/ai/ai.service";
import { TopicService } from "@/modules/topics/topic.service";
import { Contact } from "@/models/Contact";
import { Thread } from "@/models/Thread";
import { Message } from "@/models/Message";
import { User } from "@/models/User";
import type {
  SandboxInjectPayload,
  SandboxScenario,
  SandboxScenarioMessage,
} from "@/types/sandbox";

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "").trim();
}

function toDateOrFallback(
  dateValue: string | undefined,
  dateOffsetMs: number | undefined,
  fallbackMs: number,
): Date {
  if (dateValue) {
    const parsed = new Date(dateValue);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  if (typeof dateOffsetMs === "number") {
    return new Date(Date.now() - Math.abs(dateOffsetMs));
  }

  return new Date(fallbackMs);
}

function buildSandboxEmail(baseEmail: string, suffix: string): string {
  const [localPart, domainPart] = baseEmail.split("@");
  if (!localPart || !domainPart) {
    return `mock-${suffix}@sandbox.local`;
  }

  return `${localPart}+sandbox-${suffix}@${domainPart}`;
}

function normalizeMessage(
  message: SandboxScenarioMessage,
  contactEmail: string,
  userEmail?: string,
): {
  from: string;
  to: string[];
  subject?: string;
  body: string;
  snippet?: string;
  labelIds: string[];
} {
  const from = (message.from || contactEmail).trim();
  const to =
    message.to?.map((v) => v.trim()).filter(Boolean) ||
    (userEmail ? [userEmail] : []);

  return {
    from,
    to,
    subject: message.subject,
    body: message.body,
    snippet: message.snippet,
    labelIds: message.labelIds || [],
  };
}

export async function POST(request: NextRequest) {
  try {
    const sandboxApiEnabled =
      process.env.NODE_ENV === "development" ||
      process.env.ENABLE_SANDBOX_API === "true";
    if (!sandboxApiEnabled) {
      return NextResponse.json(
        { error: "Sandbox API is disabled in this environment" },
        { status: 403 },
      );
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session as any).user.id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    }

    const body = await request.json();
    const scenarios = Array.isArray(body)
      ? (body as SandboxInjectPayload)
      : (body?.scenarios as SandboxInjectPayload | undefined);

    if (!scenarios || scenarios.length === 0) {
      return NextResponse.json(
        { error: "Payload must be a non-empty array of sandbox scenarios" },
        { status: 422 },
      );
    }

    const hasInvalidScenario = scenarios.some(
      (scenario) =>
        !scenario ||
        !Array.isArray((scenario as SandboxScenario).contacts) ||
        (scenario as SandboxScenario).contacts.length === 0 ||
        (scenario as SandboxScenario).contacts.some(
          (contact) =>
            !contact ||
            !contact.email ||
            !Array.isArray(contact.threads) ||
            contact.threads.length === 0 ||
            contact.threads.some(
              (thread) =>
                !thread || !thread.subject || !Array.isArray(thread.messages),
            ),
        ),
    );

    if (hasInvalidScenario) {
      return NextResponse.json(
        {
          error:
            "Invalid scenario format. Require contacts[].threads[].messages[] with email and subject.",
        },
        { status: 422 },
      );
    }

    await connectToDatabase();

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const user = await User.findById(userId).lean();
    const userEmail = user?.email?.toLowerCase();

    const aiService = new AIService();
    const topicService = new TopicService();

    let createdContacts = 0;
    let createdThreads = 0;
    let createdMessages = 0;
    let fallbackTick = 0;

    const createdThreadDocIds: mongoose.Types.ObjectId[] = [];

    // Keep all DB writes in one guarded block for safer sandbox injection.
    try {
      for (
        let scenarioIndex = 0;
        scenarioIndex < scenarios.length;
        scenarioIndex += 1
      ) {
        const scenario = scenarios[scenarioIndex];

        for (
          let contactIndex = 0;
          contactIndex < scenario.contacts.length;
          contactIndex += 1
        ) {
          const contactInput = scenario.contacts[contactIndex];
          const rawEmail = contactInput.email?.trim().toLowerCase();

          if (!rawEmail) {
            continue;
          }

          const conflictRealContact = await Contact.findOne({
            userId: userObjectId,
            email: rawEmail,
            isMock: { $ne: true },
          }).lean();

          const emailSuffix = `${scenarioIndex}-${contactIndex}-${Date.now()}`;
          const sandboxEmail = conflictRealContact
            ? buildSandboxEmail(rawEmail, emailSuffix)
            : rawEmail;

          let contactDoc = await Contact.findOne({
            userId: userObjectId,
            email: sandboxEmail,
            isMock: true,
          });

          if (!contactDoc) {
            contactDoc = await Contact.create({
              userId: userObjectId,
              email: sandboxEmail,
              name: contactInput.name,
              org: contactInput.org,
              language: contactInput.language,
              alternateEmails: [],
              category: "unknown",
              categories: [],
              categorySource: "rule",
              aiEnriched: false,
              isMock: true,
            });
            createdContacts += 1;
          }

          for (
            let threadIndex = 0;
            threadIndex < contactInput.threads.length;
            threadIndex += 1
          ) {
            const threadInput = contactInput.threads[threadIndex];

            const participants = Array.from(
              new Set(
                [
                  ...(threadInput.participants || []),
                  sandboxEmail,
                  ...(userEmail ? [userEmail] : []),
                ]
                  .map((p) => p.trim())
                  .filter(Boolean),
              ),
            );

            const threadDate = toDateOrFallback(
              threadInput.date,
              threadInput.dateOffsetMs,
              Date.now() - 5000 - fallbackTick * 1000,
            );
            fallbackTick += 1;

            const threadExternalId = `mock-thread-${crypto.randomUUID()}`;
            const threadDoc = await Thread.create({
              id: threadExternalId,
              userId: userObjectId,
              isMock: true,
              subject: threadInput.subject,
              snippet: threadInput.snippet,
              participants,
              lastMessageDate: threadDate,
              isRead: threadInput.isRead ?? false,
              isArchived: threadInput.isArchived ?? false,
              lastMessageDirection: "inbound",
              noiseFiltered: false,
            });

            createdThreads += 1;
            createdThreadDocIds.push(threadDoc._id as mongoose.Types.ObjectId);

            const createdMessageDocs: Array<{
              id: string;
              from?: string;
              to: string[];
              body?: string;
              date?: Date;
            }> = [];

            for (
              let messageIndex = 0;
              messageIndex < threadInput.messages.length;
              messageIndex += 1
            ) {
              const messageInput = threadInput.messages[messageIndex];
              const normalized = normalizeMessage(
                messageInput,
                sandboxEmail,
                userEmail,
              );

              const messageDate = toDateOrFallback(
                messageInput.date,
                messageInput.dateOffsetMs,
                Date.now() - 5000 - fallbackTick * 1000,
              );
              fallbackTick += 1;

              const messageId = `mock-message-${crypto.randomUUID()}`;
              const bodyText = normalized.body || "";

              await Message.create({
                id: messageId,
                threadId: threadDoc._id,
                userId: userObjectId,
                isMock: true,
                from: normalized.from,
                to: normalized.to,
                subject: normalized.subject || threadInput.subject,
                body: bodyText,
                snippet:
                  normalized.snippet || stripHtml(bodyText).slice(0, 120),
                date: messageDate,
                labelIds: normalized.labelIds,
              });

              createdMessages += 1;
              createdMessageDocs.push({
                id: messageId,
                from: normalized.from,
                to: normalized.to,
                body: bodyText,
                date: messageDate,
              });
            }

            if (createdMessageDocs.length > 0) {
              const sortedMessages = [...createdMessageDocs].sort(
                (a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0),
              );

              const latestMessage = sortedMessages[sortedMessages.length - 1];
              const latestFrom = latestMessage.from?.toLowerCase() || "";
              const lastMessageDirection: "inbound" | "outbound" =
                userEmail && latestFrom === userEmail ? "outbound" : "inbound";

              const inboundDates = sortedMessages
                .filter((m) => {
                  const from = m.from?.toLowerCase() || "";
                  return !userEmail || from !== userEmail;
                })
                .map((m) => m.date)
                .filter((d): d is Date => d instanceof Date)
                .sort((a, b) => a.getTime() - b.getTime());

              const lastInboundAt =
                inboundDates.length > 0
                  ? inboundDates[inboundDates.length - 1]
                  : undefined;

              await Thread.updateOne(
                { _id: threadDoc._id },
                {
                  snippet:
                    stripHtml(latestMessage.body || "").slice(0, 120) ||
                    threadInput.snippet ||
                    "",
                  lastMessageDate: latestMessage.date || threadDate,
                  lastMessageDirection,
                  ...(lastInboundAt ? { lastInboundAt } : {}),
                },
              );

              try {
                const summary = await aiService.summarizeThread(
                  threadDoc.id,
                  sortedMessages,
                );

                await Thread.updateOne({ _id: threadDoc._id }, { summary });
                emitToUser(userId, "SUMMARY_READY", { threadId: threadDoc.id });
              } catch (error: any) {
                console.warn(
                  "[sandbox.inject] summarizeThread failed:",
                  error.message,
                );
              }
            }
          }
        }
      }

      if (createdThreadDocIds.length > 0) {
        try {
          await topicService.clusterThreadsIntoTopics(
            userId,
            createdThreadDocIds,
          );
          await topicService.labelUnlabeledTopics(userId);
          await topicService.scoreAllTopicsForUser(userId);
        } catch (error: any) {
          console.warn(
            "[sandbox.inject] topic pipeline failed:",
            error.message,
          );
        }
      }
    } catch (error: any) {
      return NextResponse.json(
        { error: "Failed to inject sandbox data", details: error.message },
        { status: 500 },
      );
    }

    emitToUser(userId, "EMAIL_SYNCED", {
      count: createdMessages,
      hasMore: false,
    });

    return NextResponse.json({
      success: true,
      created: {
        contacts: createdContacts,
        threads: createdThreads,
        messages: createdMessages,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to inject sandbox scenarios", details: error.message },
      { status: 500 },
    );
  }
}
