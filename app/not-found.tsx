import Link from "next/link";
export default function NotFound() {
  return (
    <section className="section empty">
      <span className="eyebrow">404 · NOT ON THE MENU</span>
      <h1>Let’s get you back to NVO.</h1>
      <Link className="button" href="/">
        Back home
      </Link>
    </section>
  );
}
