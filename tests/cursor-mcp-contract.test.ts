import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cursorMcpPath = path.join(repoRoot, ".cursor", "mcp.json");

type CursorMcpConfig = {
  mcpServers?: Record<
    string,
    {
      url?: string;
      headers?: Record<string, string>;
      command?: string;
      args?: string[];
    }
  >;
};

describe("Cursor project MCP contract", () => {
  const raw = readFileSync(cursorMcpPath, "utf8");
  const config = JSON.parse(raw) as CursorMcpConfig;
  const servers = config.mcpServers ?? {};

  it("keeps Context7 on the remote URL with env-interpolated CONTEXT7_API_KEY header", () => {
    expect(servers.context7?.url).toBe("https://mcp.context7.com/mcp");
    expect(servers.context7?.headers?.CONTEXT7_API_KEY).toBe("${env:CONTEXT7_API_KEY}");
    expect(servers.context7?.headers?.Authorization).toBeUndefined();
  });

  it("does not embed Context7 API key literals", () => {
    expect(raw).not.toMatch(/ctx7sk/i);
  });

  it("keeps the sanctioned co-resident MCP set with chrome-devtools pinned", () => {
    expect(Object.keys(servers).sort()).toEqual(["chrome-devtools", "context7", "supabase"]);
    expect(servers["chrome-devtools"]?.command).toBe("npx");
    expect(servers["chrome-devtools"]?.args).toEqual(["-y", "chrome-devtools-mcp@1.6.0"]);
    expect(servers.supabase?.url).toBe("https://mcp.supabase.com/mcp?project_ref=sjrfecxgysukkwxsowpy&read_only=true");
  });
});
