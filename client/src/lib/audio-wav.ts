const TARGET_SAMPLE_RATE = 16000;
const BITS_PER_SAMPLE = 16;
const WAV_HEADER_BYTES = 44;

const SUPPORTED_MIME_TYPES: readonly string[] = [
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
];

export interface SpeechAudio {
  blob: Blob;
  fileName: string;
  peakLevel: number | null;
}

const NORMALIZE_TARGET_PEAK = 0.85;
const MAX_NORMALIZE_GAIN = 12;

const analyzeAndNormalize = (buffer: AudioBuffer): number => {
  const samples: Float32Array = buffer.getChannelData(0);
  let peak: number = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const magnitude: number = Math.abs(samples[index]);
    if (magnitude > peak) peak = magnitude;
  }
  if (peak > 0 && peak < NORMALIZE_TARGET_PEAK) {
    const gain: number = Math.min(NORMALIZE_TARGET_PEAK / peak, MAX_NORMALIZE_GAIN);
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] *= gain;
    }
  }
  return peak;
};

const baseMimeType = (type: string): string =>
  type.split(';')[0].trim().toLowerCase();

const pickFileName = (mimeType: string): string => {
  if (mimeType.includes('wav') || mimeType.includes('wave')) return 'record.wav';
  if (mimeType.includes('ogg')) return 'record.ogg';
  return 'record.mp3';
};

const writeAscii = (view: DataView, offset: number, text: string): void => {
  for (let index = 0; index < text.length; index += 1) {
    view.setUint8(offset + index, text.charCodeAt(index));
  }
};

const encodeWav = (buffer: AudioBuffer): Blob => {
  const samples: Float32Array = buffer.getChannelData(0);
  const blockAlign: number = (BITS_PER_SAMPLE / 8) * 1;
  const dataSize: number = samples.length * blockAlign;
  const output: ArrayBuffer = new ArrayBuffer(WAV_HEADER_BYTES + dataSize);
  const view = new DataView(output);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, WAV_HEADER_BYTES - 8 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, BITS_PER_SAMPLE, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = WAV_HEADER_BYTES;
  for (let index = 0; index < samples.length; index += 1) {
    const sample: number = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(
      offset,
      sample < 0 ? sample * 0x8000 : sample * 0x7fff,
      true,
    );
    offset += blockAlign;
  }

  return new Blob([view], { type: 'audio/wav' });
};

const resampleToMono = async (buffer: AudioBuffer): Promise<AudioBuffer> => {
  const targetLength: number = Math.max(
    1,
    Math.ceil(buffer.duration * TARGET_SAMPLE_RATE),
  );
  const offline = new OfflineAudioContext(1, targetLength, TARGET_SAMPLE_RATE);
  const source: AudioBufferSourceNode = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start();
  return offline.startRendering();
};

export async function toSpeechAudio(blob: Blob): Promise<SpeechAudio> {
  const mimeType: string = baseMimeType(blob.type);
  if (SUPPORTED_MIME_TYPES.includes(mimeType)) {
    return { blob, fileName: pickFileName(mimeType), peakLevel: null };
  }

  const context = new AudioContext();
  try {
    const decoded: AudioBuffer = await context.decodeAudioData(
      await blob.arrayBuffer(),
    );
    const mono: AudioBuffer = await resampleToMono(decoded);
    const peakLevel: number = analyzeAndNormalize(mono);
    return { blob: encodeWav(mono), fileName: 'record.wav', peakLevel };
  } finally {
    await context.close();
  }
}
