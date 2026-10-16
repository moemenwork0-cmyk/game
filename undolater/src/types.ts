export type UndoItem = {
  id: string;
  /** What was changed, e.g. "Moved the sofa to the window". */
  title: string;
  /** Optional hint on how to put it back. */
  note?: string;
  /** Local file URI of a "before" photo. */
  photoUri?: string;
  createdAt: number;
  /** When to be reminded (ms since epoch). */
  remindAt?: number;
  /** Ids of the scheduled reminder and follow-up notifications, so they can be cancelled. */
  notificationIds?: string[];
  /** Pre-1.1 single notification id. */
  notificationId?: string;
  /** Set once the change has been undone; the item then lives in History. */
  restoredAt?: number;
};

export type Draft = Pick<UndoItem, 'title' | 'note' | 'photoUri' | 'remindAt'>;
