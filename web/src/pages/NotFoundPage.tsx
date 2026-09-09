import { Brand } from "../components/Brand";
import { Button } from "../components/ui/button";

export function NotFoundPage() {
  return (
    <>
      <header className="site-header"><Brand /></header>
      <main id="main" className="process">
        <p className="eyebrow">404 / Not found</p>
        <h1>This page is not part of the outlook.</h1>
        <Button asChild className="button button-primary"><a href="/">Return home</a></Button>
      </main>
    </>
  );
}
