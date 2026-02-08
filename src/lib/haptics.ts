// ---------------------------------------------------------------------------
//  Scotland Yard – Haptic Feedback (navigator.vibrate, graceful degradation)
// ---------------------------------------------------------------------------

function vibrate(pattern: number | number[]): void {
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Silently ignore – not all browsers support it
    }
  }
}

export const haptics = {
  /** Light tap – button press */
  tap: () => vibrate(10),

  /** Medium – selecting transport ticket */
  select: () => vibrate(30),

  /** Confirm a move */
  confirm: () => vibrate(50),

  /** Error / invalid input */
  error: () => vibrate([50, 30, 50]),

  /** Mr. X reveal round */
  reveal: () => vibrate([30, 20, 30, 20, 80]),

  /** Capture! */
  capture: () => vibrate([100, 50, 100, 50, 200]),

  /** Turn notification */
  turnNotify: () => vibrate([80, 40, 80]),

  /** Round locked */
  lock: () => vibrate(60),
};
