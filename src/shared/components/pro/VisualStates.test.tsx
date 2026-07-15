/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StatusBadge } from "./StatusBadge";

describe("Pro visual states", () => {
  afterEach(cleanup);

  it.each([
    ["已连接", "success"],
    ["存在漂移", "warning"],
    ["生成失败", "danger"],
    ["Mock 模式", "info"],
    ["未配置", "neutral"],
  ] as const)("renders %s with a semantic tone class", (label, tone) => {
    render(<StatusBadge label={label} tone={tone} />);
    expect(screen.getByText(label).classList.contains(`status-badge--${tone}`)).toBe(true);
  });
});
