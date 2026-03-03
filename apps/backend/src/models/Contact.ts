import mongoose, { Schema, Document, Model } from "mongoose";

export interface IContact extends Document {
  email: string;
  name?: string;
  org?: string;
  language?: string;
  alternateEmails: string[];
  userId: mongoose.Types.ObjectId;
  aiEnriched: boolean;
  mergedInto?: mongoose.Types.ObjectId;
}

const ContactSchema: Schema<IContact> = new Schema(
  {
    email: { type: String, required: true, index: true },
    name: { type: String },
    org: { type: String },
    language: { type: String },
    alternateEmails: { type: [String], default: [] },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    aiEnriched: { type: Boolean, default: false },
    mergedInto: { type: Schema.Types.ObjectId, ref: "Contact" },
  },
  { timestamps: true },
);

// Unique contact per (email, userId)
ContactSchema.index({ email: 1, userId: 1 }, { unique: true });

export const Contact: Model<IContact> =
  (mongoose.models.Contact as Model<IContact>) ||
  mongoose.model<IContact>("Contact", ContactSchema);
