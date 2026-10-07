import type { ApplicationStatus } from "@/domain/application/model";
import styles from "./StatusTag.module.css";

/** The colour square of a status. Decorative: the status is always named beside it. */
export function StatusSwatch({ status }: { status: ApplicationStatus }) {
  return <span aria-hidden data-status={status} className={styles.swatch} />;
}
