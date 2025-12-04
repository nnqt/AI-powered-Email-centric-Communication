import mongoose, { Schema, Document, Model } from "mongoose";

export interface IThread extends Document {
  id: string; // Gmail thread ID
  userId: mongoose.Types.ObjectId;
  historyId?: string;
  snippet?: string;
  lastMessageDate?: Date;
}

const ThreadSchema: Schema<IThread> = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    historyId: { type: String },
    snippet: { type: String },
    lastMessageDate: { type: Date },
  },
  { timestamps: true }
);

export const Thread: Model<IThread> =
  (mongoose.models.Thread as Model<IThread>) ||
  mongoose.model<IThread>("Thread", ThreadSchema);
