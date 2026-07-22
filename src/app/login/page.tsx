"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";

function LoginForm() {
  const searchParams = useSearchParams();
  const rawCallback = searchParams.get("callbackUrl") || "/";

  const callbackUrl = (() => {
    try {
      const u = new URL(rawCallback, window.location.origin);
      if (u.origin !== window.location.origin) return "/";
      return u.pathname + u.search;
    } catch {
      return "/";
    }
  })();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Please enter Username ID and Password");
      return;
    }
    setIsPending(true);
    try {
      console.log("[Login] Attempting sign in for:", email);
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      console.log("[Login] NextAuth response:", res);
      if (res?.error) {
        toast.error(`Login failed: ${res.error}`);
      } else {
        toast.success("Login successful!");
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err: unknown) {
      console.error("[Login] Client-side error:", err);
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Something went wrong: ${message}`);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={handleSignIn} className="w-full space-y-6">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      
      {/* Input Group Block */}
      <div 
        style={{
          border: "1px solid var(--color-border-strong)",
          borderRadius: 16,
          overflow: "hidden",
          background: "transparent",
          display: "flex",
          flexDirection: "column",
          boxShadow: "var(--shadow-sm)",
          transition: "all 0.15s ease",
        }}
        className="focus-within-ring"
      >
        <div style={{ borderBottom: "1px solid var(--color-border)" }}>
          <input
            id="email"
            name="email"
            type="text"
            autoComplete="username"
            required
            style={{
              width: "100%",
              padding: "14px 16px",
              background: "transparent",
              border: 0,
              outline: "none",
              fontSize: "0.875rem",
              color: "var(--color-text-primary)",
            }}
            placeholder="Username ID"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            style={{
              width: "100%",
              padding: "14px 16px",
              background: "transparent",
              border: 0,
              outline: "none",
              fontSize: "0.875rem",
              color: "var(--color-text-primary)",
            }}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      </div>

      {/* Button wrapper */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <button
          type="submit"
          disabled={isPending}
          style={{
            width: "100%",
            background: "#0071e3",
            color: "white",
            fontWeight: 600,
            borderRadius: 99,
            padding: "13px 16px",
            fontSize: "0.875rem",
            border: "none",
            cursor: isPending ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            boxShadow: "0 2px 4px rgba(0,113,227,0.15)",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={e => { if (!isPending) e.currentTarget.style.background = "#0077ed"; }}
          onMouseLeave={e => { if (!isPending) e.currentTarget.style.background = "#0071e3"; }}
          onMouseDown={e => { if (!isPending) e.currentTarget.style.transform = "scale(0.98)"; }}
          onMouseUp={e => { if (!isPending) e.currentTarget.style.transform = "scale(1)"; }}
        >
          {isPending ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Signing In…
            </>
          ) : (
            "Sign In"
          )}
        </button>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div 
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-surface)",
        padding: "0 16px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div 
        style={{
          width: "100%",
          maxWidth: 360,
          padding: "48px 0",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* Rounded Lock Icon */}
        <div 
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "rgba(0, 0, 0, 0.02)",
            border: "1px solid rgba(0, 0, 0, 0.05)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 24,
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <Lock size={24} style={{ color: "var(--color-text-primary)", opacity: 0.8 }} strokeWidth={1.5} />
        </div>

        {/* Title */}
        <h1 
          style={{
            fontSize: "1.5rem",
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: "var(--color-text-primary)",
            marginBottom: 8,
            textAlign: "center",
          }}
        >
          Sign in with Administrator ID
        </h1>

        {/* Subtitle */}
        <p 
          style={{
            fontSize: "0.775rem",
            color: "var(--color-text-tertiary)",
            textAlign: "center",
            marginBottom: 32,
            maxWidth: 280,
            lineHeight: 1.45,
          }}
        >
          Manage delegate database, travel allocations, and live calling panels.
        </p>

        {/* Form Container */}
        <div style={{ width: "100%" }}>
          <Suspense fallback={
            <div style={{ textAlign: "center", padding: 20 }}>
              <Loader2 size={24} className="animate-spin" style={{ margin: "0 auto", color: "#0071e3" }} />
            </div>
          }>
            <LoginForm />
          </Suspense>
        </div>

        {/* Footer Link */}
        <div 
          style={{
            marginTop: 32,
            borderTop: "1px solid rgba(0, 0, 0, 0.05)",
            paddingTop: 24,
            width: "100%",
            textAlign: "center",
          }}
        >
          <a 
            href="/" 
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "#0071e3",
              textDecoration: "none",
            }}
            onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
            onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
          >
            Go to public dashboard
          </a>
        </div>
      </div>

      <style>{`
        .focus-within-ring:focus-within {
          border-color: #0071e3 !important;
          box-shadow: 0 0 0 1px #0071e3 !important;
        }
      `}</style>
    </div>
  );
}
