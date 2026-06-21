import { Agent, fetch as undiciFetch, type Dispatcher } from "undici";

/**
 * Probes a WhatsApp media URL directly to find out WHY a download returns 403.
 *
 *   npm run probe:media -- "https://mmg.whatsapp.net/v/....enc?ccb=11-4&oh=...&oe=...&_nc_sid=...&_nc_hot=..."
 *
 * Paste a URL straight from logs/app.log ("Failed to fetch stream from ...").
 * The encrypted bytes can't be decrypted here, but the HTTP status, headers, and
 * body snippet tell us the real cause:
 *   - A WhatsApp/Facebook CDN response that 403s every variant  -> auth/fromMe issue.
 *   - A block page (Squid/antivirus/"Access Denied" HTML)       -> local TLS interception.
 *   - 200 only when a User-Agent is sent                        -> missing UA header.
 */
const url = process.argv.slice(2).find((a) => a.startsWith("http"));
if (!url) {
  console.error('Usage: npm run probe:media -- "<media-url-from-log>"');
  process.exit(1);
}

const insecure = new Agent({ connect: { rejectUnauthorized: false } });

const variants: { name: string; headers: Record<string, string>; dispatcher?: Dispatcher }[] = [
  { name: "origin-only (insecure TLS)", headers: { Origin: "https://web.whatsapp.com" }, dispatcher: insecure },
  {
    name: "browser User-Agent (insecure TLS)",
    headers: {
      Origin: "https://web.whatsapp.com",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    },
    dispatcher: insecure,
  },
  { name: "no headers (insecure TLS)", headers: {}, dispatcher: insecure },
  { name: "origin-only (default TLS verify)", headers: { Origin: "https://web.whatsapp.com" } },
];

async function main(): Promise<void> {
  console.log(`\nProbing: ${url}\n`);
  for (const v of variants) {
    try {
      const res = await undiciFetch(url!, { method: "GET", headers: v.headers, dispatcher: v.dispatcher });
      const body = await res.text();
      console.log(`--- ${v.name} ---`);
      console.log(`status: ${res.status} ${res.statusText}`);
      console.log(`server: ${res.headers.get("server") ?? "-"}  via: ${res.headers.get("via") ?? "-"}`);
      console.log(`content-type: ${res.headers.get("content-type") ?? "-"}  length: ${body.length}`);
      const printable = /[\x00-\x08\x0e-\x1f]/.test(body.slice(0, 64)) ? "<binary>" : body.slice(0, 400);
      console.log(`body: ${printable}\n`);
    } catch (e) {
      console.log(`--- ${v.name} ---`);
      console.log(`threw: ${String(e)}${(e as Error)?.cause ? ` | cause: ${String((e as Error).cause)}` : ""}\n`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
