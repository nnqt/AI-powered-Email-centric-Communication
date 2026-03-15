import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUser extends Document {
  email: string;
  name?: string;
  image?: string;
  googleId: string;
  accessToken?: string;
  refreshToken?: string;
  gmailNextPageToken?: string;
  gmailSyncComplete?: boolean;
  telegramSession?: string;
  telegramPhone?: string;
}

const UserSchema: Schema<IUser> = new Schema(
  {
    email: { type: String, required: true, index: true },
    name: { type: String },
    image: { type: String },
    googleId: { type: String, required: true, unique: true },
    accessToken: { type: String },
    refreshToken: { type: String },
    gmailNextPageToken: { type: String, default: null },
    gmailSyncComplete: { type: Boolean, default: false },
    telegramSession: { type: String, default: null },
    telegramPhone: { type: String, default: null },
  },
  {
    timestamps: true,
  },
);

export const User: Model<IUser> =
  (mongoose.models.User as Model<IUser>) ||
  mongoose.model<IUser>("User", UserSchema);
