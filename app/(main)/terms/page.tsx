import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center" data-testid="terms-shell-marker">
      <h1 className="font-serif text-2xl text-foreground">Terms</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Terms of use are being prepared. Check back soon.
      </p>
      <Link
        href="/closet"
        className="mt-8 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        Back to app
      </Link>
    </div>
  );
}
