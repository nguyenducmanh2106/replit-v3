import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, baUser, baSession, baAccount, baVerification } from "@workspace/db";

const buildTrustedOrigins = (): string[] => {
  const origins: string[] = [];
  if (process.env["REPLIT_DEV_DOMAIN"]) {
    origins.push(`https://${process.env["REPLIT_DEV_DOMAIN"]}`);
  }
  if (process.env["CORS_ORIGIN"]) {
    process.env["CORS_ORIGIN"].split(",").map(o => o.trim()).filter(Boolean).forEach(o => origins.push(o));
  }
  return origins;
};

export const auth = betterAuth({
  baseURL: process.env["BETTER_AUTH_URL"] ?? `http://localhost:${process.env["PORT"] ?? 3001}`,
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
  },
  trustedOrigins: buildTrustedOrigins(),
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
});

export type Auth = typeof auth;
