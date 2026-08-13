// Message input row: text input, attach (+) button restricted to
// .txt/.md (spec section 30), and send button (section 31).

import { useRef, useState } from "react";
import { Plus, Send, X } from "lucide-react";
import type { Attachment, AttachmentKind } from "../lib/types";

interface MessageInputProps {
  onSend: (text: string, attachments: Attachment[]) => void;
  disabled: boolean;
}

const ALLOWED_EXTENSIONS: Record<string, AttachmentKind> = {
  txt: "txt",
  md: "md",
};

export function MessageInput({ onSend, disabled }: MessageInputProps) {
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

    const newAttachments: Attachment[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const kind = ALLOWED_EXTENSIONS[ext];
      if (!kind) {
        setAttachError("Only .txt and .md files are supported.");
        continue;
      }
      const content = await file.text();
      newAttachments.push({ name: file.name, kind, content });
    }

    setAttachments((prev) => [...prev, ...newAttachments]);
    e.target.value = ""; // allow re-selecting the same file later
  }

  function removeAttachment(name: string) {
    setAttachments((prev) => prev.filter((a) => a.name !== name));
  }

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;
    if (disabled) return;

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
            <div className="attachment-chip" key={a.name}>
              <span>{a.name}</span>
              <button
                className="attachment-chip-remove"
                onClick={() => removeAttachment(a.name)}
                aria-label={`Remove ${a.name}`}
              >
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
          disabled={disabled}
        >
          <Plus size={18} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md"
          multiple
          hidden
          onChange={handleFilesSelected}
        />

        <textarea
          className="message-input-textarea"
          placeholder="Message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={disabled}
        />

        <button
          className="icon-button icon-button-send"
          onClick={handleSend}
          aria-label="Send"
          disabled={disabled}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}