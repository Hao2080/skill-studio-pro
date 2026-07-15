type UiLanguage = "zh-CN" | "en-US";

export function normalizeUpdatedAtTimestamp(timestamp: number) {
  return timestamp > 1_000_000_000_000 ? timestamp : timestamp * 1000;
}

export function formatUpdatedAtTimestamp(timestamp: number, locale: UiLanguage = "zh-CN") {
  const date = new Date(normalizeUpdatedAtTimestamp(timestamp));
  const formatOptions: Intl.DateTimeFormatOptions = {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };

  if (date.getFullYear() !== new Date().getFullYear()) {
    formatOptions.year = "numeric";
  }

  return date.toLocaleString(locale, formatOptions);
}
