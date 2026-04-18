"use client";

import type { Dispatch } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { SchemaField, WizardAction } from "@/hooks/useAgentWizard";

let _fid = 0;
function nextFid() {
  return `f-${++_fid}-${Date.now()}`;
}

export function SchemaFieldBuilder({
  fields,
  dispatch,
}: {
  fields: SchemaField[];
  dispatch: Dispatch<WizardAction>;
}) {
  return (
    <div className="space-y-4">
      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
        Define the fields every JSON response must include. Use stable, descriptive names.
      </p>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Schema fields ({fields.length})
        </p>
        <button
          type="button"
          onClick={() =>
            dispatch({
              type: "ADD_SCHEMA_FIELD",
              field: {
                id: nextFid(),
                name: "",
                type: "string",
                required: true,
                description: "",
              },
            })
          }
          className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          <Plus className="h-3 w-3" />
          Add field
        </button>
      </div>

      {fields.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          No fields defined. Add at least one (e.g. `summary`, `next_steps`) to define the response shape.
        </p>
      ) : null}

      {fields.map((field) => (
        <div
          key={field.id}
          className="grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900 sm:grid-cols-[1fr_120px_auto_auto]"
        >
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Name</label>
            <input
              type="text"
              value={field.name}
              onChange={(e) =>
                dispatch({
                  type: "UPDATE_SCHEMA_FIELD",
                  id: field.id,
                  patch: { name: e.target.value },
                })
              }
              placeholder="field_name"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Type</label>
            <select
              value={field.type}
              onChange={(e) =>
                dispatch({
                  type: "UPDATE_SCHEMA_FIELD",
                  id: field.id,
                  patch: { type: e.target.value as SchemaField["type"] },
                })
              }
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <option value="string">String</option>
              <option value="number">Number</option>
              <option value="boolean">Boolean</option>
              <option value="array">Array</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={field.required}
                onChange={(e) =>
                  dispatch({
                    type: "UPDATE_SCHEMA_FIELD",
                    id: field.id,
                    patch: { required: e.target.checked },
                  })
                }
                className="h-4 w-4 rounded border-zinc-300 accent-violet-600"
              />
              Required
            </label>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => dispatch({ type: "REMOVE_SCHEMA_FIELD", id: field.id })}
              className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-200 hover:text-red-600 dark:hover:bg-zinc-700 dark:hover:text-red-400"
              aria-label="Remove field"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <div className="sm:col-span-4">
            <input
              type="text"
              value={field.description}
              onChange={(e) =>
                dispatch({
                  type: "UPDATE_SCHEMA_FIELD",
                  id: field.id,
                  patch: { description: e.target.value },
                })
              }
              placeholder="Description (optional)"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
