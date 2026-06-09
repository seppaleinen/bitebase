"use client";

import { useState } from "react";
import { Loader2, Save, Plus, CheckCircle, AlertCircle, Info } from "lucide-react";
import { trpcReact } from "@/lib/trpc/provider";

// ── Toast ───────────────────────────────────────────────────────────────────────

type Toast = { id: number; message: string; type: "success" | "error" };
let nextToastId = 0;

function ToastBar({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg px-4 py-3 shadow-lg transition-all ${
        toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
      }`}
      role="status"
      aria-live="polite"
    >
      {toast.type === "success" ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
      <span className="text-sm font-medium">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="ml-2 rounded p-0.5 hover:bg-white/20"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}

// ── Model card ────────────────────────────────────────────────────────────────────

function ModelCard({
  modelKey,
  initialJson,
  onSave,
  isSaving,
  lastUpdated,
}: {
  modelKey: string;
  initialJson: string;
  onSave: (json: string) => void;
  isSaving: boolean;
  lastUpdated?: string | null;
}) {
  const [text, setText] = useState(initialJson);
  const [parseError, setParseError] = useState<string | null>(null);

  const isDirty = text !== initialJson;

  // Validate JSON on every change.
  const handleChange = (val: string) => {
    setText(val);
    try {
      JSON.parse(val);
      setParseError(null);
    } catch {
      setParseError("Invalid JSON");
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
        <h3 className="text-sm font-semibold text-gray-900">{modelKey}</h3>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-gray-400">Updated {lastUpdated}</span>
          )}
          <button
            onClick={() => onSave(text)}
            disabled={!isDirty || !!parseError || isSaving}
            className="flex items-center gap-1 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Save className="h-3 w-3" />
            )}
            Save
          </button>
        </div>
      </div>
      <div className="p-5">
        <div className="relative">
          <textarea
            value={text}
            onChange={(e) => handleChange(e.target.value)}
            rows={8}
            spellCheck={false}
            className={`w-full rounded-md border bg-gray-50 px-3 py-2 font-mono text-xs leading-relaxed shadow-sm focus:outline-none focus:ring-1 ${
              parseError
                ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                : "border-gray-300 focus:border-violet-500 focus:ring-violet-500"
            }`}
          />
          {parseError && (
            <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
              <AlertCircle className="h-3 w-3" />
              {parseError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────────

export default function ModelSettingsPage() {
  const { data, isLoading, refetch } = trpcReact.admin.modelSettings.list.useQuery();
  const updateMut = trpcReact.admin.modelSettings.update.useMutation({
    onSuccess: () => {
      addToast("Settings saved", "success");
      refetch().then(() => setFormKey((k) => k + 1));
    },
    onError: (err) => {
      addToast(err.message || "Save failed", "error");
    },
  });

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [newKey, setNewKey] = useState("");
  const [formKey, setFormKey] = useState(0);

  const addToast = (message: string, type: "success" | "error") => {
    const id = nextToastId++;
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const dismissToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleUpdateModel = (modelKey: string, config: string) => {
    updateMut.mutate({ modelKey, config });
  };

  const handleAddModel = () => {
    const key = newKey.trim();
    if (!key) return;
    // Pre-populate with an empty config object.
    handleUpdateModel(key, "{}");
    setNewKey("");
  };

  const models = data?.models ?? [];

  return (
    <div>
      {/* ── Description ─────────────────────────────────────── */}
      <div className="mb-6 flex items-start gap-2 rounded-lg bg-violet-50 p-4 text-sm text-violet-700">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Configure model parameters per model key. The active model is resolved from{" "}
          <code className="rounded bg-violet-100 px-1 py-0.5 text-xs">OLLAMA_MODEL</code>{" "}
          (or <code className="rounded bg-violet-100 px-1 py-0.5 text-xs">llama3.2</code> by default).
          Entries here override env vars (<code className="rounded bg-violet-100 px-1 py-0.5 text-xs">OLLAMA_TEMPERATURE</code>{" "}
          etc.) and code defaults. A <code className="rounded bg-violet-100 px-1 py-0.5 text-xs">default</code> key acts as a
          catch-all when no exact match exists.
        </p>
      </div>

      {/* ── Loading ─────────────────────────────────────────── */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
        </div>
      )}

      {/* ── Model cards ─────────────────────────────────────── */}
      {!isLoading && (
        <div key={formKey} className="space-y-4">
          {models.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-400">
              No model configs yet. Add one below.
            </p>
          )}

          {models.map((m) => (
            <ModelCard
              key={m.modelKey}
              modelKey={m.modelKey}
              initialJson={JSON.stringify(m.config, null, 2)}
              onSave={(json) => handleUpdateModel(m.modelKey, json)}
              isSaving={updateMut.isPending}
              lastUpdated={
                m.updatedAt
                  ? new Date(m.updatedAt).toLocaleString(undefined, {
                      dateStyle: "short",
                      timeStyle: "short",
                    })
                  : null
              }
            />
          ))}

          {/* ── Add model ──────────────────────────────────── */}
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-3">
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddModel()}
              placeholder="Add model key…"
              className="min-w-0 flex-1 border-none bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
            />
            <button
              onClick={handleAddModel}
              disabled={!newKey.trim()}
              className="flex items-center gap-1 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              <Plus className="h-3 w-3" />
              Add
            </button>
          </div>
        </div>
      )}

      {/* ── Toasts ──────────────────────────────────────────── */}
      {toasts.map((t) => (
        <ToastBar key={t.id} toast={t} onDismiss={dismissToast} />
      ))}
    </div>
  );
}
