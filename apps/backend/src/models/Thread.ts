import mongoose, { Schema, Document, Model } from "mongoose";

export interface IThreadSummary {
  text: string;
  key_issues: string[];
  action_required: string[];
}

export interface IThread extends Document {
  id: string; // Gmail thread ID
  userId: mongoose.Types.ObjectId;
  historyId?: string;
  snippet?: string;
  lastMessageDate?: Date;
  participants?: string[]; // List of email addresses in this thread
  subject?: string; // Subject from first message
  summary?: IThreadSummary;
}

const ThreadSchema: Schema<IThread> = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    historyId: { type: String },
    snippet: { type: String },
    lastMessageDate: { type: Date },
    participants: { type: [String], default: [] },
    subject: { type: String },
    summary: {
      text: { type: String },
      key_issues: { type: [String], default: [] },
      action_required: { type: [String], default: [] },
    },
  },
  { timestamps: true }
);

export const Thread: Model<IThread> =
  (mongoose.models.Thread as Model<IThread>) ||
  mongoose.model<IThread>("Thread", ThreadSchema);
