"use client";

import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel} width="md">
      <div className="flex gap-3">
        <span className="rounded-full bg-[var(--status-critical-soft)] text-[var(--status-critical)] p-2 h-fit shrink-0">
          <AlertTriangle size={18} />
        </span>
        <p className="text-sm text-[var(--text-secondary)]">{message}</p>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          className="!bg-[var(--status-critical)] !text-white hover:!bg-[#b52f2f] !border-transparent"
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
