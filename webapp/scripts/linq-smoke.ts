/**
 * Smoke test: `cd webapp && set -a && source ../.env && set -a && npx tsx scripts/linq-smoke.ts`
 */
import { LinqService } from "../src/lib/linq-service";

async function main() {
  const s = LinqService.fromEnv();
  const phones = await s.listPhoneNumbers();
  console.log("listPhoneNumbers:", phones.ok, phones.status, phones.json ?? phones.text.slice(0, 200));

  const from = process.env.LINQ_FROM_NUMBER;
  const to = process.env.LINQ_DEFAULT_TO_NUMBER;
  if (!from || !to) {
    console.error("Missing LINQ_FROM_NUMBER or LINQ_DEFAULT_TO_NUMBER");
    process.exit(1);
  }
  const chat = await s.createChat({
    from,
    to: [to],
    message: { parts: [{ type: "text", value: `LinqService smoke ${new Date().toISOString()}` }] },
  });
  console.log("createChat:", chat.ok, chat.status, chat.json ?? chat.text.slice(0, 200));
  if (!phones.ok || !chat.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
