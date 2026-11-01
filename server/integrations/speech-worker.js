// Text-to-Speech worker: makes speech with sherpa-onnx (WebAssembly) off the main thread, since a sentence takes seconds and
// would block the server. Gets { id, dir (the model's folder), text, lang, sid, speed, file }, writes file, answers { id, error }.
import { parentPort } from 'node:worker_threads'
import sherpa from 'sherpa-onnx'

let tts
parentPort.on('message', ({ id, dir, text, lang, sid, speed, file }) => {
  try {
    const f = (name) => `${dir}/${name}`
    tts ??= sherpa.createOfflineTts({
      offlineTtsModelConfig: {
        offlineTtsSupertonicModelConfig: {
          durationPredictor: f('duration_predictor.int8.onnx'), textEncoder: f('text_encoder.int8.onnx'),
          vectorEstimator: f('vector_estimator.int8.onnx'), vocoder: f('vocoder.int8.onnx'),
          ttsJson: f('tts.json'), unicodeIndexer: f('unicode_indexer.bin'), voiceStyle: f('voice.bin'),
        },
        numThreads: 1, debug: 0, provider: 'cpu', // WebAssembly runs on one thread
      },
      maxNumSentences: 1,
    })
    const audio = tts.generateWithConfig(text, { sid, speed, extra: { lang } })
    if (!audio.samples.length) throw new Error('no speech made')
    tts.save(file, audio)
    parentPort.postMessage({ id })
  } catch (err) {
    parentPort.postMessage({ id, error: err.message })
  }
})
