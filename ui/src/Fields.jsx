// Settings form generated from a config's defaults, plus optional per-field hints from the node or widget type:
// { label, hint, unit, options, vars, multiline, hidden, type: 'json' | 'secret' | 'var' | 'keys' | 'action' | 'input' }.
import { useRef } from 'react'
import {
  ActionIcon, Autocomplete, JsonInput, Menu, NumberInput, PasswordInput, SegmentedControl, Select, Stack, Switch,
  TagsInput, Text, Textarea, TextInput, Tooltip,
} from '@mantine/core'
import { IconBraces } from '@tabler/icons-react'

// "case1" -> "Case1", "sceneName" -> "Scene name"
const humanize = (key) => key[0].toUpperCase() + key.slice(1).replace(/[A-Z]/g, (c) => ` ${c.toLowerCase()}`)

// Text input with a menu that inserts "{key}" placeholders for the data keys available at this node.
function VarInput({ vars, value, onChange, multiline, ...props }) {
  const ref = useRef()
  const insert = (key) => {
    const el = ref.current
    const start = el?.selectionStart ?? value.length
    onChange(value.slice(0, start) + `{${key}}` + value.slice(el?.selectionEnd ?? start))
  }
  const menu = (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <Tooltip label="Insert data from previous nodes">
          <ActionIcon variant="subtle" size="sm"><IconBraces size={16} /></ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown>
        {vars.length ? vars.map((k) => <Menu.Item key={k} onClick={() => insert(k)}>{`{${k}}`}</Menu.Item>)
          : <Menu.Label>Connect an input first</Menu.Label>}
      </Menu.Dropdown>
    </Menu>
  )
  const Input = multiline ? Textarea : TextInput
  return <Input ref={ref} value={value} onChange={(e) => onChange(e.target.value)} rightSection={menu} autosize={multiline || undefined} minRows={multiline ? 2 : undefined} {...props} />
}

// One setting; context: { vars: data keys available here, widget: the linked widget, types } for the dynamic types.
function Field({ name, f, fallback, value, set, values, context }) {
  const props = { label: f.label ?? humanize(name), description: f.hint, size: 'xs' }
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
  const options = f.type === 'action' ? type?.actions ?? [] : f.options
  if (f.type === 'action' && options.length <= 1) return null
  if (options?.length <= 4) {
    return (
      <Stack gap={4}>
        <Text size="xs" fw={500}>{props.label}</Text>
        {/* A Fire Widget node with no action set runs its widget's first one. */}
        <SegmentedControl size="xs" data={options} value={f.type === 'action' ? value || options[0] : value} onChange={set} style={{ alignSelf: 'start' }} />
      </Stack>
    )
  }
  if (options) return <Select {...props} data={options} value={value} onChange={set} allowDeselect={false} />
  if (f.type === 'var') return <Autocomplete {...props} data={context.vars ?? []} value={value} onChange={set} />
  if (f.type === 'json') return <JsonInput {...props} value={value} onChange={set} validationError="Invalid JSON" formatOnBlur autosize minRows={2} />
  if (f.type === 'secret') return <PasswordInput {...props} value={value} onChange={(e) => set(e.target.value)} />
  if (typeof fallback === 'boolean') return <Switch {...props} checked={value} onChange={(e) => set(e.target.checked)} />
  if (typeof fallback === 'number') return <NumberInput {...props} suffix={f.unit && ` ${f.unit}`} value={value} onChange={(v) => set(Number(v))} />
  if (f.vars) return <VarInput {...props} vars={context.vars ?? []} multiline={f.multiline} value={value} onChange={set} />
  return <TextInput {...props} value={value} onChange={(e) => set(e.target.value)} />
}

export default function Fields({ defaults, values, onChange, fields = {}, context = {} }) {
  const keys = Object.keys(defaults).filter((key) => !fields[key]?.hidden)
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
