import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}
const root = path.resolve(args.get("--root") ?? "");
const port = Number(args.get("--port") ?? "38941");
if (!path.basename(root).startsWith("Skill-Studio-Pro-Task2-UAT-")) {
  throw new Error(`Refusing to run outside a Task 2 UAT root: ${root}`);
}
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error(`Invalid loopback port: ${port}`);
}

const evidenceDirectory = path.join(root, "evidence");
const controlDirectory = path.join(root, "fixtures");
const requestLog = path.join(evidenceDirectory, "mock-provider-requests.jsonl");
const readyFile = path.join(evidenceDirectory, "mock-provider-ready.json");
const delayFile = path.join(controlDirectory, "mock-provider-delay-ms.txt");
fs.mkdirSync(evidenceDirectory, { recursive: true });
fs.mkdirSync(controlDirectory, { recursive: true });

function json(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(body) });
  response.end(body);
}

function minimaxContent(body) {
  const system = String(body?.messages?.[0]?.content ?? "");
  if (system.includes("标签")) return { tags: ["windows-uat", "isolated"] };
  if (system.includes("类别")) return { category: "developer-tooling", rationale: "Mock response based on the isolated fixture." };
  return {
    usagePoints: ["Open SKILL.md", "Follow the isolated UAT instructions"],
    dependencies: [],
    inputs: ["Skill content"],
    outputs: ["Verified UAT result"],
  };
}

function responseContent(schemaName) {
  if (schemaName === "final_summary") {
    return { oneLineSummary: "隔离 Windows UAT Skill", details: "Mock Provider 仅处理本任务隔离 fixture，用于验证简介、缓存、取消与过期流程。" };
  }
  return { oneLineSummary: "Task 2 mock summary", details: "Isolated mock provider response." };
}

const server = http.createServer((request, response) => {
  const chunks = [];
  request.on("data", (chunk) => chunks.push(chunk));
  request.on("end", async () => {
    const raw = Buffer.concat(chunks).toString("utf8");
    let body = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch { body = {}; }
    const schemaName = body?.text?.format?.name ?? null;
    const entry = {
      at: new Date().toISOString(),
      method: request.method,
      path: request.url,
      requestBytes: Buffer.byteLength(raw),
      schemaName,
      authorizationPresent: Boolean(request.headers.authorization),
    };
    fs.appendFileSync(requestLog, `${JSON.stringify(entry)}\n`, "utf8");

    const configuredDelay = Number.parseInt(fs.existsSync(delayFile) ? fs.readFileSync(delayFile, "utf8") : "0", 10);
    if (Number.isFinite(configuredDelay) && configuredDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(configuredDelay, 30_000)));
    }

    if (request.method === "GET" && request.url === "/v1/models") {
      json(response, 200, { data: [{ id: "MiniMax-UAT", display_name: "MiniMax UAT Mock" }] });
      return;
    }
    if (request.method === "GET" && request.url?.startsWith("/v1/models/")) {
      const id = decodeURIComponent(request.url.slice("/v1/models/".length));
      json(response, 200, { id, display_name: "OpenAI UAT Mock" });
      return;
    }
    if (request.method === "POST" && request.url === "/v1/chat/completions") {
      json(response, 200, {
        id: `mm-uat-${Date.now()}`,
        model: body.model ?? "MiniMax-UAT",
        choices: [{ message: { content: JSON.stringify(minimaxContent(body)) } }],
        usage: { prompt_tokens: 17, completion_tokens: 9 },
        base_resp: { status_code: 0, status_msg: "" },
      });
      return;
    }
    if (request.method === "POST" && request.url === "/v1/responses") {
      json(response, 200, {
        id: `resp-uat-${Date.now()}`,
        model: body.model ?? "gpt-uat",
        output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(responseContent(schemaName)) }] }],
        usage: { input_tokens: 19, output_tokens: 11 },
      });
      return;
    }
    json(response, 404, { error: { message: "Task 2 mock route not found" } });
  });
});

server.listen(port, "127.0.0.1", () => {
  fs.writeFileSync(readyFile, JSON.stringify({ pid: process.pid, baseUrl: `http://127.0.0.1:${port}`, requestLog }, null, 2), "utf8");
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
