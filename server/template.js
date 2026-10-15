// Fills "{key}" placeholders in node config text with values from the workflow data.
export const fill = (text, data) => String(text).replace(/\{(\w+)\}/g, (m, key) => data[key] ?? '')
