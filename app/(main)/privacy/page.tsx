import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="font-serif text-2xl text-foreground">Privacy</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        This policy is being prepared. Check back soon.
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
