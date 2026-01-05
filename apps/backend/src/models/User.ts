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
}

const UserSchema: Schema<IUser> = new Schema(
  {
    email: { type: String, required: true, index: true },
    name: { type: String },
    image: { type: String },
    googleId: { type: String, required: true, unique: true },
    accessToken: { type: String },
    refreshToken: { type: String },
  },
  {
    timestamps: true,
  }
);

export const User: Model<IUser> =
  (mongoose.models.User as Model<IUser>) ||
  mongoose.model<IUser>("User", UserSchema);
