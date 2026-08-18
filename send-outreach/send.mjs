import { Resend } from "resend";
import { readFile } from "node:fs/promises";

const key = process.env.RESEND_API_KEY;
if (!key) {
  console.error("RESEND_API_KEY is not set. Add it in the Keys / API keys tab, then run again.");
  process.exit(1);
}

const resend = new Resend(key);
const cfg = JSON.parse(await readFile(new URL("./recipients.json", import.meta.url), "utf8"));

let ok = 0;
for (const m of cfg.messages) {
  const { data, error } = await resend.emails.send({
    from: cfg.from,
    to: [m.to],
    subject: m.subject,
    text: m.text,
  });
  if (error) {
    console.error(`FAIL  ${m.to}  —  ${error.message}`);
  } else {
    ok += 1;
    console.log(`OK    ${m.to}  —  ${data?.id ?? "sent"}`);
  }
}

console.log(`\nDone: ${ok}/${cfg.messages.length} sent.`);
