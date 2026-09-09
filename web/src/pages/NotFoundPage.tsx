import { Brand } from "../components/Brand";
import { Button } from "../components/ui/button";

export function NotFoundPage() {
  return (
    <>
      <header className="mx-auto flex min-h-18 w-[min(calc(100%-2rem),1240px)] items-center border-b sm:min-h-20 sm:w-[min(calc(100%-3rem),1240px)]"><Brand /></header>
      <main id="main" className="mx-auto flex min-h-[calc(100vh-4.5rem)] w-[min(calc(100%-2rem),1240px)] flex-col items-start justify-center py-20 sm:min-h-[calc(100vh-5rem)] sm:w-[min(calc(100%-3rem),1240px)]">
        <p className="mb-6 font-mono text-[0.7rem] font-medium uppercase tracking-[0.12em] text-muted-foreground before:mr-2.5 before:inline-block before:w-7 before:border-t-2 before:border-accent before:align-middle">404 / Not found</p>
        <h1 className="mb-10 max-w-[850px] text-balance text-[clamp(3.25rem,9vw,6.7rem)] font-semibold leading-[0.92] tracking-[-0.072em]">This page is not part of the outlook.</h1>
        <Button nativeButton={false} render={<a href="/" />}>Return home</Button>
      </main>
    </>
  );
}
