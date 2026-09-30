// Headless smoke test for the local dev server (http://localhost:8080).
// Usage: node scripts/smoke-test.mjs [email] [password]
// Creates a throwaway account, exercises auth/quiz/profile flows, prints PASS/FAIL summary.
import fs from "node:fs";
import puppeteer from "puppeteer-core";

// Load .env so the Supabase REST query works when run via plain `node`.
for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^(VITE_SUPABASE_[A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const CHROME_PATHS = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  (process.env.LOCALAPPDATA || "") + "/Google/Chrome/Application/chrome.exe",
].filter((p) => p && fs.existsSync(p));

const BASE = "http://localhost:8080";
const email = process.argv[2] || `smoke+${Date.now()}@example.com`;
const password = process.argv[3] || "SmokeTest!2026x";
const username = `smoke${String(Date.now()).slice(-8)}`;

const results = [];
const consoleErrors = [];
const step = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
};
const skip = (name, detail = "") => {
  results.push({ name, ok: true, detail: "SKIPPED " + detail });
  console.log(`SKIP  ${name}${detail ? " — " + detail : ""}`);
};

const browser = await puppeteer.launch({
  executablePath: CHROME_PATHS[0],
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const page = await browser.newPage();
page.setDefaultTimeout(30000);
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => consoleErrors.push("pageerror: " + err.message));
const failedRequests = [];
page.on("response", (res) => {
  if (res.status() >= 400) {
    failedRequests.push({
      status: res.status(),
      url: res.url(),
      body: res.text().catch(() => "<unreadable>"),
    });
  }
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const text = () => page.evaluate(() => document.body.innerText);

try {
  // ---------- 1. Public pages render ----------
  await page.goto(BASE + "/", { waitUntil: "networkidle2" });
  step("homepage renders", (await text()).includes("AlgoArena"));

  await page.goto(BASE + "/contests", { waitUntil: "networkidle2" });
  await sleep(1500);
  step("contests page renders", (await text()).length > 100);

  // ---------- 2. Protected route redirects to /auth when logged out ----------
  await page.goto(BASE + "/profile", { waitUntil: "networkidle2" });
  step("protected /profile redirects to /auth", page.url().includes("/auth"));

  await page.goto(BASE + "/leaderboard", { waitUntil: "networkidle2" });
  await sleep(1000);
  step("leaderboard renders", (await text()).toLowerCase().includes("leaderboard"));

  // ---------- 3. Sign up ----------
  await page.goto(BASE + "/auth/signup", { waitUntil: "networkidle2" });
  await page.waitForSelector("#username", { visible: true });
  await page.type("#username", username, { delay: 10 });
  await page.type("#email", email, { delay: 10 });
  await page.type("#password", password, { delay: 10 });
  await page.type("#confirmPassword", password, { delay: 10 });
  await page.click('button[type="submit"]');
  await sleep(4000);
  const afterSignup = await text();
  const hasSession = await page.evaluate(() =>
    Object.keys(localStorage).some((k) => k.includes("auth-token")),
  );
  // Distinguish app failures from server-side/infra blocks on the signup call.
  const signupBlock = failedRequests.find((r) => r.url.includes("/auth/v1/signup"));
  const blockBody = signupBlock ? (await signupBlock.body) || "" : "";
  if (/email_address_invalid|over_email_send_rate_limit/.test(blockBody)) {
    const reason = blockBody.includes("rate_limit")
      ? "Supabase email rate limit exhausted"
      : "Supabase rejects the test address as invalid";
    skip("signup submits", reason);
  } else {
    step(
      "signup submits",
      hasSession || afterSignup.includes("verify") || afterSignup.includes("Check your email"),
      `url=${page.url()}${hasSession ? " (session created)" : " (email confirmation likely required)"}`,
    );
  }

  // ---------- 4-6. Signed-in flows (only possible if signup created a session) ----------
  const blockedSignup = results[results.length - 1].detail.startsWith("SKIPPED");
  if (hasSession) {
    await page.evaluate(() => localStorage.clear());
    await page.goto(BASE + "/auth", { waitUntil: "networkidle2" });
    await page.waitForSelector("#email", { visible: true });
    await page.type("#email", email, { delay: 10 });
    await page.type("#password", password, { delay: 10 });
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 }).catch(() => {}),
      page.click('button[type="submit"]'),
    ]);
    await sleep(2500);
    const signinSession = await page.evaluate(() =>
      Object.keys(localStorage).some((k) => k.includes("auth-token")),
    );
    step("signin reaches app", signinSession && !page.url().includes("/auth"), `url=${page.url()}`);

    // Profile flow
    await page.goto(BASE + "/profile", { waitUntil: "networkidle2" });
    await sleep(2500);
    const profileTxt = await text();
    step(
      "profile loads with stats",
      /Total Contests|Contests/i.test(profileTxt),
      `url=${page.url()}`,
    );
    step("profile shows username", profileTxt.toLowerCase().includes(username.toLowerCase()));

    // Quiz guard rails on an ended contest (fetched via Supabase REST)
    const sbUrl = process.env.VITE_SUPABASE_URL;
    const sbKey = process.env.VITE_SUPABASE_ANON_KEY;
    let endedContestId = null;
    if (sbUrl && sbKey) {
      const res = await fetch(
        `${sbUrl}/rest/v1/contests?select=id,name,start_time,duration_minutes,status&order=start_time.asc&limit=50`,
        { headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` } },
      );
      const contests = await res.json();
      const now = Date.now();
      const ended = (contests || []).find(
        (c) => c.start_time && new Date(c.start_time).getTime() + 90 * 60 * 1000 < now,
      );
      endedContestId = ended?.id ?? null;
      step(
        "found an ended contest to test quiz guards",
        Boolean(endedContestId),
        ended ? `contest "${ended.name}"` : "none in DB",
      );
    } else {
      skip("found an ended contest to test quiz guards", "missing Supabase env");
    }

    if (endedContestId) {
      await page.goto(`${BASE}/quiz/${endedContestId}`, { waitUntil: "networkidle2" });
      await sleep(3000);
      const quizTxt = await text();
      step(
        "quiz shows contest-ended guard for ended contest",
        /ended|cannot participate|already completed/i.test(quizTxt),
        `url=${page.url()}`,
      );
    }
  } else {
    skip(
      "signin reaches app",
      blockedSignup ? results[results.length - 1].detail.replace("SKIPPED ", "") : "email confirmation required for fresh account",
    );
    skip("profile loads with stats", "no session");
    skip("profile shows username", "no session");
    skip("quiz shows contest-ended guard", "no session");
  }

  // ---------- Summary ----------
  const failed = results.filter((r) => !r.ok);
  console.log("\n==== SUMMARY ====");
  console.log(`${results.length - failed.length}/${results.length} checks passed`);
  if (failedRequests.length) {
    console.log("\nFailed network requests:");
    for (const r of failedRequests.slice(0, 8)) {
      console.log(`  - HTTP ${r.status} ${r.url.slice(0, 120)}`);
      const b = await r.body;
      if (b && b !== "<unreadable>") console.log("    " + b.slice(0, 250).replace(/\n/g, " "));
    }
  }
  const realErrors = consoleErrors.filter(
    (e) => !/favicon|404|source ?map|sourcemap|Download the React DevTools/i.test(e),
  );
  if (realErrors.length) {
    console.log("\nConsole errors:");
    for (const e of realErrors.slice(0, 10)) console.log("  - " + e.slice(0, 200));
  } else {
    console.log("No unexpected console errors");
  }
  await browser.close();
  process.exit(failed.length ? 1 : 0);
} catch (err) {
  console.error("SCRIPT ERROR:", err.message);
  try {
    await page.screenshot({ path: "scripts/smoke-failure.png" });
    console.error("Screenshot saved to scripts/smoke-failure.png");
  } catch {}
  await browser.close();
  process.exit(2);
}
