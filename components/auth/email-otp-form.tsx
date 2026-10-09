"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";

export function EmailOtpForm({ callbackURL }: { callbackURL?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrorMessage(null);

    const result = await authClient.emailOtp.sendVerificationOtp({
      email: email.trim(),
      type: "sign-in",
    });

    setPending(false);
    if (result.error) {
      setErrorMessage(result.error.message || "Unable to send a code.");
      return;
    }
    setStep("code");
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrorMessage(null);

    const result = await authClient.signIn.emailOtp({
      email: email.trim(),
      otp: otp.trim(),
    });

    if (result.error) {
      setErrorMessage(result.error.message || "Unable to sign in.");
      setPending(false);
      return;
    }
    router.push(callbackURL ?? "/");
    router.refresh();
  }

  return (
    <section aria-label="Sign in with email code" className="flex flex-col gap-3">
      <p className="text-sm font-medium">Sign in with email code</p>
      {step === "email" ? (
        <form className="flex flex-col gap-3" onSubmit={sendCode}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email-otp-email">Email</Label>
            <Input
              id="email-otp-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              disabled={pending}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? "Sending…" : "Send code"}
          </Button>
        </form>
      ) : (
        <form className="flex flex-col gap-3" onSubmit={verifyCode}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email-otp-code">Code</Label>
            <Input
              id="email-otp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={otp}
              disabled={pending}
              onChange={(event) => setOtp(event.target.value)}
            />
          </div>
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? "Verifying…" : "Verify"}
          </Button>
        </form>
      )}
      {errorMessage ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}
