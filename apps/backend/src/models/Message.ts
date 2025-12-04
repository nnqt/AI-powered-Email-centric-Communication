import mongoose, { Schema, Document, Model } from "mongoose";

export interface IMessage extends Document {
  id: string; // Gmail message ID
  threadId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  from?: string;
  to: string[];
  subject?: string;
  body?: string;
  snippet?: string;
  date?: Date;
  labelIds: string[];
}

const MessageSchema: Schema<IMessage> = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    threadId: { type: Schema.Types.ObjectId, ref: "Thread", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    from: { type: String },
    to: { type: [String], default: [] },
    subject: { type: String },
    body: { type: String },
    snippet: { type: String },
    date: { type: Date },
    labelIds: { type: [String], default: [] },
  },
  { timestamps: true }
);

export const Message: Model<IMessage> =
  (mongoose.models.Message as Model<IMessage>) ||
  mongoose.model<IMessage>("Message", MessageSchema);
