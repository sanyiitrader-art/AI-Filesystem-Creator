// Small popup for entering/editing the Gemini API key (spec: "Edit
// API" button opens this). The key is entered as a password-style
// input so it always renders as dots -- no reveal/eye toggle, ever,
// even for an already-saved key. The input starts empty every time
// the modal opens: typing overwrites the saved key on Save, leaving
// it blank and closing keeps whatever was already saved.

import { useState } from "react";
import { setApiKey } from "../lib/tauri";

interface ApiKeyModalProps {
  onClose: () => void;
}

export function ApiKeyModal({ onClose }: ApiKeyModalProps) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const trimmed = value.trim();
    if (!trimmed) {
      onClose();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await setApiKey(trimmed);
      onClose();
    } catch {
      setError("Couldn't save the key. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Gemini API Key</h2>
        <p className="modal-subtitle">
          Used only to connect to Google AI Studio's Gemini 3.5 Flash.
        </p>

        <input
          type="password"
          className="modal-input"
          placeholder="Enter API key"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          autoComplete="off"
          spellCheck={false}
        />

        {error && <p className="modal-error">{error}</p>}

        <div className="modal-actions">
          <button className="modal-button-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="modal-button-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}