declare module "fluent-ffmpeg" {
  import { Stream } from "stream";

  interface FfmpegCommand {
    audioChannels(n: number): FfmpegCommand;
    audioFrequency(freq: number): FfmpegCommand;
    audioCodec(codec: string): FfmpegCommand;
    format(fmt: string): FfmpegCommand;
    output(output: string): FfmpegCommand;
    save(output: string): FfmpegCommand;
    on(event: "error", cb: (err: Error) => void): FfmpegCommand;
    on(event: "end", cb: () => void): FfmpegCommand;
    input(input: string): FfmpegCommand;
    inputStream(stream: Stream): FfmpegCommand;
    outputStream(stream: Stream): FfmpegCommand;
    run(): FfmpegCommand;
    ffprobe(file: string, cb: (err: Error | null, metadata: unknown) => void): void;
  }

  function createFfmpeg(input?: string): FfmpegCommand;

  export = createFfmpeg;
}