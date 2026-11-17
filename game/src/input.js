// input.js — keyboard + mouse state, one shared object the loop polls.
// Keys are tracked by code (KeyW, ArrowUp, ShiftLeft ...), mouse by canvas
// position converted to world coordinates by the caller.

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    pressed: new Set(), // keys pressed since last poll (edge-triggered)
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    mouseClicked: false, // left click since last poll
    wheel: 0,
  };

  const KEY_ALIASES = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'sprint', ShiftRight: 'sprint',
    KeyE: 'interact', KeyF: 'exit',
    KeyR: 'reload', KeyM: 'mute',
    Escape: 'pause', KeyP: 'pause',
    Space: 'brake',
    Enter: 'confirm',
  };

  window.addEventListener('keydown', (e) => {
    const name = KEY_ALIASES[e.code];
    if (name) {
      if (!e.repeat) input.pressed.add(name);
      input.keys.add(name);
      if (name === 'pause' || name === 'interact' || name === 'confirm') e.preventDefault();
    }
    if (e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    const name = KEY_ALIASES[e.code];
    if (name) input.keys.delete(name);
  });
  window.addEventListener('blur', () => input.keys.clear());

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - r.left;
    input.mouseY = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      input.mouseDown = true;
      input.mouseClicked = true;
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return input;
}

/** True while the named action key is held. */
export function held(input, name) {
  return input.keys.has(name);
}

/** True once, on the frame the key went down. */
export function wasPressed(input, name) {
  return input.pressed.has(name);
}

/** Call at the end of every frame: edge triggers fire exactly once. */
export function endFrame(input) {
  input.pressed.clear();
  input.mouseClicked = false;
  input.wheel = 0;
}
