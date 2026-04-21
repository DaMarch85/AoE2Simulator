import { clsx } from "clsx";

export function cn(...values: Array<string | false | null | undefined>) {
  return clsx(values);
}

export function formatClock(inputSec: number | null | undefined) {
  if (inputSec == null || Number.isNaN(inputSec)) {
    return "—";
  }

  const safe = Math.max(0, Math.round(inputSec));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatResource(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }

  return Math.round(value).toString();
}
