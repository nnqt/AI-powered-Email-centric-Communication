import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { emitToUser } from "@/lib/socketServer";
import { AIService } from "@/modules/ai/ai.service";
import { ContactService } from "@/modules/contacts/contact.service";
import { TopicService } from "@/modules/topics/topic.service";
import { Contact } from "@/models/Contact";
import { Thread } from "@/models/Thread";
import { Message } from "@/models/Message";
import { TelegramChat } from "@/models/TelegramChat";
import { TelegramMessage } from "@/models/TelegramMessage";
import { Topic } from "@/models/Topic";
import { User } from "@/models/User";
import type {
  SandboxInjectPayload,
  SandboxScenario,
  SandboxScenarioMessage,
  SandboxScenarioTelegramMessage,
} from "@/types/sandbox";

const USER_EMAIL_PLACEHOLDER = "{{USER_EMAIL}}";
const USER_NAME_PLACEHOLDER = "{{USER_NAME}}";

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

function buildTelegramFallbackEmail(telegramId: string): string {
  const normalized = telegramId
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const safeLocalPart = normalized || "unknown";
  return `tg-${safeLocalPart}@telegram.local`;
}

function resolveScenarioEmail(
  value: string | undefined,
  userEmail: string | undefined,
  fallback: string,
): string {
  const normalized = value?.trim();

  if (!normalized) {
    return fallback;
  }

  if (normalized === USER_EMAIL_PLACEHOLDER) {
    return userEmail || fallback;
  }

  return normalized;
}

function resolveScenarioText(
  value: string | undefined,
  userEmail: string | undefined,
  userName: string | undefined,
): string | undefined {
  if (!value) {
    return value;
  }

  const fallbackName = userEmail?.split("@")[0] || "Owner";

  return value
    .replaceAll(USER_EMAIL_PLACEHOLDER, userEmail || "")
    .replaceAll(USER_NAME_PLACEHOLDER, userName || fallbackName);
}

function normalizeMessage(
  message: SandboxScenarioMessage,
  contactEmail: string,
  userName?: string,
  userEmail?: string,
): {
  from: string;
  to: string[];
  subject?: string;
  body: string;
  snippet?: string;
  labelIds: string[];
} {
  const from = resolveScenarioEmail(message.from, userEmail, contactEmail);
  const resolvedTo =
    message.to
      ?.map((value) => resolveScenarioEmail(value, userEmail, ""))
      .filter(Boolean) || [];
  const to =
    resolvedTo.length > 0
      ? Array.from(new Set(resolvedTo))
      : userEmail
        ? [userEmail]
        : [];

  return {
    from,
    to,
    subject: resolveScenarioText(message.subject, userEmail, userName),
    body: resolveScenarioText(message.body, userEmail, userName) || "",
    snippet: resolveScenarioText(message.snippet, userEmail, userName),
    labelIds: message.labelIds || [],
  };
}

function normalizeTelegramMessage(
  message: SandboxScenarioTelegramMessage,
  contactTelegramId: string,
  userName?: string,
  userEmail?: string,
): {
  senderId: string;
  text: string;
  isOutbound: boolean;
} {
  const senderId =
    resolveScenarioText(message.senderId, userEmail, userName)?.trim() ||
    contactTelegramId;
  return {
    senderId,
    text: resolveScenarioText(message.text, userEmail, userName) || "",
    isOutbound: message.isOutbound ?? senderId !== contactTelegramId,
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
          (contact) => {
            if (!contact) return true;

            const hasEmail = Boolean(contact.email?.trim());
            const hasTelegram = Boolean(
              contact.telegram?.telegramId?.trim() &&
                Array.isArray(contact.telegram.chats) &&
                contact.telegram.chats.length > 0,
            );
            const hasThreads =
              Array.isArray(contact.threads) && contact.threads.length > 0;

            if (!hasEmail && !hasTelegram) {
              return true;
            }

            if (!hasThreads && !hasTelegram) {
              return true;
            }

            if (hasThreads) {
              return (contact.threads || []).some(
                (thread) =>
                  !thread ||
                  !thread.subject ||
                  !Array.isArray(thread.messages),
              );
            }

            return false;
          },
        ),
    );

    if (hasInvalidScenario) {
      return NextResponse.json(
        {
          error:
            "Invalid scenario format. Require contact email or telegram data; thread entries must include subject/messages when provided.",
        },
        { status: 422 },
      );
    }

    await connectToDatabase();

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const user = await User.findById(userId).lean();
    const userEmail = user?.email?.toLowerCase();
    const userName = user?.name?.trim();

    const aiService = new AIService();
    const contactService = new ContactService();
    const topicService = new TopicService();

    let createdContacts = 0;
    let createdThreads = 0;
    let createdMessages = 0;
    let createdTelegramChats = 0;
    let createdTelegramMessages = 0;
    let fallbackTick = 0;

    const createdThreadDocIds: mongoose.Types.ObjectId[] = [];
    const touchedMockContactIds = new Set<string>();
    const participantEmails = new Set<string>();

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

          const resolvedTelegram = contactInput.telegram
            ? {
                telegramId: contactInput.telegram.telegramId?.trim(),
                telegramUsername: resolveScenarioText(
                  contactInput.telegram.telegramUsername,
                  userEmail,
                  userName,
                ),
                telegramName: resolveScenarioText(
                  contactInput.telegram.telegramName,
                  userEmail,
                  userName,
                ),
              }
            : undefined;

          const shouldSplitTelegramIdentity = Boolean(
            resolvedTelegram?.telegramId &&
              contactInput.email?.trim() &&
              Array.isArray(contactInput.threads) &&
              contactInput.threads.length > 0,
          );

          const fallbackEmail = resolvedTelegram?.telegramId
            ? buildTelegramFallbackEmail(resolvedTelegram.telegramId)
            : "";
          const rawEmail = resolveScenarioEmail(
            contactInput.email,
            userEmail,
            fallbackEmail,
          )
            .trim()
            .toLowerCase();

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

          const contactName = resolveScenarioText(
            contactInput.name,
            userEmail,
            userName,
          );
          const contactOrg = resolveScenarioText(
            contactInput.org,
            userEmail,
            userName,
          );
          const contactLanguage = resolveScenarioText(
            contactInput.language,
            userEmail,
            userName,
          );

          if (!contactDoc) {
            contactDoc = await Contact.create({
              userId: userObjectId,
              email: sandboxEmail,
              name: contactName,
              org: contactOrg,
              language: contactLanguage,
              alternateEmails: [],
              category: "unknown",
              categories: [],
              categorySource: "rule",
              aiEnriched: false,
              isMock: true,
              ...(resolvedTelegram?.telegramId && !shouldSplitTelegramIdentity
                ? {
                    telegramId: resolvedTelegram.telegramId,
                    telegramUsername: resolvedTelegram.telegramUsername,
                    telegramName: resolvedTelegram.telegramName,
                  }
                : {}),
            });
            createdContacts += 1;
          } else if (
            resolvedTelegram?.telegramId &&
            !shouldSplitTelegramIdentity
          ) {
            await Contact.updateOne(
              { _id: contactDoc._id },
              {
                telegramId: resolvedTelegram.telegramId,
                telegramUsername: resolvedTelegram.telegramUsername,
                telegramName: resolvedTelegram.telegramName,
              },
            );

            const refreshed = await Contact.findById(contactDoc._id);
            if (refreshed) {
              contactDoc = refreshed;
            }
          }

          touchedMockContactIds.add(contactDoc._id.toString());

          const contactThreads = Array.isArray(contactInput.threads)
            ? contactInput.threads
            : [];

          for (
            let threadIndex = 0;
            threadIndex < contactThreads.length;
            threadIndex += 1
          ) {
            const threadInput = contactThreads[threadIndex];
            const threadSubject =
              resolveScenarioText(threadInput.subject, userEmail, userName) ||
              threadInput.subject;
            const threadSnippet =
              resolveScenarioText(threadInput.snippet, userEmail, userName) ||
              threadInput.snippet;

            const participants = Array.from(
              new Set(
                [
                  ...(threadInput.participants || []),
                  sandboxEmail,
                  ...(userEmail ? [userEmail] : []),
                ]
                  .map((p) => resolveScenarioEmail(p, userEmail, "").trim())
                  .filter(Boolean),
              ),
            );
            participants.forEach((p) => participantEmails.add(p));

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
              subject: threadSubject,
              snippet: threadSnippet,
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
                userName,
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
              participantEmails.add(normalized.from);
              normalized.to.forEach((toEmail) => participantEmails.add(toEmail));

              await Message.create({
                id: messageId,
                threadId: threadDoc._id,
                userId: userObjectId,
                isMock: true,
                from: normalized.from,
                to: normalized.to,
                subject: normalized.subject || threadSubject,
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

              const orderedParticipants: string[] = [];
              const addParticipant = (value?: string) => {
                const normalized = value?.trim();
                if (!normalized || orderedParticipants.includes(normalized)) {
                  return;
                }
                orderedParticipants.push(normalized);
              };

              sortedMessages.forEach((message) => {
                addParticipant(message.from);
                message.to.forEach((toValue) => addParticipant(toValue));
              });

              if (orderedParticipants.length === 0) {
                participants.forEach((participant) => addParticipant(participant));
              }

              await Thread.updateOne(
                { _id: threadDoc._id },
                {
                  snippet:
                    stripHtml(latestMessage.body || "").slice(0, 120) ||
                    threadSnippet ||
                    "",
                  participants: orderedParticipants,
                  lastMessageDate: latestMessage.date || threadDate,
                  lastMessageDirection,
                  ...(lastInboundAt ? { lastInboundAt } : {}),
                },
              );

              try {
                const analyzed = await aiService.analyzeThread({
                  thread_id: threadDoc.id,
                  subject: threadSubject,
                  snippet: threadSnippet,
                  sender_email: contactDoc.email,
                  sender_categories: contactDoc.categories,
                  messages: sortedMessages.map((m) => ({
                    id: m.id,
                    from: m.from || "",
                    to: m.to,
                    sent_at:
                      m.date?.toISOString?.() || new Date().toISOString(),
                    text: m.body || "",
                  })),
                });

                await Thread.updateOne(
                  { _id: threadDoc._id },
                  {
                    categories: analyzed.categories,
                    noiseFiltered: analyzed.noiseFiltered,
                    categorizedAt: new Date(),
                    categorySource: "ai",
                    ...(analyzed.topicKey
                      ? {
                          topicKey: analyzed.topicKey,
                          topicKeySource: "ai",
                        }
                      : {}),
                    ...(typeof analyzed.topicKeyConfidence === "number"
                      ? { topicKeyConfidence: analyzed.topicKeyConfidence }
                      : {}),
                    ...(analyzed.summary ? { summary: analyzed.summary } : {}),
                  },
                );

                if (analyzed.summary) {
                  emitToUser(userId, "SUMMARY_READY", { threadId: threadDoc.id });
                }
              } catch (error: any) {
                console.warn(
                  "[sandbox.inject] analyzeThread failed:",
                  error.message,
                );
              }
            }
          }

          if (
            contactInput.telegram?.telegramId &&
            Array.isArray(contactInput.telegram.chats) &&
            contactInput.telegram.chats.length > 0
          ) {
            const contactTelegramId = contactInput.telegram.telegramId.trim();

            for (const chatInput of contactInput.telegram.chats) {
              const chatId = chatInput.chatId?.trim() || contactTelegramId;
              const chatDate = toDateOrFallback(
                chatInput.date,
                chatInput.dateOffsetMs,
                Date.now() - 5000 - fallbackTick * 1000,
              );
              fallbackTick += 1;

              await TelegramChat.findOneAndUpdate(
                {
                  userId: userObjectId,
                  chatId,
                },
                {
                  userId: userObjectId,
                  isMock: true,
                  chatId,
                  title:
                    resolveScenarioText(chatInput.title, userEmail, userName) ||
                    `Chat ${chatId}`,
                  type: chatInput.type || "private",
                  unreadCount: chatInput.unreadCount ?? 0,
                  lastMessageDate: chatDate,
                },
                { upsert: true, new: true },
              );
              createdTelegramChats += 1;

              const createdChatMessages: Date[] = [];
              for (const telegramMessageInput of chatInput.messages || []) {
                const telegramDate = toDateOrFallback(
                  telegramMessageInput.date,
                  telegramMessageInput.dateOffsetMs,
                  Date.now() - 5000 - fallbackTick * 1000,
                );
                fallbackTick += 1;

                const normalizedTelegramMessage = normalizeTelegramMessage(
                  telegramMessageInput,
                  contactTelegramId,
                  userName,
                  userEmail,
                );

                const senderId = normalizedTelegramMessage.senderId.trim();
                const chatType = chatInput.type || "private";
                // Keep sandbox behavior aligned with production Telegram ingestion:
                // inbound private messages should materialize/update a sender contact.
                if (
                  chatType === "private" &&
                  senderId &&
                  !normalizedTelegramMessage.isOutbound
                ) {
                  const existingSenderContact = await Contact.findOne({
                    userId: userObjectId,
                    telegramId: senderId,
                  })
                    .select("_id")
                    .lean();

                  const senderName =
                    senderId === contactTelegramId
                      ? resolvedTelegram?.telegramName || contactName
                      : resolveScenarioText(chatInput.title, userEmail, userName);

                  await Contact.findOneAndUpdate(
                    {
                      userId: userObjectId,
                      telegramId: senderId,
                    },
                    {
                      $setOnInsert: {
                        userId: userObjectId,
                        isMock: true,
                        email: buildTelegramFallbackEmail(senderId),
                        alternateEmails: [],
                        category: "unknown",
                        categories: [],
                        categorySource: "rule",
                        aiEnriched: false,
                      },
                      $set: {
                        telegramId: senderId,
                        ...(senderName ? { name: senderName } : {}),
                      },
                    },
                    { upsert: true, new: true },
                  );

                  if (!existingSenderContact) {
                    createdContacts += 1;
                  }
                }

                await TelegramMessage.findOneAndUpdate(
                  {
                    userId: userObjectId,
                    chatId,
                    messageId: `mock-telegram-${crypto.randomUUID()}`,
                  },
                  {
                    userId: userObjectId,
                    isMock: true,
                    chatId,
                    senderId: normalizedTelegramMessage.senderId,
                    text: normalizedTelegramMessage.text,
                    date: telegramDate,
                    isOutbound: normalizedTelegramMessage.isOutbound,
                  },
                  { upsert: true, new: true },
                );
                createdTelegramMessages += 1;
                createdChatMessages.push(telegramDate);
              }

              if (createdChatMessages.length > 0) {
                const latestDate = createdChatMessages.sort(
                  (a, b) => a.getTime() - b.getTime(),
                )[createdChatMessages.length - 1];

                await TelegramChat.updateOne(
                  {
                    userId: userObjectId,
                    chatId,
                  },
                  {
                    lastMessageDate: latestDate,
                  },
                );
              }
            }
          }
        }
      }

      if (participantEmails.size > 0) {
        try {
          await contactService.upsertParticipants(
            userId,
            Array.from(participantEmails),
          );
        } catch (error: any) {
          console.warn(
            "[sandbox.inject] upsertParticipants failed:",
            error.message,
          );
        }
      }

      if (createdThreadDocIds.length > 0) {
        try {
          const touchedContactIdsFromCluster = await topicService.clusterThreadsIntoTopics(
            userId,
            createdThreadDocIds,
          );

          const topicPipelineContactIds = Array.from(
            new Set([
              ...Array.from(touchedMockContactIds),
              ...touchedContactIdsFromCluster,
            ]),
          );

          await topicService.mergeLikelyTopicsForUser(
            userId,
            topicPipelineContactIds,
          );
          await topicService.aiConsolidateTopicsForContacts(
            userId,
            topicPipelineContactIds,
          );
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

    const topicRows =
      touchedMockContactIds.size > 0
        ? await Topic.aggregate([
            {
              $match: {
                userId: userObjectId,
                contactId: {
                  $in: Array.from(touchedMockContactIds).map(
                    (id) => new mongoose.Types.ObjectId(id),
                  ),
                },
              },
            },
            {
              $group: {
                _id: "$contactId",
                topicCount: { $sum: 1 },
              },
            },
          ])
        : [];

    const topicsByContact = Object.fromEntries(
      topicRows.map((row: any) => [row._id.toString(), row.topicCount]),
    );

    return NextResponse.json({
      success: true,
      created: {
        contacts: createdContacts,
        threads: createdThreads,
        messages: createdMessages,
        telegramChats: createdTelegramChats,
        telegramMessages: createdTelegramMessages,
      },
      diagnostics: {
        topicsByContact,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to inject sandbox scenarios", details: error.message },
      { status: 500 },
    );
  }
}
