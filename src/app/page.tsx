import { Button } from "@/ui/kit/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-semibold tracking-tight">Applicator</h1>
      <Button>Get started</Button>
    </main>
  );
}
