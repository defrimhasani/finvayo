import { Brand } from "../components/Brand";

export function NotFoundPage() {
  return (
    <>
      <header className="site-header"><Brand /></header>
      <main id="main" className="process">
        <p className="eyebrow">404 / Not found</p>
        <h1>This page is not part of the outlook.</h1>
        <a className="button button-primary" href="/">Return home</a>
      </main>
    </>
  );
}
