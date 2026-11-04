# Getting started

Ovrly runs on your computer, next to OBS. You draw **workflows**: when something happens on stream (a chat command, a follow, a Stream Deck key), do something (show an alert, switch a scene, flash the lights). The editor opens in your browser.

::: warning Prototype
Ovrly is a prototype: Twitch and OBS only, for now. Expect rough edges, and keep a backup of your `data` folder.
:::

## Download

1. Get the installer for your system from the [Releases page](https://github.com/petitbonney/ovrly/releases): `…-mac-arm64.dmg` (Mac with Apple Silicon), `…-mac-x64.dmg` (Intel Mac) or `…-win-x64.exe` (Windows).
2. **macOS**: open the `.dmg` and drag **Ovrly** into **Applications**. **Windows**: run the installer.
3. Open **Ovrly**.

Nothing else to install. The editor opens in Ovrly's window, and in your browser at [http://localhost:6875](http://localhost:6875) too. Closing the window keeps Ovrly running in the tray (the menu bar on macOS), so widgets and workflows keep working on stream: **Quit Ovrly** is in the tray icon's menu.

::: tip First launch
The app isn't signed, so your system warns you the first time.
- **macOS**: open it once and close the warning, then click **Open Anyway** in **System Settings → Privacy & Security**.
- **Windows**: click **More info** → **Run anyway**.
:::

Your workflows and widgets are saved in Ovrly's `data` folder (the tray menu's **Open data folder**): `~/Library/Application Support/Ovrly/data` on macOS, `%APPDATA%\Ovrly\data` on Windows. To update, install the new version over the old one: `data` stays.

::: info Coming from the zip
Earlier versions came as a zip with a launcher, their `data` folder next to it. Open Ovrly once, pick **Open data folder** in the tray menu, then **Quit Ovrly**. Copy what's in the old `data` folder into that one, and open Ovrly again.
:::

## Your first workflow

1. Click **+** next to **Workflows**, or **New workflow**.
2. Pick a template, e.g. **Chat decides**: mods start a poll with `!poll`, chat votes with `!vote 1`.

   ![The New workflow dialog: Blank, Import, and the templates](/screenshots/new-workflow.png)

   Or pick **Blank** to build your own: it opens as a list of steps (the [Basic view](./editor#basic-a-list-of-steps)), a trigger then what it does.

3. Templates start switched off. Connect what the workflow needs first (here, [Twitch](./twitch) to read your chat), then turn on the switch next to its name.
4. Show its widgets in OBS: select the widget node (the poll), copy the **OBS browser source** link from its settings, and add it to OBS as a **Browser Source** (see [OBS](./obs#show-a-widget)).

![The Chat decides workflow: !poll and !vote → Voting → the result announced, and a Switch to the winning scene](/screenshots/editor.png)

Try it without going live: the **⚡** beside a trigger fires it, and its settings' **Fire** section picks what it carries, e.g. a Chat !command's args, user and role (see [Fire a trigger](./editor#fire-a-trigger)).

## Where to next

- [The editor](./editor): the graph, the library, the settings pane.
- [Templates](./templates): what each one does.
- [Nodes](./nodes) and [Widgets](./widgets): everything you can put in a workflow.
- [Twitch](./twitch), [OBS](./obs), [Stream Deck](./stream-deck), [Hue, Giphy and Text-to-Speech](./hue-giphy): connect your tools.
