// Settings form generated from a config's defaults, plus optional per-field hints from the node or widget type:
// { label, hint, unit, options, presets, vars, multiline, hidden, only, type: 'json' | 'code' | 'workflow' | 'secret' | 'var' | 'keys' | 'action' | 'input' }.
// presets: common values of a number, e.g. a duration's [3, 5, 10] seconds, shown as buttons next to its input.
// only: { key: value } shows the field only while those other settings have those values, e.g. { mode: 'twitch' }.
// An option { value, label, streamer: true } is a Twitch feature: it needs Twitch in Streamer mode (context.streamer).
// A list default (e.g. a poll's options) gets a list editor, a color default ("#rrggbb") a color picker, and
// { obs: 'scenes' | 'sources' } suggestions from OBS.
import { useEffect, useRef, useState } from 'react'
import {
  ActionIcon, Autocomplete, Button, ColorInput, Group, JsonInput, Menu, NumberInput, PasswordInput, SegmentedControl,
  Select, Stack, Switch, TagsInput, Text, Textarea, TextInput, Tooltip,
} from '@mantine/core'
import { IconBraces, IconGripVertical, IconPlus, IconX } from '@tabler/icons-react'
import { get } from './api.js'

// "case1" -> "Case1", "sceneName" -> "Scene name"
const humanize = (key) => key[0].toUpperCase() + key.slice(1).replace(/[A-Z]/g, (c) => ` ${c.toLowerCase()}`)

// Text input with a menu that inserts "{{key}}" placeholders for the data keys available at this node. With data,
// it also suggests those values as you type (all of them while the value is one of them).
function VarInput({ vars, value, onChange, multiline, data, ...props }) {
  const ref = useRef()
  const insert = (key) => {
    const el = ref.current
    const start = el?.selectionStart ?? value.length
    onChange(value.slice(0, start) + `{{${key}}}` + value.slice(el?.selectionEnd ?? start))
  }
  const menu = (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <Tooltip label="Insert data from previous nodes">
          <ActionIcon variant="subtle" size="sm"><IconBraces size={16} /></ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown>
        {vars.length ? vars.map((k) => <Menu.Item key={k} onClick={() => insert(k)}>{`{{${k}}}`}</Menu.Item>)
          : <Menu.Label>Connect an input first</Menu.Label>}
      </Menu.Dropdown>
    </Menu>
  )
  if (data) {
    const filter = ({ options, search }) => (options.some((o) => o.value === search) ? options
      : options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase())))
    return <Autocomplete ref={ref} data={data} filter={filter} value={value} onChange={onChange} rightSection={menu} {...props} />
  }
  const Input = multiline ? Textarea : TextInput
  return <Input ref={ref} value={value} onChange={(e) => onChange(e.target.value)} rightSection={menu} autosize={multiline || undefined} minRows={multiline ? 2 : undefined} {...props} />
}

// A scene or source name, suggested from the OBS integration (the sources of the node's scene). Typing stays free,
// so it works with OBS closed, and with {{key}} placeholders.
function ObsInput({ list, scene, ...props }) {
  const [names, setNames] = useState([])
  const [error, setError] = useState('')
  const path = list === 'scenes' ? '/api/obs/scenes' : `/api/obs/sources?scene=${encodeURIComponent(scene)}`
  const skip = list === 'sources' && (!scene || scene.includes('{{'))
  useEffect(() => {
    if (skip) return setNames([])
    fetch(path).then(async (r) => {
      const body = await r.json()
      setNames(r.ok ? body : [])
      setError(r.ok ? '' : 'OBS is not connected: names can still be typed')
    }, () => setError('OBS is not reachable'))
  }, [path, skip])
  return <VarInput {...props} data={names} description={error || props.description} placeholder={names.length ? 'Pick or type a name' : undefined} />
}

// A saved workflow, picked by id.
function WorkflowSelect({ value, onChange, ...props }) {
  const [list, setList] = useState([])
  useEffect(() => {
    get('/api/workflows').then((all) => setList(all.map((w) => ({ value: w.id, label: w.name || w.id }))))
  }, [])
  return <Select {...props} data={list} value={value} onChange={onChange} placeholder="Pick a workflow" />
}

// "90 s" -> "1m30", "300 s" -> "5m": presets read faster in minutes.
const short = (n, unit) => (unit === 's' && n >= 60 ? `${Math.floor(n / 60)}m${n % 60 ? String(n % 60).padStart(2, '0') : ''}` : `${n}${unit ?? ''}`)

// A number with preset buttons (the current one highlighted) and an input for any other value.
function PresetInput({ label, description, unit, presets, value, onChange }) {
  return (
    <Stack gap={4}>
      <Text size="xs" fw={500}>{label}</Text>
      {description && <Text size="xs" c="dimmed">{description}</Text>}
      <Group gap={6} wrap="nowrap">
        {presets.map((n) => (
          <Button key={n} size="compact-xs" h={30} px="sm" variant={n === value ? 'filled' : 'default'} onClick={() => onChange(n)}>{short(n, unit)}</Button>
        ))}
        <NumberInput size="xs" w={90} min={0} aria-label={`Custom ${label.toLowerCase()}`} suffix={unit && ` ${unit}`} value={value} onChange={(v) => onChange(Number(v))} />
      </Group>
    </Stack>
  )
}

const isColor = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)
const swatches = ['#9147ff', '#ff4f8b', '#00c2a8', '#ffb400', '#3d8bff', '#ff7a00', '#e03131', '#2f9e44']
// Column widths of list items with fields: colors and numbers are narrow, text takes the rest.
const width = (v) => (isColor(v) ? 110 : typeof v === 'number' ? 72 : undefined)

// One list item: a text, or an object edited field by field. shape (a default item) says which input each field gets,
// so a color being typed doesn't turn into a text field.
function ItemInput({ item, shape, onChange }) {
  if (typeof shape !== 'object') return <TextInput size="xs" flex={1} value={item} onChange={(e) => onChange(e.target.value)} />
  return Object.entries(shape).map(([key, example]) => {
    const props = { key, size: 'xs', w: width(example), flex: width(example) ? undefined : 1, 'aria-label': humanize(key) }
    const set = (v) => onChange({ ...item, [key]: v })
    if (isColor(example)) return <ColorInput {...props} swatches={swatches} value={item[key] ?? ''} onChange={set} />
    if (typeof example === 'number') return <NumberInput {...props} min={0} value={item[key]} onChange={(v) => set(Number(v))} />
    return <TextInput {...props} value={item[key] ?? ''} onChange={(e) => set(e.target.value)} />
  })
}

// A list setting: one row per item, reordered by dragging its grip (dropped above the row it lands on) or removed,
// and an Add button. A new item is empty
// text, or shaped like the default items with empty text and, for colors, the first swatch not used yet.
function ListInput({ label, description, value, defaults, onChange }) {
  const shape = defaults[0]
  const set = (i, item) => onChange(value.map((v, j) => (j === i ? item : v)))
  const [drag, setDrag] = useState(null) // { from, over }: the row being dragged and the row it is over
  const drop = () => {
    const next = value.filter((_, j) => j !== drag.from)
    next.splice(drag.over > drag.from ? drag.over - 1 : drag.over, 0, value[drag.from])
    onChange(next)
    setDrag(null)
  }
  const blank = () => {
    if (typeof shape !== 'object') return ''
    const used = value.flatMap((item) => Object.values(item))
    const fresh = swatches.find((c) => !used.includes(c)) ?? swatches[value.length % swatches.length]
    return Object.fromEntries(Object.entries(shape).map(([k, v]) => [k, isColor(v) ? fresh : typeof v === 'string' ? '' : v]))
  }
  return (
    <Stack gap={4}>
      <Text size="xs" fw={500}>{label}</Text>
      {description && <Text size="xs" c="dimmed">{description}</Text>}
      {typeof shape === 'object' && (
        // Column titles, as wide as the fields under them.
        <Group gap={6} wrap="nowrap" pl={28} pr={28}>
          {Object.entries(shape).map(([key, example]) => (
            <Text key={key} size="xs" c="dimmed" w={width(example)} flex={width(example) ? undefined : 1}>{humanize(key)}</Text>
          ))}
        </Group>
      )}
      {value.map((item, i) => (
        <Group
          key={i}
          gap={6}
          wrap="nowrap"
          // The drop spot shows as a line above the row (or below the last one).
          style={{ boxShadow: drag && drag.over === i && drag.from !== i ? '0 -2px 0 var(--mantine-color-blue-5)' : undefined }}
          onDragOver={(e) => {
            if (!drag) return
            e.preventDefault()
            const { top, height } = e.currentTarget.getBoundingClientRect()
            const over = e.clientY > top + height / 2 && i === value.length - 1 ? value.length : i
            if (over !== drag.over) setDrag({ ...drag, over })
          }}
          onDrop={(e) => {
            e.preventDefault()
            if (drag) drop()
          }}
        >
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            style={{ cursor: 'grab' }}
            aria-label="Drag to reorder"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move'
              e.dataTransfer.setData('application/ovrly-row', String(i)) // Firefox needs some data to drag
              e.dataTransfer.setDragImage(e.currentTarget.parentElement, 0, 0)
              setDrag({ from: i, over: i })
            }}
            onDragEnd={() => setDrag(null)}
          >
            <IconGripVertical size={14} />
          </ActionIcon>
          <ItemInput item={item} shape={shape} onChange={(v) => set(i, v)} />
          <ActionIcon variant="subtle" color="red" size="sm" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remove"><IconX size={14} /></ActionIcon>
        </Group>
      ))}
      {drag?.over === value.length && <div style={{ height: 2, marginTop: -2, background: 'var(--mantine-color-blue-5)' }} />}
      <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} fullWidth
        onClick={() => onChange([...value, blank()])}>
        Add
      </Button>
    </Stack>
  )
}

// One setting; context: { vars: data keys available here, widget: the linked widget, types } for the dynamic types.
function Field({ name, f, fallback, value, set, values, context }) {
  const props = { label: f.label ?? humanize(name), description: f.hint, size: 'xs' }
  if (Array.isArray(fallback)) return <ListInput label={props.label} description={props.description} value={value} defaults={fallback} onChange={set} />
  if (f.type === 'keys') {
    return <TagsInput {...props} data={f.options} value={value ? value.split('+') : []} onChange={(v) => set(v.join('+'))} />
  }
  // A widget's actions come from its type (nothing to pick if there is only one); short option lists are buttons.
  const type = context.types?.find((t) => t.type === context.widget?.type)
  // A widget action's value is only asked for if the action takes one; the widget type says what it is.
  if (f.type === 'input') {
    const hint = type?.inputs?.[values.action || type.actions[0]]
    return hint ? <VarInput {...props} description={hint} vars={context.vars ?? []} value={value} onChange={set} /> : null
  }
  // Twitch features can't be picked unless Streamer mode is on; one picked earlier says why it won't run.
  const options = f.type === 'action' ? type?.actions ?? [] : f.options?.map((o) => {
    if (!o.streamer) return o
    const { streamer, ...option } = o
    return { ...option, disabled: !context.streamer }
  })
  // A disabled Twitch feature says why on hover (segmented buttons only: a Select needs text labels).
  const explained = options?.map((o) => !o.disabled ? o : {
    ...o,
    label: <Tooltip label="Needs Twitch in Streamer mode, signed in (Integration → Twitch)" withinPortal><span>{o.label}</span></Tooltip>,
  })
  if (f.type === 'action' && options.length <= 1) return null
  if (f.options?.find((o) => o.value === value)?.streamer && !context.streamer) {
    props.description = <Text span size="xs" c="yellow">Needs Twitch in Streamer mode, signed in (Integration → Twitch)</Text>
  }
  if (options?.length <= 4) {
    return (
      <Stack gap={4}>
        <Text size="xs" fw={500}>{props.label}</Text>
        {props.description && <Text size="xs" c="dimmed">{props.description}</Text>}
        {/* A Fire Widget node with no action set runs its widget's first one. */}
        <SegmentedControl size="xs" data={explained} value={f.type === 'action' ? value || options[0] : value} onChange={set} style={{ alignSelf: 'start' }} />
      </Stack>
    )
  }
  if (options) return <Select {...props} data={options} value={value} onChange={set} allowDeselect={false} />
  if (f.type === 'var') return <Autocomplete {...props} data={context.vars ?? []} value={value} onChange={set} />
  if (f.type === 'json') return <JsonInput {...props} value={value} onChange={set} validationError="Invalid JSON" formatOnBlur autosize minRows={2} />
  if (f.type === 'code') {
    return <Textarea {...props} value={value} onChange={(e) => set(e.target.value)} autosize minRows={4} spellCheck={false} styles={{ input: { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12 } }} />
  }
  if (f.type === 'workflow') return <WorkflowSelect {...props} value={value} onChange={set} />
  if (f.type === 'secret') return <PasswordInput {...props} value={value} onChange={(e) => set(e.target.value)} />
  if (isColor(fallback)) return <ColorInput {...props} swatches={swatches} value={value} onChange={set} />
  if (typeof fallback === 'boolean') return <Switch {...props} checked={value} onChange={(e) => set(e.target.checked)} />
  if (f.presets) return <PresetInput {...props} unit={f.unit} presets={f.presets} value={value} onChange={set} />
  if (typeof fallback === 'number') return <NumberInput {...props} suffix={f.unit && ` ${f.unit}`} value={value} onChange={(v) => set(Number(v))} />
  if (f.obs) return <ObsInput {...props} list={f.obs} scene={values.scene ?? ''} vars={context.vars ?? []} value={value} onChange={set} />
  if (f.vars) return <VarInput {...props} vars={context.vars ?? []} multiline={f.multiline} value={value} onChange={set} />
  return <TextInput {...props} value={value} onChange={(e) => set(e.target.value)} />
}

// show: the settings to show (all by default), e.g. to show some of them elsewhere in the pane.
export default function Fields({ defaults, values, onChange, fields = {}, context = {}, show = Object.keys(defaults) }) {
  const only = (f) => !f?.only || Object.entries(f.only).every(([k, v]) => (values[k] ?? defaults[k]) === v)
  const keys = show.filter((key) => !fields[key]?.hidden && only(fields[key]))
  if (keys.length === 0) return <Text size="sm" c="dimmed">No settings</Text>
  return (
    <Stack gap="sm" maw={420}>
      {keys.map((key) => (
        <Field
          key={key}
          name={key}
          f={fields[key] ?? {}}
          fallback={defaults[key]}
          value={values[key] ?? defaults[key]}
          set={(v) => onChange({ ...values, [key]: v })}
          values={values}
          context={context}
        />
      ))}
    </Stack>
  )
}
