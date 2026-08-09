import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div
      className="mx-auto max-w-lg px-4 py-16 text-left"
      data-testid="privacy-shell-marker"
    >
      <h1 className="font-serif text-2xl text-foreground text-center">
        Privacy
      </h1>
      <div className="mt-6 space-y-4 text-sm text-muted-foreground">
        <p>
          Project Blue Jeans stores the clothing photos and outfit data you
          upload so we can show your closet and suggest looks.
        </p>
        <p>
          If you add a Wearer photo, we store that image (and its storage key)
          on your account and may send it to our image model solely to generate
          try-on style hero images for your outfits. We do not sell your photos.
        </p>
        <p>
          Account data is tied to your sign-in identity and retained while your
          account is active. You can replace or remove your Wearer photo from
          Settings. To delete your account and associated data, contact us and
          we will remove stored garments, outfits, plans, and photos for that
          account.
        </p>
        <p>
          Uploads are hosted with our storage provider; generation uses Google
          Vertex AI under our project configuration. Access is limited to your
          signed-in Wearer session.
        </p>
      </div>
      <div className="mt-8 text-center">
        <Link
          href="/closet"
          className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Back to app
        </Link>
      </div>
    </div>
  );
}
