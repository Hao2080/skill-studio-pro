import type { TextDiffEntry } from "@/types/skill";

interface TextDiffProps {
  diff: TextDiffEntry;
}

interface DiffLine {
  type: "add" | "remove" | "context" | "header";
  content: string;
  oldLineNum: number | null;
  newLineNum: number | null;
}

function parseUnifiedDiff(diffText: string): DiffLine[] {
  const lines = diffText.split("\n");
  const result: DiffLine[] = [];
  let oldNum = 0;
  let newNum = 0;

  for (const line of lines) {
    if (line.startsWith("@@")) {
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldNum = parseInt(match[1], 10) - 1;
        newNum = parseInt(match[2], 10) - 1;
      }
      result.push({ type: "header", content: line, oldLineNum: null, newLineNum: null });
    } else if (line.startsWith("+") && !line.startsWith("+++") && !line.startsWith("\\ ")) {
      newNum++;
      result.push({ type: "add", content: line.slice(1), oldLineNum: null, newLineNum: newNum });
    } else if (line.startsWith("-") && !line.startsWith("---") && !line.startsWith("\\ ")) {
      oldNum++;
      result.push({ type: "remove", content: line.slice(1), oldLineNum: oldNum, newLineNum: null });
    } else {
      oldNum++;
      newNum++;
      result.push({ type: "context", content: line.startsWith(" ") ? line.slice(1) : line, oldLineNum: oldNum, newLineNum: newNum });
    }
  }

  return result;
}

const lineColors: Record<string, { bg: string; text: string; lnBg: string; prefix: string }> = {
  add:     { bg: "var(--diff-add-bg)", text: "var(--diff-add-text)", lnBg: "var(--diff-add-ln)", prefix: "+" },
  remove:  { bg: "var(--diff-rem-bg)", text: "var(--diff-rem-text)", lnBg: "var(--diff-rem-ln)", prefix: "-" },
  context: { bg: "transparent",        text: "var(--text-secondary)", lnBg: "transparent",        prefix: " " },
  header:  { bg: "var(--bg-surface)",  text: "var(--text-muted)",    lnBg: "var(--bg-surface)",   prefix: "" },
};

export function TextDiff({ diff }: TextDiffProps) {
  const parsed = parseUnifiedDiff(diff.unifiedDiff);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "6px 12px", background: "var(--bg-surface)", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "'SF Mono', Consolas, monospace", fontSize: 12, flexShrink: 0 }}>
        <span style={{ fontWeight: 500, color: "var(--text-secondary)" }}>{diff.filePath.split("/").pop()}</span>
        <span style={{ fontSize: 11 }}>
          <span style={{ color: "var(--accent-green)" }}>+{diff.newLines} </span>
          <span style={{ color: "var(--accent-red)" }}>-{diff.oldLines}</span>
        </span>
      </div>
      <div style={{ flex: 1, overflow: "auto", fontFamily: "'SF Mono', Consolas, monospace", fontSize: 12 }}>
        {parsed.map((line, i) => {
          const c = lineColors[line.type];
          return (
            <div key={i} style={{ display: "flex", lineHeight: "20px", background: c.bg }}>
              {/* 旧行号 */}
              <span style={{ width: 44, padding: "0 6px", textAlign: "right", color: "var(--text-faint)", background: c.lnBg, borderRight: "1px solid var(--border-subtle)", flexShrink: 0, fontSize: 11, userSelect: "none" }}>
                {line.oldLineNum ?? ""}
              </span>
              {/* 新行号 */}
              <span style={{ width: 44, padding: "0 6px", textAlign: "right", color: "var(--text-faint)", background: c.lnBg, borderRight: "1px solid var(--border-subtle)", flexShrink: 0, fontSize: 11, userSelect: "none" }}>
                {line.newLineNum ?? ""}
              </span>
              {/* +/- 前缀 */}
              <span style={{ width: 16, textAlign: "center", color: c.text, flexShrink: 0, userSelect: "none", fontWeight: 700 }}>
                {c.prefix}
              </span>
              {/* 内容 */}
              <span style={{ padding: "0 8px", whiteSpace: "pre", color: c.text }}>
                {line.type === "header" ? line.content : (line.content || " ")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
