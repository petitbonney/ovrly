# Files, LAN and safety

## Your files

Everything Ovrly keeps is in its `data` folder (the tray menu's **Open data folder**: `~/Library/Application Support/Ovrly/data` on macOS, `%APPDATA%\Ovrly\data` on Windows), as plain JSON files: one per workflow (`data/workflows/`), one per widget (`data/widgets/`), and your settings (`data/settings/`, with your Twitch sign-in and OBS password: keep it private). Back it up by copying the folder.

- **Export** (in the workflow's toolbar) downloads a workflow with its widgets, as one JSON file.
- **New workflow → Import** loads them: one or several JSON files, or a zip of them.
- **Settings → Backup → Export all workflows** downloads them all at once, as a zip of those JSON files. **Import workflows…** beside it loads one back.

Imported workflows are added beside yours; a widget several of them share comes in once.

## LAN

By default, only this computer reaches Ovrly. **Settings → LAN → Open to LAN** lets other devices on your network open widget links (OBS on another computer) and send API calls, at the addresses it lists.

![Settings → LAN](/screenshots/settings-lan.png)

The editor needs its own link from another device, with a key in it. Keep that link private: it gives full control. Turning LAN off and on makes a new key, which signs the other devices out.

## Safety

::: danger Ovrly runs code
Expressions (`{{ }}`), the Code node and custom nodes and widgets run as code on your computer, with your rights. Only import workflows, and only add custom files, from people you trust.
:::

Ovrly refuses requests from other websites, so a page you visit can't drive it.
