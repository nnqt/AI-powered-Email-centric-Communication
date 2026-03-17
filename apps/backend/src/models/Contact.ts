import mongoose, { Schema, Document, Model } from "mongoose";

export type ContactCategory =
  | "colleague"
  | "customer"
  | "spam"
  | "other"
  | "unknown";

export type CategorySource = "rule" | "ai" | "user";

export interface IContact extends Document {
  email: string;
  name?: string;
  org?: string;
  language?: string;
  alternateEmails: string[];
  userId: mongoose.Types.ObjectId;
  isMock?: boolean;
  aiEnriched: boolean;
  enrichedAt?: Date;
  mergedInto?: mongoose.Types.ObjectId;
  category: ContactCategory;
  categories: ContactCategory[];
  categorySource: CategorySource;
  categoryAiSuggestion?: ContactCategory;
  telegramId?: string;
  telegramUsername?: string;
  telegramName?: string;
}

const ContactSchema: Schema<IContact> = new Schema(
  {
    email: { type: String, required: true, index: true },
    name: { type: String },
    org: { type: String },
    language: { type: String },
    alternateEmails: { type: [String], default: [] },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    isMock: { type: Boolean, default: false },
    aiEnriched: { type: Boolean, default: false },
    enrichedAt: { type: Date },
    mergedInto: { type: Schema.Types.ObjectId, ref: "Contact" },
    category: {
      type: String,
      enum: ["colleague", "customer", "spam", "other", "unknown"],
      default: "unknown",
    },
    categories: {
      type: [String],
      enum: ["colleague", "customer", "spam", "other", "unknown"],
      default: [],
    },
    categorySource: {
      type: String,
      enum: ["rule", "ai", "user"],
      default: "rule",
    },
    categoryAiSuggestion: {
      type: String,
      enum: ["colleague", "customer", "spam", "other", "unknown"],
    },
    telegramId: { type: String, sparse: true },
    telegramUsername: { type: String },
    telegramName: { type: String },
  },
  { timestamps: true },
);

// Unique contact per (email, userId)
ContactSchema.index({ email: 1, userId: 1 }, { unique: true });

// Unique contact per (telegramId, userId) if telegramId exists
ContactSchema.index(
  { telegramId: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: { telegramId: { $type: "string" } },
  },
);

export const Contact: Model<IContact> =
  (mongoose.models.Contact as Model<IContact>) ||
  mongoose.model<IContact>("Contact", ContactSchema);
