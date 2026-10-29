# Twitch

Open **Settings → Twitch**.

![Settings → Twitch, in Guest mode](/screenshots/settings-twitch.png)

## Guest or Streamer

**Guest** reads the chat of any channel, without signing in: type the channel's name and **Connect**. That's enough for chat triggers (Chat !command, Chat Message), chat votes, and the subs, gift subs, cheers and raids that chat announces.

**Streamer** signs you in as the channel owner, for everything else: follows, channel points, Hype Trains, stream on/off, native polls and predictions, and every Twitch action (chat messages as you, shoutouts, clips, ads…).

1. Pick **Streamer**, then **Sign in with Twitch**.
2. Check that Twitch shows the same code, and approve. Ovrly never sees your password.
3. Settings shows **Signed in as streamer**. **Sign out** removes Ovrly's access.

Until you sign in, Ovrly keeps reading the Guest channel's chat.

::: info What needs Streamer mode
In the library and on the graph, a node that needs it shows a plug icon, and its settings say so. Settings that need it (like Voting's Twitch mode) are greyed out in Guest mode. See [Nodes](./nodes).
:::

## Test without going live

- A **Chat !command** node's settings have a test **Run**, with the args, user and role you pick.
- The **⚡** beside the other chat triggers sends them a test message from TestViewer.
- A **Manual Trigger** runs with ▶ in the toolbar.
