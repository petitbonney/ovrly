// Preload for the screenshots: stands in for nut.js (Key Press), which has no build for Linux on ARM (Docker on an
// Apple Silicon Mac). Screenshots press no keys.
import { registerHooks } from 'node:module'

const stub = 'export const keyboard = { config: {} }, Key = {}, getWindows = async () => [], getActiveWindow = async () => ({ title: "" })'
registerHooks({
  resolve: (specifier, context, next) => specifier === '@nut-tree-fork/nut-js'
    ? { url: `data:text/javascript,${encodeURIComponent(stub)}`, shortCircuit: true }
    : next(specifier, context),
})
