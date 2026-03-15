import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { NewMessage, NewMessageEvent } from "telegram/events";

import { TelegramChat } from "@/models/TelegramChat";
import { TelegramMessage } from "@/models/TelegramMessage";
import { Contact } from "@/models/Contact";
import { User } from "@/models/User";
import { Topic } from "@/models/Topic";
import { connectToDatabase } from "./db";
import { emitToUser } from "./socketServer";

// Expand TelegramClient type to hold our custom flag
interface CustomTelegramClient extends TelegramClient {
  __hasMessageListener?: boolean;
}

declare global {
  var __telegramClients: Record<string, CustomTelegramClient> | undefined;
}

export const getTelegramClient = async (
  userId: string,
  sessionString: string = "",
  _phone?: string // We can log or use it later if needed
): Promise<CustomTelegramClient> => {
  if (!global.__telegramClients) {
    global.__telegramClients = {};
  }

  // Return existing connected client or try to reconnect it
  if (global.__telegramClients[userId]) {
    const existingClient = global.__telegramClients[userId];
    if (!existingClient.connected) {
      try {
        await existingClient.connect();
      } catch (error) {
        console.error(`[Telegram] Reconnect failed for user ${userId}:`, error);
        throw error;
      }
    }
    return existingClient;
  }

  const apiId = parseInt(process.env.TELEGRAM_API_ID || "0", 10);
  const apiHash = process.env.TELEGRAM_API_HASH || "";

  if (!apiId || !apiHash) {
    throw new Error(
      "Missing TELEGRAM_API_ID or TELEGRAM_API_HASH in environment variables."
    );
  }

  try {
    const session = new StringSession(sessionString);
    const client = new TelegramClient(session, apiId, apiHash, {
      connectionRetries: 5,
    });

    await client.connect();

    setupMessageListener(client as CustomTelegramClient, userId);
    
    global.__telegramClients[userId] = client as CustomTelegramClient;
    return client as CustomTelegramClient;
  } catch (error) {
    console.error(`[Telegram] Init client failed for user ${userId}:`, error);
    throw error;
  }
};

function setupMessageListener(client: CustomTelegramClient, userId: string) {
  if (client.__hasMessageListener) {
    return;
  }

  client.addEventHandler(async (event: NewMessageEvent) => {
    try {
      const message = event.message;
      if (!message || !message.peerId) return;

      const chatId = message.peerId.className === "PeerUser" 
        ? message.peerId.userId?.toString() 
        : message.peerId.className === "PeerChat" 
          ? message.peerId.chatId?.toString()
          : message.peerId.className === "PeerChannel"
            ? message.peerId.channelId?.toString()
            : null;

      if (!chatId) return;

      await connectToDatabase();

      // Get sender info
      const senderId = message.fromId || message.peerId;
      const senderIdStr = senderId.className === "PeerUser"
        ? senderId.userId?.toString()
        : senderId.className === "PeerChat"
          ? senderId.chatId?.toString()
          : senderId.className === "PeerChannel"
            ? senderId.channelId?.toString()
            : "unknown";

      const text = message.message || "";
      const date = new Date(message.date * 1000);
      const isOutbound = message.out || false;

      // Determine chat title and type from chat/sender info
      let chatTitle = "Unknown Chat";
      let chatType: "private" | "group" | "channel" = "private";
      
      try {
        const entity = await client.getEntity(message.peerId);
        if (entity) {
          if (entity.className === "User") {
            chatTitle = [entity.firstName, entity.lastName].filter(Boolean).join(" ") || entity.username || "Unknown User";
            chatType = "private";
          } else if (entity.className === "Chat") {
            chatTitle = entity.title || "Unknown Group";
            chatType = "group";
          } else if (entity.className === "Channel") {
            chatTitle = entity.title || "Unknown Channel";
            chatType = entity.megagroup ? "group" : "channel";
          }
        }
      } catch (err) {
        console.warn(`[Telegram] Could not get entity for chat ${chatId}`, err);
      }

      // 1. Check & Upsert Contact (if it's a private chat or we have sender info)
      if (senderIdStr && senderIdStr !== "unknown" && chatType === "private") {
        try {
          // Determine potential username from entity if we fetched it
          let tgUsername = "";
          try {
            const senderEntity: any = await client.getEntity(message.fromId || message.peerId);
            if (senderEntity && senderEntity.username) {
              tgUsername = senderEntity.username;
            }
          } catch (e) { /* ignore entity fetch error here */ }

          await Contact.findOneAndUpdate(
            { telegramId: senderIdStr, userId },
            {
              $setOnInsert: {
                telegramId: senderIdStr,
                userId,
                telegramName: chatTitle !== "Unknown Chat" ? chatTitle : undefined,
                telegramUsername: tgUsername || undefined,
                email: `tg-${senderIdStr}@telegram.local`, // Fallback required email field
                category: "unknown",
                categorySource: "rule",
                aiEnriched: false,
                alternateEmails: [],
              }
            },
            { upsert: true, setDefaultsOnInsert: true }
          );
        } catch (contactErr) {
          console.error(`[Telegram] Error upserting Contact for sender ${senderIdStr}:`, contactErr);
        }
      }

      // 2. Upsert Chat
      const updatedChat = await TelegramChat.findOneAndUpdate(
        { userId, chatId },
        {
          $set: {
            title: chatTitle,
            type: chatType,
            lastMessageDate: date,
          },
          $inc: {
            unreadCount: isOutbound ? 0 : 1,
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // Insert Message
      const newMessage = await TelegramMessage.findOneAndUpdate(
        { chatId, messageId: message.id.toString() },
        {
          $set: {
            userId,
            senderId: senderIdStr || "unknown",
            text,
            date,
            isOutbound,
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // Emit socket event to frontend
      emitToUser(userId, "NEW_TELEGRAM_MESSAGE", {
        chatId,
        chat: updatedChat,
        message: newMessage,
      });
      // Fire and forget chunk processing
      processChatChunks(userId).catch((e) =>
        console.error("[Telegram] processChatChunks error:", e)
      );

    } catch (err) {
      console.error("[Telegram] Error processing new message:", err);
    }
  }, new NewMessage({}));

  client.__hasMessageListener = true;
  console.log(`[Telegram] Message listener attached for user ${userId}`);
}

let isProcessingChunks = false;

export async function processChatChunks(userId: string) {
  if (isProcessingChunks) return;
  isProcessingChunks = true;

  try {
    await connectToDatabase();
    
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    // Find chats that either:
    // 1. Have unanalyzed messages and the last analyzed message is > 2h ago
    // 2. Or we could check the raw count of unanalyzed messages, but for simplicity here we just check if
    //    there's a chat with recent messages and `lastAnalyzedMessageDate` is either not set or < twoHoursAgo.
    // For a more robust approach, we query all chats for this user
    const chats = await TelegramChat.find({ userId });
    
    for (const chat of chats) {
      // Find messages for this chat that are newer than lastAnalyzedMessageDate
      const query: any = { chatId: chat.chatId, userId };
      if (chat.lastAnalyzedMessageDate) {
        query.date = { $gt: chat.lastAnalyzedMessageDate };
      }

      const newMessagesCount = await TelegramMessage.countDocuments(query);
      if (newMessagesCount === 0) continue;

      // Condition: either > 20 unanalyzed messages OR last message is older than 2 hours.
      // Easiest heuristic: if we have any new messages and it's been > 2 hrs since last analyzed or we have > 20 messages.
      const lastMsgDate = chat.lastAnalyzedMessageDate ? new Date(chat.lastAnalyzedMessageDate) : new Date(0);
      const readyToChunk = newMessagesCount >= 20 || (new Date().getTime() - lastMsgDate.getTime() > 2 * 60 * 60 * 1000);

      if (readyToChunk) {
        // Fetch them
        const messages = await TelegramMessage.find(query).sort({ date: 1 }).lean<any>();
        if (!messages.length) continue;

        // Try to find corresponding Contact (since TelegramChat doesn't store contactRef directly, we infer via senderId=tg_id)
        let contactId: any = null;
        if (chat.type === "private") {
           // chat.chatId is usually the partner's Tg ID for private chats
           const contact = await Contact.findOne({ telegramId: chat.chatId, userId });
           if (contact) {
             contactId = contact._id;
           }
        }
        
        // Find active topics for this contact
        let activeTopics: string[] = [];
        if (contactId) {
          const topics = await Topic.find({ contactId, userId }).lean<any>();
          activeTopics = topics.map((t: any) => t.name);
        }

        // Format chunk text
        const textChunk = messages.map((m: any) => `[${new Date(m.date).toLocaleTimeString()}] ${m.isOutbound ? 'You' : (m.senderId)}: ${m.text}`).join("\n");

        // Send to AI Service
        const aiServiceUrl = process.env.AI_SERVICE_URL || "http://localhost:8000";
        try {
          const res = await fetch(`${aiServiceUrl}/analyze-chat-chunk/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text_chunk: textChunk,
              active_topics: activeTopics
            })
          });
          
          if (res.ok) {
            const result = await res.json();
            const fragments = result.fragments || [];

            // Distribute insights into Topics
            for (const frag of fragments) {
               if (frag.topic_action === "route_to_existing" && contactId) {
                 await Topic.findOneAndUpdate(
                   { name: frag.topic_name, contactId, userId },
                   {
                     $push: {
                       chatInsights: {
                         intent: frag.intent,
                         summary: frag.summary,
                         sourceChatId: chat.chatId,
                         date: messages[messages.length - 1].date
                       }
                     },
                     $set: { lastInboundAt: messages[messages.length - 1].date }
                   }
                 );
               } else if (frag.topic_action === "create_new" && contactId) {
                 await Topic.create({
                   userId,
                   contactId,
                   name: frag.topic_name,
                   chatInsights: [{
                     intent: frag.intent,
                     summary: frag.summary,
                     sourceChatId: chat.chatId,
                     date: messages[messages.length - 1].date
                   }],
                   aiLabeled: true,
                   aiLabeledAt: new Date(),
                   lastInboundAt: messages[messages.length - 1].date,
                   focusScore: 50 // initial starting score
                 });
               }
            }

            // Update lastAnalyzedMessageDate on Chat
            await TelegramChat.findByIdAndUpdate(chat._id, {
              lastAnalyzedMessageDate: messages[messages.length - 1].date
            });
            console.log(`[Telegram] Processed chunk for chat ${chat.chatId} with ${messages.length} messages.`);
          } else {
             console.error(`[Telegram] AI Service error processing chunk for chat ${chat.chatId}: ${res.statusText}`);
          }
        } catch (aiErr) {
          console.error(`[Telegram] Failed to reach AI Service for chunking:`, aiErr);
        }
      }
    }
  } catch (err) {
    console.error("[Telegram] processChatChunks error:", err);
  } finally {
    isProcessingChunks = false;
  }
}
