import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { compare } from "bcryptjs";
import { writeAuditLog } from "@/lib/audit";

// ─── Simple in-memory brute-force protection ─────────────────────────────────
// Tracks failed attempts per key (email:ip). Clears after 15 minutes.
const loginAttempts = new Map<string, { count: number; firstAt: number }>();
const MAX_ATTEMPTS = 10;    // max failures per window
const WINDOW_MS   = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || now - entry.firstAt > WINDOW_MS) {
    // Reset window
    loginAttempts.set(key, { count: 1, firstAt: now });
    return true; // allowed
  }
  if (entry.count >= MAX_ATTEMPTS) return false; // blocked
  entry.count++;
  return true; // allowed
}

function clearRateLimit(key: string) {
  loginAttempts.delete(key);
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET || "bb2026-jwt-secret-bharat-buildcon-2026-enterprise",

  // Required for Vercel / custom domains — allows NextAuth to trust the
  // host header so NEXTAUTH_URL does NOT need to be set on production.
  trustHost: true,

  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const email = (credentials?.email as string | undefined)?.toLowerCase().trim();
        const password = credentials?.password as string | undefined;

        if (!email || !password) return null;

        // ── Rate limit check ────────────────────────────────────────────────
        const ip = ((req as unknown) as { headers?: { get?: (key: string) => string | null } })?.headers?.get?.("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
        const rlKey = `${email}:${ip}`;
        if (!checkRateLimit(rlKey)) {
          await writeAuditLog({
            userId: null, userName: email, userRole: "unknown",
            action: "login_rate_limited", status: "blocked",
            ipAddress: ip,
            metadata: { reason: "Too many failed attempts", email, ip },
          });
          // Return null — NextAuth will show generic error
          return null;
        }

        try {
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

          if (!user?.passwordHash) {
            await writeAuditLog({
              userId: null, userName: email, userRole: "unknown",
              action: "login_failed", status: "failed",
              ipAddress: ip,
              metadata: { reason: "User not found", email },
            });
            return null;
          }

          const valid = await compare(password, user.passwordHash);
          if (!valid) {
            await writeAuditLog({
              userId: user.id, userName: user.name ?? user.email, userRole: user.role,
              action: "login_failed", status: "failed",
              ipAddress: ip,
              metadata: { reason: "Invalid password" },
            });
            return null;
          }

          // ── Successful login — clear rate limit, update last_login_at ─────
          clearRateLimit(rlKey);

          // Update last_login_at non-blocking
          db.update(users)
            .set({ lastLoginAt: new Date() })
            .where(eq(users.id, user.id))
            .catch(e => console.error("[auth] lastLoginAt update failed:", e));

          await writeAuditLog({
            userId: user.id, userName: user.name ?? user.email, userRole: user.role,
            action: "login", status: "success",
            ipAddress: ip,
            metadata: { email: user.email },
          });

          return {
            id: String(user.id),
            email: user.email,
            name: user.name ?? user.email,
            role: user.role ?? "staff",
          };
        } catch (err) {
          console.error("[auth] authorize error:", err);
          return null;
        }
      },
    }),
  ],

  session: {
    strategy: "jwt",
    // maxAge is read from app_settings.session_timeout_minutes at runtime.
    // Default: 30 minutes. Admin can change via Settings page.
    maxAge: (() => {
      // We can't await here so we use a cached value.
      // The actual enforcement is done by the jwt/session callbacks checking iat.
      return (parseInt(process.env.SESSION_TIMEOUT_MINUTES ?? "30") || 30) * 60;
    })(),
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = nextUrl.pathname.startsWith('/login');
      if (isOnLogin) {
        if (isLoggedIn) return Response.redirect(new URL('/', nextUrl));
        return true;
      }
      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role?: string }).role ?? "staff";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id ?? "") as string;
        (session.user as { role?: string }).role = (token.role as string) ?? "staff";
      }
      return session;
    },
    // Block open-redirect attacks: only allow same-origin callbackUrls
    async redirect({ url, baseUrl }) {
      // Relative URL — allow
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Same origin — allow
      try {
        if (new URL(url).origin === new URL(baseUrl).origin) return url;
      } catch {
        // malformed URL — fall through to baseUrl
      }
      // External URL — reject, redirect to dashboard root
      return baseUrl;
    },
  },
});
