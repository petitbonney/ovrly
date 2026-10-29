# Data and variables

## Data

When a trigger fires, it starts a **run** with some **data**: a Chat !command gives `user`, `message`, `command`, `args`…; a Follow gives `user`. Each node gets the data, may add to it or change it, and passes it on. The data is gone when the run ends.

- **Edit Data** adds or overwrites keys, e.g. `text` = `{{user}} just followed!`.
- **Map Value** swaps a key's value through a "from" → "to" list.
- A widget adds its result once it has stopped, e.g. the lottery's `{{winner}}`.

## Variables

**Variables** are shared by every workflow and kept across runs and restarts: a death counter, a score. Read them as `{{$vars.deaths}}`; change them with **Edit Variable** (set, add to, delete) or in **Settings → Variables**.

## Expressions

Any text setting takes `{{ ... }}`:

| You write | You get |
| --- | --- |
| `{{user}}` | a data key |
| `{{args.0}}` | the first word after the command |
| `{{json.items.0.name}}` | a path into nested data |
| `{{$vars.score}}` | a variable |
| `{{$node.http-request.status}}` | the output of an earlier node, by its type or id |
| `{{ score * 2 }}` | a JavaScript expression |

The **{ }** menu in a setting lists the keys the earlier nodes add.

::: danger Only import workflows you trust
Expressions and the Code node run as code on your computer.
:::

## When something fails

A node that fails stops its run there and turns red, with the error in its settings. A workflow starting with an **Error Trigger** runs whenever a node fails in another workflow: e.g. to post the error to Discord.
