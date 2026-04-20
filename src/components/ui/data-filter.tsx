"use client";

import { useState, useEffect } from "react";
import { Filter, X, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export type FilterType = "text" | "select" | "boolean";

export interface FilterField {
  key: string;
  label: string;
  type: FilterType;
  options?: { label: string; value: string }[];
}

export type FilterOperator = "equals" | "contains" | "not_equals";

export interface FilterRule {
  id: string;
  field: string;
  operator: FilterOperator;
  value: string;
}

interface DataFilterProps {
  fields: FilterField[];
  storageKey: string;
  onFilterChange: (rules: FilterRule[]) => void;
}

function isFilterOperator(value: unknown): value is FilterOperator {
  return (
    value === "equals" ||
    value === "contains" ||
    value === "not_equals"
  );
}

function isFilterRule(value: unknown): value is FilterRule {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<FilterRule>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.field === "string" &&
    isFilterOperator(candidate.operator) &&
    typeof candidate.value === "string"
  );
}

export function DataFilter({ fields, storageKey, onFilterChange }: DataFilterProps) {
  const [rules, setRules] = useState<FilterRule[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hasSavedPreset, setHasSavedPreset] = useState(false);

  // Load from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem(`energdive-filter-${storageKey}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const restoredRules = Array.isArray(parsed)
          ? parsed.filter(isFilterRule)
          : [];

        if (restoredRules.length > 0) {
          setRules(restoredRules);
          setHasSavedPreset(true);
          setIsOpen(true);
        } else {
          setHasSavedPreset(false);
        }
      } catch (e) {
        console.error("Failed to parse saved filters:", e);
      }
    }
  }, [storageKey]);

  // Sync upstream when rules change
  useEffect(() => {
    onFilterChange(rules);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules]);

  const addRule = () => {
    if (fields.length === 0) {
      setIsOpen(true);
      return;
    }

    const defaultField = fields[0];
    const operator: FilterOperator =
      defaultField.type === "text" ? "contains" : "equals";

    setRules((prev) => [
      ...prev,
      {
        id:
          globalThis.crypto?.randomUUID?.() ??
          `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
        field: defaultField.key,
        operator,
        value: "",
      },
    ]);
    setIsOpen(true);
  };

  const updateRule = (id: string, key: keyof FilterRule, value: string) => {
    setRules((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const updated = { ...r, [key]: value };
          // Auto-adjust operator if field type changes
          if (key === "field") {
            const fieldDef = fields.find((f) => f.key === value);
            if (fieldDef?.type !== "text") {
              updated.operator = "equals";
            }
            updated.value = ""; // Reset value on field change
          }
          return updated;
        }
        return r;
      })
    );
  };

  const removeRule = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  const clearAll = () => {
    setRules([]);
    setIsOpen(false);
  };

  const savePreset = () => {
    localStorage.setItem(`energdive-filter-${storageKey}`, JSON.stringify(rules));
    setHasSavedPreset(true);
  };

  const clearPreset = () => {
    localStorage.removeItem(`energdive-filter-${storageKey}`);
    setHasSavedPreset(false);
  };

  return (
    <div className="w-full space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-emerald-600" />
          <h3 className="text-sm font-semibold text-gray-900">Custom Filters</h3>
          {rules.length > 0 && (
            <Badge variant="secondary" className="ml-2 bg-emerald-50 text-emerald-700">
              {rules.length} active
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {rules.length > 0 && (
            <>
              <Button variant="ghost" size="sm" onClick={clearAll} className="h-8 text-xs text-gray-500 hover:text-red-600">
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                Clear
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={savePreset}
                className="h-8 border-emerald-200 bg-emerald-50 text-xs text-emerald-700 hover:bg-emerald-100"
              >
                <Save className="mr-1 h-3.5 w-3.5" />
                Save Preset
              </Button>
            </>
          )}
          {hasSavedPreset && rules.length === 0 && (
             <Button variant="ghost" size="sm" onClick={clearPreset} className="h-8 text-xs text-gray-400">
             Clear Saved
           </Button>
          )}
          <Button variant="default" size="sm" onClick={addRule} className="h-8 text-xs">
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Rule
          </Button>
        </div>
      </div>

      {(isOpen || rules.length > 0) && rules.length > 0 && (
        <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
          {rules.map((rule) => {
            const fieldDef = fields.find((f) => f.key === rule.field);

            return (
              <div key={rule.id} className="flex items-center gap-2">
                {/* Field Selector */}
                <select
                  value={rule.field}
                  onChange={(e) => updateRule(rule.id, "field", e.target.value)}
                  className="h-9 w-[180px] rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500"
                >
                  {fields.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>

                {/* Operator Selector */}
                <select
                  value={rule.operator}
                  onChange={(e) => updateRule(rule.id, "operator", e.target.value)}
                  className="h-9 w-[130px] rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500"
                >
                  <option value="equals">Equals</option>
                  <option value="not_equals">Not Equals</option>
                  {fieldDef?.type === "text" && <option value="contains">Contains</option>}
                </select>

                {/* Value Input */}
                {fieldDef?.type === "select" || fieldDef?.type === "boolean" ? (
                  <select
                    value={rule.value}
                    onChange={(e) => updateRule(rule.id, "value", e.target.value)}
                    className="h-9 flex-1 rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500"
                  >
                    <option value="" disabled>Select a value...</option>
                    {fieldDef.type === "boolean" ? (
                      <>
                        <option value="true">Yes / True</option>
                        <option value="false">No / False</option>
                      </>
                    ) : (
                      fieldDef.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))
                    )}
                  </select>
                ) : (
                  <Input
                    placeholder="Enter value..."
                    value={rule.value}
                    onChange={(e) => updateRule(rule.id, "value", e.target.value)}
                    className="h-9 flex-1"
                  />
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRule(rule.id)}
                  className="h-9 w-9 text-gray-400 hover:text-red-500"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
