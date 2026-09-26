import { Button } from "@/ui/kit/button";
import { messages } from "@/ui/messages";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-semibold tracking-tight">{messages.app.name}</h1>
      <Button>{messages.home.getStarted}</Button>
    </main>
  );
}
