import type { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import GoogleProvider from "next-auth/providers/google";

import { connectToDatabase } from "./db";
import { User } from "@/models/User";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          scope:
            "openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.compose",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!account || !user || !user.email) {
        return false;
      }

      await connectToDatabase();

      const googleId = account.providerAccountId;
      const accessToken = account.access_token as string | undefined;
      const refreshToken = (account.refresh_token || account.refresh_token) as
        | string
        | undefined;

      await User.findOneAndUpdate(
        { googleId },
        {
          email: user.email,
          name: user.name,
          image: user.image,
          googleId,
          accessToken,
          refreshToken,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      return true;
    },
    async jwt({ token }): Promise<JWT> {
      await connectToDatabase();

      if (!token.email) {
        return token;
      }

      const existingUser = await User.findOne({ email: token.email }).lean();
      if (existingUser && existingUser._id) {
        token.id = existingUser._id.toString();
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
};
