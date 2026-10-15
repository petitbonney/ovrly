// Event bus: every source publishes events here; the engine listens.
import { EventEmitter } from 'node:events'

export default new EventEmitter()
