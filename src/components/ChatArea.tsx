import { useEffect, useRef, useState } from "react";
import { MessageBubble } from "./Message";
import { MessageInput } from "./MessageInput";
import type { Attachment, Message } from "../lib/types";

interface ChatAreaProps {
  messages: Message[];
  onSend: (text: string, attachments: Attachment[]) => void;
  sending: boolean;
  onPause: () => void;
  latestUserId?: string;
  latestAiId?: string;
  onLike: (id: string) => void;
  onDislike: (id: string) => void;
  onRetry: (id: string) => void;
  onSaveEdit: (id: string, newText: string) => void;
}

function TypingDots() {
  return (
    <div className="typing-dots">
      <span />
      <span />
      <span />
    </div>
  );
}

export function ChatArea({
  messages,
  onSend,
  sending,
  onPause,
  latestUserId,
  latestAiId,
  onLike,
  onDislike,
  onRetry,
  onSaveEdit,
}: ChatAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [thumbHeight, setThumbHeight] = useState(0);
  const [thumbTop, setThumbTop] = useState(0);
  const draggingRef = useRef(false);

  const showTyping = sending && (messages.length === 0 || messages[messages.length - 1].role === "user");

  function updateThumb() {
    const el = scrollRef.current;
    const track = trackRef.current;
    if (!el || !track) return;

    const { scrollHeight, clientHeight, scrollTop } = el;
    if (scrollHeight <= clientHeight) {
      setThumbHeight(0);
      return;
    }

    const trackHeight = track.clientHeight;
    const ratio = clientHeight / scrollHeight;
    const height = Math.max(ratio * trackHeight, 24);
    const maxTop = trackHeight - height;
    const scrollRatio = scrollTop / (scrollHeight - clientHeight);

    setThumbHeight(height);
    setThumbTop(scrollRatio * maxTop);
  }

  useEffect(() => {
    updateThumb();
  }, [messages, showTyping]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => updateThumb();
    el.addEventListener("scroll", onScroll);
    window.addEventListener("resize", updateThumb);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateThumb);
    };
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || messages.length === 0) return;
    const lastMessage = messages[messages.length - 1];
    const lastEl = el.lastElementChild as HTMLElement | null;
    if (!lastEl) return;

    if (lastMessage.role === "user") {
      el.scrollTop = lastEl.offsetTop - 12;
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  function handleThumbMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    draggingRef.current = true;

    const startY = e.clientY;
    const startTop = thumbTop;
    const el = scrollRef.current;
    const track = trackRef.current;
    if (!el || !track) return;

    const trackHeight = track.clientHeight;
    const { scrollHeight, clientHeight } = el;
    const maxTop = trackHeight - thumbHeight;

    function onMouseMove(moveEvent: MouseEvent) {
      if (!draggingRef.current) return;
      const delta = moveEvent.clientY - startY;
      const newTop = Math.min(Math.max(startTop + delta, 0), maxTop);
      const scrollRatio = maxTop > 0 ? newTop / maxTop : 0;
      el!.scrollTop = scrollRatio * (scrollHeight - clientHeight);
    }

    function onMouseUp() {
      draggingRef.current = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  return (
    <div className="chat-area">
      <div className="chat-scroll-wrapper">
        <div className="chat-messages" ref={scrollRef}>
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              isLatestUserMessage={m.id === latestUserId}
              isLatestAiMessage={m.id === latestAiId}
              onLike={() => onLike(m.id)}
              onDislike={() => onDislike(m.id)}
              onRetry={() => onRetry(m.id)}
              onSaveEdit={(newText) => onSaveEdit(m.id, newText)}
            />
          ))}
          {showTyping && (
            <div className="message-row message-row-assistant">
              <TypingDots />
            </div>
          )}
        </div>

        <div className="chat-scrollbar-track" ref={trackRef}>
          {thumbHeight > 0 && (
            <div
              className="chat-scrollbar-thumb"
              style={{ height: thumbHeight, top: thumbTop }}
              onMouseDown={handleThumbMouseDown}
            />
          )}
        </div>
      </div>

      <MessageInput onSend={onSend} sending={sending} onPause={onPause} />
    </div>
  );
}