export type TouchPoint = { x: number; y: number };

export function shouldCancelTwoFingerPreview(
  starts: TouchPoint[],
  touches: TouchPoint[],
  slop = 12,
) {
  return (
    starts.length !== 2 ||
    touches.length !== 2 ||
    touches.some((touch, index) => {
      const start = starts[index];
      return !start || Math.hypot(touch.x - start.x, touch.y - start.y) > slop;
    })
  );
}
