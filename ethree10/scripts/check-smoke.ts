type HealthResponse = {
  status?: string;
  checks?: Array<{ name: string; status: string; detail?: string }>;
};

function baseUrl() {
  return (
    process.env["SMOKE_BASE_URL"] ??
    process.env["NEXT_PUBLIC_APP_URL"] ??
    process.env["NEXTAUTH_URL"] ??
    "http://127.0.0.1:3000"
  ).replace(/\/$/, "");
}

async function check(path: string) {
  const url = `${baseUrl()}${path}`;
  const response = await fetch(url, { headers: { accept: "application/json" } });
  const body = (await response.json().catch(() => null)) as HealthResponse | null;

  if (!response.ok || body?.status !== "ok") {
    const details = body?.checks
      ?.filter((item) => item.status !== "ok")
      .map((item) => `${item.name}: ${item.detail ?? item.status}`)
      .join("; ");
    throw new Error(`${url} failed with HTTP ${response.status}${details ? ` (${details})` : ""}`);
  }

  console.log(`PASS ${url}`);
}

async function main() {
  await check("/api/health?mode=live");
  await check("/api/health?mode=ready");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
