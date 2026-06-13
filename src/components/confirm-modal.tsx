// 앱 공용 확인/입력 모달. 모바일 프레임(max-w-480) 안 중앙 정렬.
import { useEffect, useState } from "react";

const OVERLAY =
  "fixed inset-y-0 left-1/2 z-50 flex w-full max-w-[480px] -translate-x-1/2 items-center justify-center bg-foreground/40 px-6 backdrop-blur-sm";
const CARD = "w-full rounded-[1.5rem] border border-white/60 bg-card p-5 shadow-2xl";

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "확인",
  cancelLabel = "닫기",
  destructive = false,
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className={OVERLAY} onClick={() => !busy && onClose()}>
      <div className={CARD} onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-lg font-extrabold">{title}</h2>
        {description && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>}
        <div className="mt-4 flex gap-2">
          <button onClick={onClose} disabled={busy} className="flex-1 rounded-full border border-border py-3 text-sm font-semibold">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`flex-1 rounded-full py-3 text-sm font-semibold disabled:opacity-50 ${destructive ? "bg-destructive text-destructive-foreground" : "bg-foreground text-background"}`}
          >
            {busy ? "처리 중…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PromptModal({
  open,
  title,
  description,
  placeholder,
  confirmLabel = "확인",
  maxLength = 1000,
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  placeholder?: string;
  confirmLabel?: string;
  maxLength?: number;
  busy?: boolean;
  onConfirm: (value: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState("");
  useEffect(() => {
    if (open) setValue("");
  }, [open]);
  if (!open) return null;
  return (
    <div className={OVERLAY} onClick={() => !busy && onClose()}>
      <div className={CARD} onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-lg font-extrabold">{title}</h2>
        {description && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>}
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={maxLength}
          placeholder={placeholder}
          rows={3}
          className="mt-3 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm"
        />
        <div className="mt-3 flex gap-2">
          <button onClick={onClose} disabled={busy} className="flex-1 rounded-full border border-border py-3 text-sm font-semibold">
            닫기
          </button>
          <button
            onClick={() => onConfirm(value.trim())}
            disabled={busy || value.trim().length === 0}
            className="flex-1 rounded-full bg-destructive py-3 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
          >
            {busy ? "처리 중…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
