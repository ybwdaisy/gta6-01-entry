# Serena Bay Heat

An original top-down 2D open-world crime game, built for the
[make.fun "Make GTA 6" bounty](https://make.fun/bounty/gta6-01).

**Serena Bay** is a sun-soaked coastal city. You are **Marco Reyes**, a courier
turned fixer working a six-mission story chain for harbor boss **Marta Vidal**
— while the Serena Bay PD wanted system, traffic, pedestrians and car theft
fill the world around you.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network requests: every script, style and sound is a file
under `game/`, and all sound is synthesized live with WebAudio.

## What is in the city

- **Open world** — 2560×2560 city, road grid, ~60 named buildings
  (Cafe Alba, Hotel Serena, Bodega Sol, Talleres Pipo, Clinica Serena…),
  beach strip, park, lighthouse point, market square.
- **On foot and by car** — WASD/arrows to walk (Shift to sprint), E/F to
  enter and exit any car. Parked cars are free; pulling a driver out of a
  stopped car earns heat.
- **Traffic & pedestrians** — cars follow lanes, stop for trouble ahead and
  turn at intersections; pedestrians stroll the sidewalks and flee gunfire.
- **Wanted 0–5 stars** — theft, assault, shots and hit-and-runs raise heat.
  Lay low to cool off, or pay $150 at Talleres Pipo for a repaint.
- **Police** — patrol cars chase and ram; at 3+ stars officers come on foot
  and shoot. Get busted or wasted and you wake up at Clinica Serena,
  lighter in the wallet.
- **Six missions** — a story chain with dialogue, timers, a van escort, a
  4-star cooldown and a 5-star lighthouse getaway — plus taxi fares on the side.
- **Combat** — mouse-aim pistol, 12-round magazine, R to reload, ammo
  pickups, muzzle flash and shell casings.
- **HUD** — health/armor, cash, wanted stars, weapon/ammo, mission banner,
  objective text, circular minimap, clock and day/night tint.
- **Save** — autosaves after every mission (`serena-save-v1` in
  localStorage); start screen with New Game / Continue / How to play,
  pause with Esc / P, mute with M.

## Controls

| Action | Keys |
| --- | --- |
| Move / sprint | WASD or arrows / Shift |
| Drive | W accelerate · S brake/reverse · A D steer · Space handbrake · H horn |
| Enter / exit car | E / F |
| Aim / shoot / reload | Mouse / Click / R |
| Pause / mute | Esc or P / M |

## Structure

```
game/
  index.html        page, HUD DOM, start/pause cards
  style.css         all styling
  src/
    main.js         boot, game loop, state machine
    city.js         city layout, buildings, roads, collision
    input.js        keyboard + mouse
    audio.js        WebAudio synth SFX + ambience
    vehicles.js     car physics, traffic AI, spawning
    pedestrians.js  pedestrian AI
    police.js       wanted levels, police cars + officers
    combat.js       shooting, bullets, damage
    missions.js     6-mission story chain + taxi fares + dialogue
    hud.js          HUD updates + minimap
    render.js       world rendering
    save.js         localStorage save/load
    shots.js        deterministic ?shot= screenshot scenes
```

Everything is original: our own city, characters, vehicles, names, story,
art and sounds. Nothing from any other game.

## Entry

Built for make.fun — [gta6-01 "Make GTA 6"](https://make.fun/bounty/gta6-01).
If you join through my link, we both get a little extra:
https://make.fun/r/fga00vgg

MIT licensed. See `LICENSE`.
