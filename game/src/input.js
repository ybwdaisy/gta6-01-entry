// Keyboard + mouse input. Tracks held keys, edge-triggered presses,
// and the mouse position in screen and world space.
export function createInput(canvas) {
  const keys = {};
  const pressed = {};
  const mouse = { x: 0, y: 0, wx: 0, wy: 0, down: false, clicked: false };

  function code(e) { return e.code; }

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!keys[e.code]) pressed[e.code] = true;
    keys[e.code] = true;
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { mouse.down = true; mouse.clicked = true; }
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    keys, pressed, mouse,
    down(...codes) { return codes.some((c) => keys[c]); },
    hit(...codes) { return codes.some((c) => pressed[c]); },
    // Movement axis: -1..1 for x and y, from WASD or arrows.
    moveAxis() {
      let x = 0, y = 0;
      if (keys.KeyA || keys.ArrowLeft) x -= 1;
      if (keys.KeyD || keys.ArrowRight) x += 1;
      if (keys.KeyW || keys.ArrowUp) y -= 1;
      if (keys.KeyS || keys.ArrowDown) y += 1;
      return { x, y };
    },
    sprint() { return !!(keys.ShiftLeft || keys.ShiftRight); },
    endFrame() {
      for (const k in pressed) pressed[k] = false;
      mouse.clicked = false;
    },
  };
}
