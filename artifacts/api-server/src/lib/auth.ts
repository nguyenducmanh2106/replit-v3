import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, baUser, baSession, baAccount, baVerification } from "@workspace/db";
import { sendVerificationEmail, sendPasswordResetEmail } from "./mailer";

const API_BASE_URL = process.env["BETTER_AUTH_URL"]
  ?? (process.env["REPLIT_DOMAINS"]
    ? `https://${process.env["REPLIT_DOMAINS"].split(",")[0].trim()}`
    : `http://localhost:${process.env["PORT"] ?? 3001}`);

const buildTrustedOrigins = (): string[] => {
  const origins: string[] = [
    "http://localhost:3000",
    "http://localhost:5000",
  ];

  const replitDomains = process.env["REPLIT_DOMAINS"] ?? process.env["REPLIT_DEV_DOMAIN"];
  if (replitDomains) {
    replitDomains.split(",").map(d => d.trim()).filter(Boolean).forEach(domain => {
      origins.push(`https://${domain}`);
      origins.push(`https://${domain}:80`);
      origins.push(`https://${domain}:443`);
      origins.push(`https://${domain}:5000`);
      origins.push(`https://${domain}:3000`);
    });
  }

  if (process.env["CORS_ORIGIN"]) {
    process.env["CORS_ORIGIN"].split(",").map(o => o.trim()).filter(Boolean).forEach(o => origins.push(o));
  }

  return origins;
};

export const auth = betterAuth({
  baseURL: API_BASE_URL,
  basePath: "/api/auth",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: baUser,
      session: baSession,
      account: baAccount,
      verification: baVerification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail({
        to: user.email,
        resetUrl: url,
        name: user.name,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail({
        to: user.email,
        verificationUrl: url,
        name: user.name,
      });
    },
  },
  socialProviders: {
    google: {
      clientId: process.env["GOOGLE_CLIENT_ID"] ?? "",
      clientSecret: process.env["GOOGLE_CLIENT_SECRET"] ?? "",
      redirectURI: `${API_BASE_URL}/api/auth/callback/google`,
    },
  },
  trustedOrigins: buildTrustedOrigins(),
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: null,
        input: false,
      },
    },
  },
});

export type Auth = typeof auth;
