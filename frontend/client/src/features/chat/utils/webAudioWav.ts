function writeString(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

function encodeWav(buffer: AudioBuffer): Blob {
  const input = buffer.getChannelData(0);
  const second = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null;
  const pcm = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const mixed = second ? (input[i]! + second[i]!) / 2 : input[i]!;
    const sample = Math.max(-1, Math.min(1, mixed));
    pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  const bytes = pcm.length * 2;
  const wav = new ArrayBuffer(44 + bytes);
  const view = new DataView(wav);
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + bytes, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, bytes, true);
  new Uint8Array(wav, 44).set(new Uint8Array(pcm.buffer));
  return new Blob([wav], { type: "audio/wav" });
}

export function pickRecorderMime() {
  const types = ["audio/mp4", "audio/aac", "audio/webm;codecs=opus", "audio/webm"];
  return (
    types.find(
      (type) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type),
    ) ?? ""
  );
}

/** Convert browser recordings (often webm/opus) to WAV so phones can play them. */
export async function blobToPlayableAudio(
  blob: Blob,
): Promise<{ blob: Blob; mimeType: string; fileName: string }> {
  const type = blob.type.toLowerCase();
  if (
    type.includes("wav") ||
    type.includes("mpeg") ||
    type.includes("mp4") ||
    type.includes("aac") ||
    type.includes("m4a")
  ) {
    const ext =
      type.includes("mpeg") || type.includes("mp3") ? "mp3" : type.includes("wav") ? "wav" : "m4a";
    return { blob, mimeType: blob.type || "audio/mp4", fileName: `voice.${ext}` };
  }

  try {
    const ctx = new AudioContext();
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const wav = encodeWav(decoded);
    await ctx.close();
    return { blob: wav, mimeType: "audio/wav", fileName: "voice.wav" };
  } catch {
    return { blob, mimeType: blob.type || "audio/webm", fileName: "voice.webm" };
  }
}
