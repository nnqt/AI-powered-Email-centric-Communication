import mongoose, { Schema, Document, Model } from "mongoose";

export type ThreadCategory =
  // Correspondence
  | "inquiry"
  | "introduction"
  | "follow_up"
  | "thank_you"
  // Business Operations
  | "proposal"
  | "contract"
  | "invoice"
  | "negotiation"
  // Project / Work
  | "project_update"
  | "task_request"
  | "meeting_request"
  | "report"
  // Support / Issue
  | "support_request"
  | "bug_report"
  | "complaint"
  | "feedback"
  // Automated / System
  | "notification"
  | "newsletter"
  | "receipt"
  | "security_alert"
  // Other
  | "personal"
  | "other";

const THREAD_CATEGORY_VALUES: ThreadCategory[] = [
  "inquiry",
  "introduction",
  "follow_up",
  "thank_you",
  "proposal",
  "contract",
  "invoice",
  "negotiation",
  "project_update",
  "task_request",
  "meeting_request",
  "report",
  "support_request",
  "bug_report",
  "complaint",
  "feedback",
  "notification",
  "newsletter",
  "receipt",
  "security_alert",
  "personal",
  "other",
];

export interface IThreadSummary {
  text: string | string[];
  key_issues: string[];
  action_required: string[];
}

export interface IThread extends Document {
  id: string; // Gmail thread ID
  userId: mongoose.Types.ObjectId;
  isMock?: boolean;
  historyId?: string;
  snippet?: string;
  lastMessageDate?: Date;
  participants?: string[]; // List of email addresses in this thread
  subject?: string; // Subject from first message
  summary?: IThreadSummary;
  isRead?: boolean;
  isArchived?: boolean;
  isUrgent?: boolean;
  urgentClassifiedAt?: Date;
  urgentDismissed?: boolean;
  // Phase 1: Thread category classification
  categories?: ThreadCategory[];
  categorizedAt?: Date;
  categorySource?: "ai" | "rule";
  lastMessageDirection?: "inbound" | "outbound";
  lastInboundAt?: Date;
  noiseFiltered?: boolean;
  // Phase 2: Topic clustering
  topicId?: mongoose.Types.ObjectId;
}

const ThreadSchema: Schema<IThread> = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    isMock: { type: Boolean, default: false },
    historyId: { type: String },
    snippet: { type: String },
    lastMessageDate: { type: Date },
    participants: { type: [String], default: [] },
    subject: { type: String },
    summary: {
      text: { type: Schema.Types.Mixed },
      key_issues: { type: [String], default: [] },
      action_required: { type: [String], default: [] },
    },
    isRead: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
    isUrgent: { type: Boolean, default: false },
    urgentClassifiedAt: { type: Date },
    urgentDismissed: { type: Boolean, default: false },
    // Phase 1: Thread category classification
    categories: {
      type: [String],
      enum: THREAD_CATEGORY_VALUES,
      default: [],
    },
    categorizedAt: { type: Date },
    categorySource: { type: String, enum: ["ai", "rule"] },
    lastMessageDirection: { type: String, enum: ["inbound", "outbound"] },
    lastInboundAt: { type: Date },
    noiseFiltered: { type: Boolean, default: false },
    // Phase 2: Topic clustering
    topicId: { type: Schema.Types.ObjectId, ref: "Topic", index: true },
  },
  { timestamps: true },
);

export const Thread: Model<IThread> =
  (mongoose.models.Thread as Model<IThread>) ||
  mongoose.model<IThread>("Thread", ThreadSchema);
