import mongoose, { Schema, Document, Model } from "mongoose";

export interface ITelegramChat extends Document {
  chatId: string;
  userId: mongoose.Types.ObjectId;
  isMock?: boolean;
  title: string;
  type: "private" | "group" | "channel";
  lastMessageDate: Date;
  unreadCount: number;
  lastAnalyzedMessageDate?: Date; // Phase 4 marker
}

const TelegramChatSchema: Schema<ITelegramChat> = new Schema(
  {
    chatId: { type: String, required: true },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isMock: { type: Boolean, default: false },
    title: { type: String, required: true },
    type: {
      type: String,
      enum: ["private", "group", "channel"],
      required: true,
    },
    lastMessageDate: { type: Date, default: Date.now },
    unreadCount: { type: Number, default: 0 },
    lastAnalyzedMessageDate: { type: Date },
  },
  { timestamps: true },
);

// Compound index for querying user's chats ordered by last message
TelegramChatSchema.index({ userId: 1, lastMessageDate: -1 });
// Ensure uniqueness of chatId per user
TelegramChatSchema.index({ userId: 1, chatId: 1 }, { unique: true });

export const TelegramChat: Model<ITelegramChat> =
  (mongoose.models.TelegramChat as Model<ITelegramChat>) ||
  mongoose.model<ITelegramChat>("TelegramChat", TelegramChatSchema);
