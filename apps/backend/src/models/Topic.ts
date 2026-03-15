import mongoose, { Schema, Document, Model } from "mongoose";

export interface ITopic extends Document {
  userId: mongoose.Types.ObjectId;
  contactId: mongoose.Types.ObjectId; // primary contact this topic belongs to
  name: string; // AI-generated (Phase 3) or normalized subject (Phase 2 temp)
  nameEditedByUser: boolean; // if true → never overwrite with AI name
  threadIds: mongoose.Types.ObjectId[]; // _id refs to Thread documents
  threadCount: number; // denormalized
  noiseCount: number; // threads with noiseFiltered=true in this topic

  // Scoring (Phase 4)
  focusScore: number;
  lastScoredAt?: Date;

  // Denormalized timestamps for scoring (updated on every new message)
  lastInboundAt?: Date; // latest message FROM contact → user
  lastOutboundAt?: Date; // latest message FROM user → contact
  unansweredCount: number; // threads where lastMessageDirection = "inbound"

  // AI labeling (Phase 3)
  aiLabeled: boolean;
  aiLabeledAt?: Date;
}

const TopicSchema: Schema<ITopic> = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    contactId: {
      type: Schema.Types.ObjectId,
      ref: "Contact",
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    nameEditedByUser: { type: Boolean, default: false },
    threadIds: { type: [Schema.Types.ObjectId], ref: "Thread", default: [] },
    threadCount: { type: Number, default: 0 },
    noiseCount: { type: Number, default: 0 },

    // Scoring
    focusScore: { type: Number, default: 0 },
    lastScoredAt: { type: Date },

    // Denormalized for fast scoring
    lastInboundAt: { type: Date },
    lastOutboundAt: { type: Date },
    unansweredCount: { type: Number, default: 0 },

    // AI labeling
    aiLabeled: { type: Boolean, default: false },
    aiLabeledAt: { type: Date },
  },
  { timestamps: true },
);

// One user has many topics; look up by user + contact quickly
TopicSchema.index({ userId: 1, contactId: 1 });

export const Topic: Model<ITopic> =
  (mongoose.models.Topic as Model<ITopic>) ||
  mongoose.model<ITopic>("Topic", TopicSchema);
