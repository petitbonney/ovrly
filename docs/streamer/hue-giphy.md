# Philips Hue and Giphy

## Philips Hue

1. Open **Settings → Philips Hue** and enter your bridge's IP (the Hue app shows it in the bridge's settings).
2. Press the button on the bridge, then **Pair**.

The **Hue Lights** node picks a light, room or zone and a mode:

- **toggle**, **set** (on, with a brightness and color) or **off**, each with a fade;
- **routine**: a list of steps (a color and brightness, or off, each for a duration), played once, N times or until stopped. Then the lights go back as they were (unless unticked).

A routine runs until it ends. Its settings have **Stop** (fades back, the workflow goes on) and **Cancel** (back at once, the workflow stops there). Firing it again on the same lights replaces the routine.

::: tip Safe flashing
Steps last at least 200 ms on a light (under 3 flashes a second) and 1 s on a room or zone, 50 steps at most. The editor warns when it changes a step.
:::

## Giphy

The **GIPHY** node and the GIF picker need a Giphy API key:

1. Make an app on [developers.giphy.com](https://developers.giphy.com) and copy its API key.
2. Paste it in **Settings → Giphy**: Ovrly checks it on save.

Clips (GIFs with sound, for the Video widget) need a key approved for clips.

Sounds from [Myinstants](https://www.myinstants.com) need no key.
