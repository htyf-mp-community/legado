import type { Rect } from './capsule';

/** Place only this popup around a real overlapping capsule, in SDK logical window points. */
export function readRecordMenuFrame(
  window: { width: number; height: number },
  headerBottom: number,
  bottomInset: number,
  capsule: Rect | null,
  contentHeight = 0,
) {
  let top = headerBottom,
    rightEdge = window.width - 8;
  const width = Math.min(260, Math.max(44, window.width - 16));
  const valid =
    capsule &&
    [capsule.left, capsule.top, capsule.right, capsule.bottom].every(
      Number.isFinite,
    ) &&
    capsule.right > capsule.left &&
    capsule.bottom > capsule.top;
  if (valid && capsule && contentHeight > 0) {
    const blocked = {
      left: capsule.left - 10,
      right: capsule.right + 10,
      top: capsule.top - 10,
      bottom: capsule.bottom + 10,
    };
    if (
      rightEdge - width < blocked.right &&
      rightEdge > blocked.left &&
      top < blocked.bottom &&
      top +
        Math.min(
          contentHeight,
          Math.max(0, window.height - top - bottomInset - 8),
        ) >
        blocked.top
    ) {
      if (blocked.left - width >= 8) rightEdge = blocked.left;
      else top = blocked.bottom;
    }
  }
  return {
    top,
    right: window.width - rightEdge,
    width,
    maxHeight: Math.max(44, window.height - top - bottomInset - 8),
  };
}
