import { rightBoundaryForElement, type Rect } from '../layout/capsule';

export type ReaderSafeInsets = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export function readerSafeLayout(
  insets: ReaderSafeInsets,
  capsule: Rect | null,
  width: number,
) {
  const top = Math.max(0, insets.top),
    bottom = Math.max(0, insets.bottom),
    left = Math.max(0, insets.left),
    right = Math.max(0, insets.right),
    availableRight = Math.max(left, width - right),
    topRight = Math.max(
      left,
      rightBoundaryForElement(
        { top, bottom: top + 60 },
        capsule,
        availableRight,
      ),
    );
  return {
    top,
    bottom,
    left,
    right,
    topRight,
    progressBottom: bottom + 84,
    infoTop: top + 4,
    infoBottom: bottom + 4,
    infoBottomWithControls: bottom + 144,
    hintTop: top + 72,
  };
}
