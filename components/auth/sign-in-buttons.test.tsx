import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const hoisted = vi.hoisted(() => ({
  sendVerificationOtp: vi.fn(),
  signInEmailOtp: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: hoisted.push, refresh: vi.fn() }),
}));

vi.mock("@/lib/auth/client", () => ({
  authClient: {
    signIn: { social: vi.fn(), emailOtp: hoisted.signInEmailOtp },
    emailOtp: { sendVerificationOtp: hoisted.sendVerificationOtp },
  },
}));

import { EmailOtpForm } from "@/components/auth/email-otp-form";
import { SignInButtons } from "@/components/auth/sign-in-buttons";

describe("SignInButtons email OTP", () => {
  it("hides the email-code form when OTP is disabled", () => {
    render(<SignInButtons providers={["github"]} />);
    expect(screen.queryByText("Sign in with email code")).toBeNull();
    expect(screen.queryByLabelText("Email")).toBeNull();
  });

  it("shows the form when enabled, even with no social providers", () => {
    render(<SignInButtons providers={[]} emailOtpEnabled />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.queryByText(/no social sign-in providers/i)).toBeNull();
  });

  it("sends a sign-in code, then verifies it", async () => {
    hoisted.sendVerificationOtp.mockResolvedValue({ data: { success: true } });
    hoisted.signInEmailOtp.mockResolvedValue({ data: { token: "t" } });
    render(<EmailOtpForm callbackURL="/closet" />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: " bot@example.com " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));

    const codeInput = await screen.findByLabelText("Code");
    expect(hoisted.sendVerificationOtp).toHaveBeenCalledWith({
      email: "bot@example.com",
      type: "sign-in",
    });

    fireEvent.change(codeInput, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));

    await waitFor(() => expect(hoisted.push).toHaveBeenCalledWith("/closet"));
    expect(hoisted.signInEmailOtp).toHaveBeenCalledWith({
      email: "bot@example.com",
      otp: "123456",
    });
  });
});
