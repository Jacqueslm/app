// Runs one narration in its own process, then exits.
//
// This file exists because of a library fight: sherpa-onnx (narration) and
// onnxruntime-node (captions) each bundle their own copy of the ONNX runtime,
// and Windows will only load one library of a given name per process — the
// second arrival fails with "The operating system cannot run %1". Auto-captions
// broke the day narration shipped, because the app's boot check loaded sherpa
// first. Keeping sherpa in a short-lived child means the two never share a
// process, so both features work in the same session, in any order.
//
// Reads one JSON job from stdin:
//   { model, tokens, dataDir, outPath, text, speed, numThreads }
// Writes { seconds } as JSON to stdout on success; a plain error message on
// stderr and a non-zero exit otherwise.

const fs = require('fs');

let input = '';
process.stdin.on('data', (c) => { input += c; });
process.stdin.on('end', () => {
  let job;
  try { job = JSON.parse(input); } catch (e) {
    process.stderr.write('bad job JSON'); process.exit(2);
  }
  try {
    const sherpa = require('sherpa-onnx-node');
    const tts = new sherpa.OfflineTts({
      model: {
        vits: { model: job.model, tokens: job.tokens, dataDir: job.dataDir },
        numThreads: job.numThreads || 1,
        debug: false,
      },
      maxNumSentences: 1,
    });
    const audio = tts.generate({ text: job.text, sid: 0, speed: job.speed });
    sherpa.writeWave(job.outPath, { samples: audio.samples, sampleRate: audio.sampleRate });
    if (!fs.existsSync(job.outPath)) throw new Error('no wav was written');
    process.stdout.write(JSON.stringify({ seconds: audio.samples.length / audio.sampleRate }));
    process.exit(0);
  } catch (e) {
    process.stderr.write(String((e && e.message) || e).slice(0, 500));
    process.exit(1);
  }
});
