/** Orange chicken mark used on hosted sign-in screens and as the home-screen icon. */
export function AuthBrand({
  title = "PoultryTech",
  subtitle,
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/apple-touch-icon.png"
        alt=""
        width={88}
        height={88}
        className="mx-auto"
      />
      <p className="mt-3 font-serif text-xl font-extrabold tracking-tight text-emerald-900">{title}</p>
      {subtitle ? <p className="mt-2 text-sm text-stone-600">{subtitle}</p> : null}
    </div>
  );
}
