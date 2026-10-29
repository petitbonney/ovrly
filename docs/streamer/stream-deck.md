# Stream Deck

A **Control Pad** node is a list of buttons, each with a name, an icon, a color and its own output. Press a button and its output fires.

![A Control Pad node: its buttons as a grid](/screenshots/control-pad.png)

Its **mode** picks how buttons are pressed:

- **Stream Deck**: keys on your Elgato Stream Deck, with the Ovrly plugin.
- **Companion**: a URL per button (`/hooks/<path>/<name>-<id>`), for Bitfocus Companion or anything that sends HTTP requests. Only the id counts, so renaming a button keeps its URL working.

You can also press the buttons in the node's settings, to try them. Buttons fire nothing while the workflow is off.

## The Ovrly plugin

![Settings → Stream Deck](/screenshots/settings-streamdeck.png)

1. Open **Settings → Stream Deck**, download the plugin, and open it: the Stream Deck app (7.1 or later) installs it.
2. In the Stream Deck app, drop the **Ovrly button** action on a key.
3. In the key's settings, pick a Control Pad button.

The key shows the button's icon, name and color, faded while its workflow is off, and follows changes live. Pressing it shows ✓ when it ran, ⚠ when the workflow is off or Ovrly isn't running. The node's grid marks the buttons that are on a key.
