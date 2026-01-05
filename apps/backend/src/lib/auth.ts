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
    async jwt({ token, account }): Promise<JWT> {
      await connectToDatabase();

      // Initial sign in - save tokens
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
      }

      if (!token.email) {
        return token;
      }

      const existingUser = await User.findOne({ email: token.email }).lean();
      if (existingUser && existingUser._id) {
        token.id = existingUser._id.toString();
      }

      // Check if token is expired or about to expire (5 min buffer)
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = (token.expiresAt as number) || 0;

      if (expiresAt && now >= expiresAt - 300) {
        // Token expired or expiring soon - try to refresh
        try {
          const refreshToken = existingUser?.refreshToken || token.refreshToken;

          if (refreshToken) {
            const response = await fetch(
              "https://oauth2.googleapis.com/token",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                  client_id: process.env.GOOGLE_CLIENT_ID || "",
                  client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
                  grant_type: "refresh_token",
                  refresh_token: refreshToken as string,
                }),
              }
            );

            if (response.ok) {
              const refreshedTokens = await response.json();

              token.accessToken = refreshedTokens.access_token;
              token.expiresAt =
                Math.floor(Date.now() / 1000) + refreshedTokens.expires_in;

              // Update user in database
              if (existingUser) {
                await User.findByIdAndUpdate(existingUser._id, {
                  accessToken: refreshedTokens.access_token,
                });
              }
            } else {
              // Refresh failed - token is invalid
              console.error("Token refresh failed");
              return { ...token, error: "RefreshTokenError" };
            }
          }
        } catch (error) {
          console.error("Error refreshing token:", error);
          return { ...token, error: "RefreshTokenError" };
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }

      // Pass error to client
      if (token.error) {
        session.error = token.error as string;
      }

      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
};
