// Scrambling adjacent labels can move a header link between down and up.
// Keep a stationary press attached to that link; release for an actual drag.
module.exports = function retainPointerTarget(event) {
  const node = event.currentTarget;
  const pointer = event.originalEvent || event;
  if (pointer.button !== 0 || pointer.isPrimary === false || typeof pointer.pointerId !== 'number') return;
  const id = pointer.pointerId;
  const finish = () => {
    node.removeEventListener('pointermove', move);
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) node.removeEventListener(type, finish);
  };
  const move = next => {
    if (Math.hypot(next.clientX - pointer.clientX, next.clientY - pointer.clientY) > 8) {
      if (node.hasPointerCapture(id)) node.releasePointerCapture(id);
      finish();
    }
  };
  node.addEventListener('pointermove', move);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) node.addEventListener(type, finish);
  node.setPointerCapture(id);
};
