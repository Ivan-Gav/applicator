import type { DocumentType } from "@/domain/document/model";
import { cn } from "@/lib/utils";
import { messages } from "@/ui/messages";
import styles from "./TypeTag.module.css";

/** A document's type, in the shape of the status tag; static, not a control. */
export function TypeTag({ type, compact = false }: { type: DocumentType; compact?: boolean }) {
  return (
    <span data-type={type} className={cn(styles.tag, compact && styles.compact)}>
      {messages.documents.type[type]}
    </span>
  );
}

/** A colour square standing for a type, as in its filter chip; decorative. */
export function TypeSwatch({ type }: { type: DocumentType }) {
  return <span aria-hidden data-type={type} className={styles.swatch} />;
}
