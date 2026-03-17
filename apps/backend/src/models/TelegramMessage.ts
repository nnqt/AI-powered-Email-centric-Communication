import mongoose, { Schema, Document, Model } from "mongoose";

export interface ITelegramMessage extends Document {
  messageId: string; // Store as string to handle large Telegram message IDs safely
  chatId: string; // Refers to TelegramChat.chatId
  userId: mongoose.Types.ObjectId; // Refers to system User
  isMock?: boolean;
  senderId: string; // Telegram sender ID
  text: string;
  date: Date;
  isOutbound: boolean;
}

const TelegramMessageSchema: Schema<ITelegramMessage> = new Schema(
  {
    messageId: { type: String, required: true },
    chatId: { type: String, required: true, index: true },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    isMock: { type: Boolean, default: false },
    senderId: { type: String, required: true },
    text: { type: String, default: "" },
    date: { type: Date, required: true },
    isOutbound: { type: Boolean, required: true },
  },
  { timestamps: true },
);

// Index for getting chat history ordered by date
TelegramMessageSchema.index({ chatId: 1, date: -1 });

// Ensure uniqueness of messages per chat
TelegramMessageSchema.index({ chatId: 1, messageId: 1 }, { unique: true });

export const TelegramMessage: Model<ITelegramMessage> =
  (mongoose.models.TelegramMessage as Model<ITelegramMessage>) ||
  mongoose.model<ITelegramMessage>("TelegramMessage", TelegramMessageSchema);
