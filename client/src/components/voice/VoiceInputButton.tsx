import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { capabilityClient } from '@lark-apaas/client-toolkit';
import { logger } from '@lark-apaas/client-toolkit/logger';

import { Button } from '@/components/ui/button';
import { toSpeechAudio, type SpeechAudio } from '@/lib/audio-wav';
import type { WorkDailyVoiceToTextOneOutput } from '@shared/plugin-types';

const PLUGIN_INSTANCE_ID = 'work_daily_voice_to_text_1';
const RECORDER_MIME_TYPE = 'audio/webm;codecs=opus';

// flash ASR 对单应用存在并发限流（45000292），属瞬时错误，发起次有限重试提高成功率
const TRANSCRIBE_MAX_RETRIES = 3;
const TRANSCRIBE_RETRY_DELAYS: number[] = [1500, 3000, 5000];

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

type VoiceStatus = 'idle' | 'recording' | 'transcribing';

interface VoiceInputButtonProps {
  onTranscribed: (text: string) => void;
  disabled?: boolean;
}

const SILENCE_PEAK_THRESHOLD = 0.001;

const extractDetail = (error: unknown): string => {
  if (typeof error === 'string') return error;
  if (!(error instanceof Error)) {
    try {
      return JSON.stringify(error);
    } catch {
      return '';
    }
  }
  const parts: string[] = error.message ? [error.message] : [];
  let current: unknown = (error as { detail?: unknown; cause?: unknown })
    .detail;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (current instanceof Error) {
      if (current.message) parts.push(current.message);
      current = (current as { cause?: unknown }).cause;
    } else {
      if (typeof current === 'string') parts.push(current);
      else if (current && typeof current === 'object') {
        const code: unknown = (current as { code?: unknown }).code;
        if (typeof code === 'string') parts.push(code);
        const message: unknown = (current as { message?: unknown }).message;
        if (typeof message === 'string') parts.push(message);
      }
      current = undefined;
    }
  }
  return parts.filter(Boolean).join(' | ');
};

const describeTranscribeError = (error: unknown): string => {
  const detail: string = extractDetail(error);
  if (detail.includes('20000003')) {
    return '没有识别到语音内容，请检查麦克风音量是否正常后重试';
  }
  if (detail.includes('unsupported audio format')) {
    return '录音格式不被支持，请重新录制';
  }
  if (detail.includes('Unexpected end of JSON input')) {
    return '语音服务响应异常，请稍后重试';
  }
  if (detail.includes('45000292') || detail.includes('429')) {
    return '语音服务繁忙，请稍后重试';
  }
  if (detail.includes('[object Object]')) {
    return '语音转写服务处理失败，请稍后重试';
  }
  return detail ? `语音转写失败：${detail}` : '语音转写失败，请稍后重试';
};

const isRetryableTranscribeError = (error: unknown): boolean => {
  const detail: string = extractDetail(error);
  return !detail.includes('unsupported audio format');
};

const formatDuration = (totalSeconds: number): string => {
  const minutes: string = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds: string = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
};

const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
  onTranscribed,
  disabled,
}) => {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTranscribedRef = useRef(onTranscribed);
  const statusRef = useRef<VoiceStatus>('idle');

  useEffect(() => {
    onTranscribedRef.current = onTranscribed;
  }, [onTranscribed]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const clearTimer = useCallback((): void => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const releaseStream = useCallback((): void => {
    streamRef.current?.getTracks().forEach((track: MediaStreamTrack) => {
      track.stop();
    });
    streamRef.current = null;
  }, []);

  const transcribe = useCallback(async (blob: Blob): Promise<void> => {
    setStatus('transcribing');
    try {
      const audio: SpeechAudio = await toSpeechAudio(blob);
      if (
        audio.peakLevel !== null &&
        audio.peakLevel < SILENCE_PEAK_THRESHOLD
      ) {
        toast.error(
          '录音中没有检测到声音，请检查麦克风是否被静音或选择正确的输入设备后重试',
        );
        return;
      }
      const file: File = new File([audio.blob], audio.fileName, {
        type: audio.blob.type || 'audio/wav',
      });
      let result: WorkDailyVoiceToTextOneOutput | null = null;
      let lastError: unknown = null;
      for (
        let attempt = 0;
        attempt <= TRANSCRIBE_MAX_RETRIES;
        attempt += 1
      ) {
        try {
          result = await capabilityClient
            .load(PLUGIN_INSTANCE_ID)
            .call<WorkDailyVoiceToTextOneOutput>('speechToText', {
              audio_file: [file],
              language: 'zh',
            });
          break;
        } catch (retryError) {
          lastError = retryError;
          if (
            !isRetryableTranscribeError(retryError) ||
            attempt === TRANSCRIBE_MAX_RETRIES
          ) {
            throw retryError;
          }
          await sleep(TRANSCRIBE_RETRY_DELAYS[attempt]);
        }
      }
      const text: string = (result?.text ?? '').trim();
      if (!text) {
        toast.error('没有识别到语音内容，请靠近麦克风重新录制');
        return;
      }
      onTranscribedRef.current(text);
      toast.success('语音已转为文字');
    } catch (error) {
      logger.error('语音转写失败', error);
      toast.error(describeTranscribeError(error));
    } finally {
      setStatus('idle');
    }
  }, []);

  const stopRecording = useCallback((): void => {
    const recorder: MediaRecorder | null = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
  }, []);

  const startRecording = useCallback(async (): Promise<void> => {
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      toast.error('当前浏览器不支持录音，请使用 Chrome 或 Edge 浏览器');
      return;
    }
    try {
      const stream: MediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType: string = MediaRecorder.isTypeSupported(
        RECORDER_MIME_TYPE,
      )
        ? RECORDER_MIME_TYPE
        : '';
      const recorder: MediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recorder.ondataavailable = (event: BlobEvent): void => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = (): void => {
        clearTimer();
        releaseStream();
        const blob: Blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || RECORDER_MIME_TYPE,
        });
        chunksRef.current = [];
        recorderRef.current = null;
        void transcribe(blob);
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecordingSeconds(0);
      setStatus('recording');
      clearTimer();
      timerRef.current = setInterval(() => {
        setRecordingSeconds((previous: number) => previous + 1);
      }, 1000);
    } catch (error) {
      logger.error('启动录音失败', error);
      releaseStream();
      const denied: boolean =
        error instanceof DOMException &&
        (error.name === 'NotAllowedError' || error.name === 'SecurityError');
      toast.error(
        denied
          ? '麦克风权限被拒绝，请在浏览器中允许录音后重试'
          : '无法启动录音，请检查麦克风设备是否可用',
      );
    }
  }, [clearTimer, releaseStream, transcribe]);

  const handleClick = (): void => {
    const currentStatus: VoiceStatus = statusRef.current;
    if (currentStatus === 'recording') {
      stopRecording();
      return;
    }
    if (currentStatus === 'transcribing') {
      return;
    }
    void startRecording();
  };

  useEffect(
    () => () => {
      clearTimer();
      const recorder: MediaRecorder | null = recorderRef.current;
      if (recorder) {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
        recorderRef.current = null;
      }
      releaseStream();
    },
    [clearTimer, releaseStream],
  );

  const isRecording: boolean = status === 'recording';
  const isTranscribing: boolean = status === 'transcribing';

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant={isRecording ? 'default' : 'ghost'}
        size="icon"
        aria-label={isRecording ? '结束录音并转写' : '语音输入'}
        aria-pressed={isRecording}
        title={isRecording ? '结束录音并转写' : '语音输入'}
        disabled={disabled || isTranscribing}
        onClick={handleClick}
        className={
          isRecording
            ? 'h-7 w-7 bg-red-500 text-white hover:bg-red-600'
            : 'h-7 w-7 text-slate-400 hover:bg-primary/[0.07] hover:text-primary'
        }
      >
        {isTranscribing ? (
          <Loader2 className="animate-spin" />
        ) : isRecording ? (
          <Square className="fill-current" />
        ) : (
          <Mic />
        )}
      </Button>
      {isRecording ? (
        <span className="flex items-center gap-1.5 text-xs tabular-nums text-red-600">
          <span className="size-2 animate-pulse rounded-full bg-red-500" />
          {formatDuration(recordingSeconds)}
        </span>
      ) : null}
      {isTranscribing ? (
        <span className="text-xs text-slate-500">转写中...</span>
      ) : null}
    </div>
  );
};

export default VoiceInputButton;
