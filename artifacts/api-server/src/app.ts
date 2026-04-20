import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use((req, res, next) => {
  if (req.url.startsWith("/api/auth")) {
    return toNodeHandler(auth)(req as any, res as any);
  }
  return next();
});

const buildAllowedOrigins = (): Set<string> => {
  const origins = new Set<string>();
  const replDevDomain = process.env["REPLIT_DEV_DOMAIN"];
  if (replDevDomain) {
    origins.add(`https://${replDevDomain}`);
  }
  const expoDevDomain = process.env["REPLIT_EXPO_DEV_DOMAIN"];
  if (expoDevDomain) {
    origins.add(`https://${expoDevDomain}`);
  }
  const corsOrigin = process.env["CORS_ORIGIN"];
  if (corsOrigin) {
    corsOrigin.split(",").map(o => o.trim()).filter(Boolean).forEach(o => origins.add(o));
  }
  return origins;
};
const allowedOrigins = buildAllowedOrigins();

app.use(cors({
  credentials: true,
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (allowedOrigins.has(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
}));
app.use(express.json());
app.use(express.text({ type: "text/plain" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
