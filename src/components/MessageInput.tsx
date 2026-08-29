import { useRef, useState } from "react";
import { Pause, Plus, Send, X } from "lucide-react";
import type { Attachment } from "../lib/types";

const MAX_ATTACHMENTS = 20;

interface MessageInputProps {
  onSend: (text: string, attachments: Attachment[]) => void;
  disabled: boolean;
  sending: boolean;
  onStop: () => void;
}

export function MessageInput({ onSend, disabled, sending, onStop }: MessageInputProps) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleAttachClick() {
    fileInputRef.current?.click();
  }

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    setAttachError(null);

    const room = MAX_ATTACHMENTS - attachments.length;
    if (room <= 0) {
      setAttachError("Maximum of 20 attachments per prompt.");
      e.target.value = "";
      return;
    }

    const newAttachments: Attachment[] = [];
    for (const file of Array.from(files).slice(0, room)) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const kind = ext === "txt" ? "txt" : ext === "md" ? "md" : null;
      if (!kind) {
        setAttachError("Only .txt and .md files are supported.");
        continue;
      }
      const content = await file.text();
      newAttachments.push({ name: file.name, kind, content });
    }

    setAttachments((prev) => [...prev, ...newAttachments]);
    e.target.value = "";
  }

  function removeAttachment(name: string) {
    setAttachments((prev) => prev.filter((a) => a.name !== name));
  }

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;
    if (sending) return;

    onSend(trimmed, attachments);
    setText("");
    setAttachments([]);
    setAttachError(null);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="message-input-container">
      {attachments.length > 0 && (
        <div className="attachment-chip-row">
          {attachments.map((a) => (
            <div className="attachment-chip" key={a.name} title={a.name}>
              <span className="attachment-chip-name">{a.name}</span>
              <button className="attachment-chip-remove" onClick={() => removeAttachment(a.name)} aria-label={`Remove ${a.name}`}>
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {attachError && <p className="attach-error">{attachError}</p>}

      <div className="message-input-row">
        <button
          className="icon-button"
          onClick={handleAttachClick}
          aria-label="Attach file"
          disabled={disabled || attachments.length >= MAX_ATTACHMENTS}
        >
          <Plus size={18} />
        </button>
        <input ref={fileInputRef} type="file" accept=".txt,.md" multiple hidden onChange={handleFilesSelected} />

        <textarea
          className="message-input-textarea"
          placeholder="Message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={disabled}
        />

        {sending ? (
          <button className="icon-button icon-button-send" onClick={onStop} aria-label="Stop generating">
            <Pause size={18} />
          </button>
        ) : (
          <button className="icon-button icon-button-send" onClick={handleSend} aria-label="Send">
            <Send size={18} />
          </button>
        )}
      </div>
    </div>
  );
}