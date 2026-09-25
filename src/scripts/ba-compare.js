// Before/after compare. Pointer Events cover mouse, touch, and pen with one
// code path. The root has `touch-action: pan-y`, so a vertical swipe still
// scrolls the page on phones: the browser sends pointercancel as soon as the
// gesture becomes a scroll, which ends the drag. The handle is a focusable
// role="slider" for keyboard users (arrows move 5%, Shift+arrows 25%,
// Home/End jump to either side).
function initCompare(root) {
  const after = root.querySelector(".ba-compare__after");
  const handle = root.querySelector(".ba-compare__handle");
  if (!after || !handle) return;

  let pos = 50;
  const setPos = (p) => {
    pos = Math.max(0, Math.min(100, p));
    after.style.clipPath = `inset(0 0 0 ${pos}%)`;
    handle.style.left = `${pos}%`;
    handle.setAttribute("aria-valuenow", String(Math.round(pos)));
  };
  const setFromX = (clientX) => {
    const r = root.getBoundingClientRect();
    setPos(((clientX - r.left) / r.width) * 100);
  };

  // Where a finger landed, until the gesture reads as sideways (or a tap)
  let touchStart = null;
  const TAP_SLOP = 6; // px of movement still treated as a tap / undecided

  root.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    root.setPointerCapture(e.pointerId);
    // A mouse press jumps the divider; a finger waits to see if it's a swipe
    if (e.pointerType === "mouse") setFromX(e.clientX);
    else touchStart = { x: e.clientX, y: e.clientY };
  });
  root.addEventListener("pointermove", (e) => {
    if (!root.hasPointerCapture(e.pointerId)) return;
    if (touchStart) {
      const dx = Math.abs(e.clientX - touchStart.x);
      const dy = Math.abs(e.clientY - touchStart.y);
      // Not clearly sideways yet: leave the divider alone so a vertical
      // swipe just scrolls the page
      if (dx < TAP_SLOP || dx < dy) return;
      touchStart = null;
    }
    setFromX(e.clientX);
  });
  root.addEventListener("pointerup", (e) => {
    // A tap moves the divider to where the finger touched
    if (
      touchStart &&
      Math.hypot(e.clientX - touchStart.x, e.clientY - touchStart.y) < TAP_SLOP
    )
      setFromX(e.clientX);
    touchStart = null;
  });
  root.addEventListener("pointercancel", () => {
    touchStart = null;
  });
  // Pointer capture is released automatically on pointerup and pointercancel

  handle.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 25 : 5;
    const next = {
      ArrowLeft: pos - step,
      ArrowDown: pos - step,
      ArrowRight: pos + step,
      ArrowUp: pos + step,
      Home: 0,
      End: 100,
    }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    setPos(next);
  });
}

document.querySelectorAll(".ba-compare").forEach((el) => initCompare(el));
