// Small popup for entering/editing the Gemini API key. The key is
// entered as a password-style input so it always renders as dots --
// no reveal/eye toggle, ever. The actual saved key is never fetched
// or shown here -- but the placeholder now reflects whether a key is
// already saved, so the box doesn't look empty/unset when it isn't.

import { useEffect, useState } from "react";
import { hasApiKey, setApiKey } from "../lib/tauri";

interface ApiKeyModalProps {
  onClose: () => void;
}

export function ApiKeyModal({ onClose }: ApiKeyModalProps) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placeholder, setPlaceholder] = useState("Enter API key");

  useEffect(() => {
    hasApiKey()
      .then((exists) => {
        if (exists) setPlaceholder("Key saved — enter a new key to replace it");
      })
      .catch(() => {});
  }, []);

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
          placeholder={placeholder}
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