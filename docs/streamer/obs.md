# OBS

Ovrly works with OBS two ways: widgets are **browser sources**, and Switch Scene and Toggle Source nodes control OBS over its **WebSocket**.

## Show a widget

1. Select the widget node (or Merge Widgets node) and copy its **OBS browser source** link, e.g. `http://localhost:6875/w/<id>`.
2. In OBS, add a **Browser Source** with that URL. Size it as you like: widgets scale to fit.
3. For widgets with sound (Sound, Video, Alerts), tick **Control audio via OBS**.

The page reconnects by itself if Ovrly restarts. To put several widgets in one source, use [Merge Widgets](./widgets#merge-widgets).

## Control OBS

![Settings → OBS: WebSocket URL and password](/screenshots/settings-obs.png)

1. In OBS: **Tools → WebSocket Server Settings**, tick **Enable WebSocket server**, and note the port and password (**Show Connect Info**).
2. In Ovrly: **Settings → OBS**, enter the URL (`ws://localhost:4455` when OBS runs on this computer) and the password.

Once connected, the Switch Scene and Toggle Source nodes suggest your scene and source names.
