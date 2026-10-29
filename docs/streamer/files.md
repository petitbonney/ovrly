# Files, LAN and safety

## Your files

Everything Ovrly keeps is in the `data` folder next to it, as plain JSON files: one per workflow (`data/workflows/`), one per widget (`data/widgets/`), and your settings (`data/settings/`, with your Twitch sign-in and OBS password: keep it private). Back it up by copying the folder.

- **Export** (in the workflow's toolbar) downloads a workflow with its widgets, as one JSON file.
- **New workflow → Import** loads one.

## LAN

By default, only this computer reaches Ovrly. **Settings → LAN → Open to LAN** lets other devices on your network open widget links (OBS on another computer) and send API calls, at the addresses it lists.

![Settings → LAN](/screenshots/settings-lan.png)

The editor needs its own link from another device, with a key in it. Keep that link private: it gives full control. Turning LAN off and on makes a new key, which signs the other devices out.

## Safety

::: danger Ovrly runs code
Expressions (`{{ }}`), the Code node and custom nodes and widgets run as code on your computer, with your rights. Only import workflows, and only add custom files, from people you trust.
:::

Ovrly refuses requests from other websites, so a page you visit can't drive it.
