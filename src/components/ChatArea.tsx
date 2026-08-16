// Scrollable message list with a custom scrollbar (spec sections
// 38-40): dynamic thumb size based on content amount, smooth wheel
// scrolling, fast draggable thumb, both controlling the same scroll
// position. Hosts MessageInput at the bottom, kept separate from the
// scrolling region.

import { useEffect, useRef, useState } from "react";
import { Message } from "./Message";
import { MessageInput } from "./MessageInput";
import type { Message as MessageType, Attachment } from "../lib/types";

interface ChatAreaProps {
  messages: MessageType[];
  onSend: (text: string, attachments: Attachment[]) => void;
  sending: boolean;
}

export function ChatArea({ messages, onSend, sending }: ChatAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [thumbHeight, setThumbHeight] = useState(0);
  const [thumbTop, setThumbTop] = useState(0);
  const draggingRef = useRef(false);

  // Keep the thumb geometry in sync with content/scroll position.
  function updateThumb() {
    const el = scrollRef.current;
    const track = trackRef.current;
    if (!el || !track) return;

    const { scrollHeight, clientHeight, scrollTop } = el;
    if (scrollHeight <= clientHeight) {
      setThumbHeight(0); // nothing to scroll -- hide thumb
      return;
    }

    const trackHeight = track.clientHeight;
    const ratio = clientHeight / scrollHeight;
    const height = Math.max(ratio * trackHeight, 24); // min thumb size
    const maxTop = trackHeight - height;
    const scrollRatio = scrollTop / (scrollHeight - clientHeight);

    setThumbHeight(height);
    setThumbTop(scrollRatio * maxTop);
  }

  useEffect(() => {
    updateThumb();
  }, [messages]);

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

// On a new user message, bring it to the TOP of the visible area.
  // On a new AI reply, reveal it (scroll to bottom). Only fires once
  // per new message -- never continuously forces scroll, so manual
  // scrolling stays free at all other times.
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
            <Message key={m.id} message={m} />
          ))}
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

      <MessageInput onSend={onSend} disabled={sending} />
    </div>
  );
}