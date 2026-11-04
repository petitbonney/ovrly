# Troubleshooting

### My system won't open Ovrly

The app isn't signed. On macOS, open it once, then click **Open Anyway** in **System Settings → Privacy & Security**. On Windows, click **More info** → **Run anyway**.

### "Ovrly is already running"

Something else uses port 6875, usually Ovrly started another way (an older version's launcher, or from source). Quit it, then open Ovrly again.

### Key Press does nothing (macOS)

macOS needs to allow it: **System Settings → Privacy & Security → Accessibility**, then allow **Ovrly** (Terminal when you run it from source). "Only when focused" also needs it to read window titles.

### A workflow doesn't fire

- Is its **switch** on? Templates start off.
- A node with a **plug icon** needs something that isn't ready: its settings say what.
- Is the trigger right? Fire it with its ⚡ (see [Fire a trigger](./editor#fire-a-trigger)): if its settings filter the event out, Ovrly says so.

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
