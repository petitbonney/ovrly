# Troubleshooting

### My system won't open Ovrly

The app isn't signed. On macOS, right-click **Start Ovrly.command** → **Open**. On Windows, click **More info** → **Run anyway**.

### Key Press does nothing (macOS)

macOS needs to allow it: **System Settings → Privacy & Security → Accessibility**, then allow the app that runs Ovrly (Terminal). "Only when focused" also needs it to read window titles.

### A workflow doesn't fire

- Is its **switch** on? Templates start off.
- A node with a **plug icon** needs something that isn't ready: its settings say what.
- Is the trigger right? Fire it with its ⚡ (see [Fire a trigger](./editor#fire-a-trigger)): if its settings filter the event out, Ovrly says so.
- Press **Ctrl+Shift+D** and open the events view: it lists what Ovrly received.

### A node is red

It failed: its settings show the error. It stays red until it runs again.

### A widget doesn't show in OBS

- Check the link in the Browser Source against the one in the widget node's settings. Each widget has its own.
- A deleted widget's link shows nothing.
- No sound? Tick **Control audio via OBS** on the browser source.

### A Twitch node says it needs Streamer mode

Sign in as the channel owner in **Settings → Twitch** (see [Twitch](./twitch#guest-or-streamer)). Some features also need Affiliate or Partner status (polls, predictions, channel points).

### Everything is going wrong live

Press **EMERGENCY** (bottom left): every workflow turns off and what runs is cancelled. It offers to turn them back on.
