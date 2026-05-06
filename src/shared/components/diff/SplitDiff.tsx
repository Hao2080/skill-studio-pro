import type { TextDiffEntry } from "@/types/skill";

interface SplitDiffProps {
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
      if (match) { oldNum = parseInt(match[1], 10) - 1; newNum = parseInt(match[2], 10) - 1; }
      result.push({ type: "header", content: line, oldLineNum: null, newLineNum: null });
    } else if (line.startsWith("+") && !line.startsWith("+++")) {
      newNum++;
      result.push({ type: "add", content: line.slice(1), oldLineNum: null, newLineNum: newNum });
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      oldNum++;
      result.push({ type: "remove", content: line.slice(1), oldLineNum: oldNum, newLineNum: null });
    } else {
      oldNum++; newNum++;
      result.push({ type: "context", content: line.startsWith(" ") ? line.slice(1) : line, oldLineNum: oldNum, newLineNum: newNum });
    }
  }
  return result;
}

export function SplitDiff({ diff }: SplitDiffProps) {
  const parsed = parseUnifiedDiff(diff.unifiedDiff);

  // 构建左右两侧行对：收集连续 remove/add 块后逐行配对
  const pairs: Array<{ left: DiffLine | null; right: DiffLine | null }> = [];
  let i = 0;
  while (i < parsed.length) {
    const line = parsed[i];
    if (line.type === "header") { i++; continue; }
    if (line.type === "context") {
      pairs.push({ left: line, right: line });
      i++;
      continue;
    }
    const removes: DiffLine[] = [];
    const adds: DiffLine[] = [];
    while (i < parsed.length && parsed[i].type === "remove") {
      removes.push(parsed[i]);
      i++;
    }
    while (i < parsed.length && parsed[i].type === "add") {
      adds.push(parsed[i]);
      i++;
    }
    const maxLen = Math.max(removes.length, adds.length);
    for (let j = 0; j < maxLen; j++) {
      pairs.push({
        left: j < removes.length ? removes[j] : null,
        right: j < adds.length ? adds[j] : null,
      });
    }
  }

  const renderSide = (line: DiffLine | null, side: "left" | "right") => {
    if (!line) return (
      <div style={{ display: "flex", lineHeight: "20px", background: "var(--bg-base)", opacity: 0.3 }}>
        <span style={{ width: 40, padding: "0 6px", textAlign: "right", borderRight: "1px solid var(--border-subtle)", flexShrink: 0, fontSize: 11 }}>&nbsp;</span>
        <span style={{ width: 14, flexShrink: 0 }}>&nbsp;</span>
        <span style={{ padding: "0 8px", whiteSpace: "pre" }}>&nbsp;</span>
      </div>
    );
    const isAdd = line.type === "add";
    const isRemove = line.type === "remove";
    const lnNum = side === "left" ? line.oldLineNum : line.newLineNum;
    const bg = isAdd ? "var(--diff-add-bg)" : isRemove ? "var(--diff-rem-bg)" : "transparent";
    const lnBg = isAdd ? "var(--diff-add-ln)" : isRemove ? "var(--diff-rem-ln)" : "transparent";
    const textColor = isAdd ? "var(--diff-add-text)" : isRemove ? "var(--diff-rem-text)" : "var(--text-secondary)";
    const lnColor = isAdd ? "var(--accent-green)" : isRemove ? "var(--accent-red)" : "var(--text-faint)";
    const prefix = isAdd ? "+" : isRemove ? "-" : " ";

    return (
      <div style={{ display: "flex", lineHeight: "20px", background: bg }}>
        <span style={{ width: 40, padding: "0 6px", textAlign: "right", color: lnColor, background: lnBg, borderRight: "1px solid var(--border-subtle)", flexShrink: 0, fontSize: 11, userSelect: "none" }}>
          {lnNum ?? ""}
        </span>
        <span style={{ width: 14, textAlign: "center", color: textColor, flexShrink: 0, userSelect: "none", fontWeight: 700 }}>
          {prefix}
        </span>
        <span style={{ padding: "0 8px", whiteSpace: "pre", fontFamily: "'SF Mono', Consolas, monospace", fontSize: 12, color: textColor }}>
          {line.content || " "}
        </span>
      </div>
    );
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", height: "100%", overflow: "hidden" }}>
      <div style={{ overflow: "auto", borderRight: "1px solid var(--border-subtle)" }}>
        {pairs.map((p, idx) => <div key={idx}>{renderSide(p.left, "left")}</div>)}
      </div>
      <div style={{ overflow: "auto" }}>
        {pairs.map((p, idx) => <div key={idx}>{renderSide(p.right, "right")}</div>)}
      </div>
    </div>
  );
}
