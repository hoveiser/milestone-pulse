import React, { useState } from "react";
import { MARKET_TEMPLATES } from "../lib/config";

export default function CreateMarketModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({
    project_name: "",
    milestone_commitment: "",
    official_proof_url: "",
    mandatory_deliverable_token: "",
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const valid =
    form.project_name.trim().length >= 1 &&
    form.project_name.length <= 80 &&
    form.milestone_commitment.trim().length >= 1 &&
    form.milestone_commitment.length <= 1000 &&
    /^https?:\/\//i.test(form.official_proof_url) &&
    form.official_proof_url.length >= 8 &&
    form.mandatory_deliverable_token.trim().length >= 1;

  const submit = () => {
    if (!valid) return;
    onSubmit([
      form.project_name.trim(),
      form.milestone_commitment.trim(),
      form.official_proof_url.trim(),
      form.mandatory_deliverable_token.trim(),
    ]);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="glass w-full max-w-lg rounded-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 text-lg font-semibold">Create Milestone Market</h3>
        <p className="mb-4 text-xs text-slate-400">
          Publish a roadmap commitment and the official proof URL that validators will fetch.
        </p>

        <div className="mb-3 flex flex-wrap gap-2">
          {MARKET_TEMPLATES.map((t, i) => (
            <button
              key={i}
              onClick={() => setForm(t)}
              className="rounded-lg border border-edge bg-panel px-2.5 py-1 text-[11px] text-slate-300 hover:border-pulse/50"
            >
              {t.project_name}
            </button>
          ))}
        </div>

        <Field label="Project name" value={form.project_name} onChange={set("project_name")} />
        <Field
          label="Milestone commitment"
          textarea
          value={form.milestone_commitment}
          onChange={set("milestone_commitment")}
        />
        <Field label="Official proof URL" value={form.official_proof_url} onChange={set("official_proof_url")} />
        <Field
          label="Mandatory deliverable token"
          value={form.mandatory_deliverable_token}
          onChange={set("mandatory_deliverable_token")}
        />

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-edge px-3 py-1.5 text-sm">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!valid}
            className="rounded-lg bg-pulse px-3 py-1.5 text-sm font-medium text-ink disabled:opacity-40"
          >
            Deploy market
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, textarea }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs text-slate-400">{label}</span>
      {textarea ? (
        <textarea
          rows={3}
          value={value}
          onChange={onChange}
          className="w-full rounded-lg border border-edge bg-ink px-3 py-2 text-sm outline-none focus:border-pulse/60"
        />
      ) : (
        <input
          value={value}
          onChange={onChange}
          className="w-full rounded-lg border border-edge bg-ink px-3 py-2 text-sm outline-none focus:border-pulse/60"
        />
      )}
    </label>
  );
}
