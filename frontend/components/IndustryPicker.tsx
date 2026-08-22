"use client";

import { useMemo } from "react";

import { INDUSTRIES, formatIndustry, parseIndustry } from "@/lib/industries";

/**
 * Category then sub-category picker for the enterprise industry field.
 *
 * The stored value stays a single string, so a legacy free-text entry still
 * loads; when it matches no category the picker says so instead of silently
 * discarding what is already recorded.
 */
export default function IndustryPicker({
  value,
  onChange,
  className = "input",
}: {
  value: string;
  onChange: (next: string) => void;
  className?: string;
}) {
  const parsed = useMemo(() => parseIndustry(value), [value]);
  const categoryLabel = parsed.category?.label || "";
  const subs = parsed.category?.subs || [];
  const isUnrecognised = Boolean(parsed.raw) && !parsed.category;

  return (
    <div className="space-y-2">
      <select
        aria-label="產業大類"
        className={className}
        value={categoryLabel}
        onChange={event => onChange(formatIndustry(event.target.value, ""))}
      >
        <option value="">未選擇</option>
        {INDUSTRIES.map(item => (
          <option key={item.key} value={item.label}>
            {item.icon} {item.label}
          </option>
        ))}
      </select>

      {subs.length > 0 && (
        <select
          aria-label="產業子類"
          className={className}
          value={parsed.sub}
          onChange={event => onChange(formatIndustry(categoryLabel, event.target.value))}
        >
          <option value="">不指定子類</option>
          {subs.map(sub => (
            <option key={sub} value={sub}>
              {sub}
            </option>
          ))}
        </select>
      )}

      {isUnrecognised && (
        <p className="text-xs text-amber-700">
          目前值「{parsed.raw}」不屬於任何分類，請重新選擇以便納入跨企業分析。
        </p>
      )}
    </div>
  );
}
