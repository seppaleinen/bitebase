"use client";

import { useState, useCallback } from "react";
import { Loader2, Save, Thermometer, Hash, Gauge, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { trpcReact } from "@/lib/trpc/provider";

// ── Helpers ────────────────────────────────────────────────────────────────────

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
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  );
}

// ── Field component ─────────────────────────────────────────────────────────────

function ConfigField({
  label,
  icon: Icon,
  value,
  effective,
  placeholder,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  icon: typeof Thermometer;
  value: string;
  effective: string | null;
  placeholder: string;
  min: number;
  max: number;
  step: number;
  onChange: (val: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
        <Icon className="h-4 w-4 text-violet-500" />
        {label}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
      />
      {effective !== null && (
        <p className="text-xs text-gray-400">
          Effective: <span className="font-medium text-gray-600">{effective}</span>
          {value === "" && " (env / code default)"}
        </p>
      )}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────────

export default function AdminModelSettingsPage() {
  const { data, isLoading } = trpcReact.admin.modelSettings.get.useQuery();

  // Controlled form fields — initialized from query data.
  const [temperature, setTemperature] = useState(() => {
    if (!data?.temperature) return "";
    return String(data.temperature);
  });
  const [maxTokens, setMaxTokens] = useState(() => {
    if (!data?.maxTokens) return "";
    return String(data.maxTokens);
  });
  const [topP, setTopP] = useState(() => {
    if (!data?.topP) return "";
    return String(data.topP);
  });

  // Track when form fields diverge from the current query data.
  const hasUnsavedChanges = (() => {
    if (!data) return false;
    const orig = (v: number | null | undefined) => (v != null ? String(v) : "");
    return (
      temperature !== orig(data.temperature) ||
      maxTokens !== orig(data.maxTokens) ||
      topP !== orig(data.topP)
    );
  })();

  const [toasts, setToasts] = useState<Toast[]>([]);
  // Key that increments after successful save — forces form fields to re-initialize from query data.
  const [resetKey, setResetKey] = useState(0);

  const addToast = useCallback((message: string, type: "success" | "error") => {
    const id = nextToastId++;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, [setToasts]);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, [setToasts]);

  const updateMut = trpcReact.admin.modelSettings.update.useMutation({
    onSuccess: () => {
      addToast("Settings saved", "success");
      // Force form fields to re-initialize from the refetched query data.
      setResetKey((k) => k + 1);
    },
    onError: (err) => {
      addToast(err.message || "Save failed", "error");
    },
  });

  const handleSave = async () => {
    await updateMut.mutateAsync({
      temperature: temperature === "" ? null : parseFloat(temperature),
      maxTokens: maxTokens === "" ? null : parseInt(maxTokens, 10),
      topP: topP === "" ? null : parseFloat(topP),
    });
  };

  return (
    <div className="p-6">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Link
            href="/admin/lessons"
            className="mb-2 inline-flex items-center gap-1 text-sm text-violet-600 hover:text-violet-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to curricula
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Model Settings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Override model parameters at runtime. Leave a field empty to use the env
            var or code default.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={!hasUnsavedChanges || updateMut.isPending}
          className="flex items-center gap-1.5 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {updateMut.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save
            </>
          )}
        </button>
      </div>

      {/* ── Loading ─────────────────────────────────────────── */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
        </div>
      )}

      {/* ── Form ────────────────────────────────────────────── */}
      {!isLoading && data && (
        <div key={resetKey} className="max-w-lg space-y-6">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <ConfigField
              label="Temperature"
              icon={Thermometer}
              value={temperature}
              effective={data.effectiveTemperature != null ? String(data.effectiveTemperature) : null}
              placeholder="0.7"
              min={0}
              max={2}
              step={0.05}
              onChange={setTemperature}
            />
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <ConfigField
              label="Max Tokens"
              icon={Hash}
              value={maxTokens}
              effective={data.effectiveMaxTokens != null ? String(data.effectiveMaxTokens) : "unset"}
              placeholder="(no limit)"
              min={1}
              max={999999}
              step={1}
              onChange={setMaxTokens}
            />
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <ConfigField
              label="Top P"
              icon={Gauge}
              value={topP}
              effective={data.effectiveTopP != null ? String(data.effectiveTopP) : "unset"}
              placeholder="(model default)"
              min={0}
              max={1}
              step={0.05}
              onChange={setTopP}
            />
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
