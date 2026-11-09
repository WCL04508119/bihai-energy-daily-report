'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Check,
  ImageIcon,
  Loader2,
  Mic,
  MicOff,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { Image } from '@client/src/components/ui/image';

// ============================================================================
// Types
// ============================================================================

type Priority = 'low' | 'medium' | 'high' | 'critical';
type Category =
  | 'maintenance'
  | 'safety'
  | 'quality'
  | 'environment'
  | 'equipment'
  | 'other';

interface SmartFormData {
  title: string;
  category: Category | '';
  description: string;
  location: string;
  priority: Priority | '';
  imageFile: string | null;
  imageName: string;
}

interface AISmartFormProps {
  initialData?: Partial<SmartFormData>;
  onSave?: (data: SmartFormData) => void;
  onCancel?: () => void;
  variant?: 'dialog' | 'card' | 'inline';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

// ============================================================================
// Constants
// ============================================================================

const defaultFormData: SmartFormData = {
  title: '',
  category: '',
  description: '',
  location: '',
  priority: 'medium',
  imageFile: null,
  imageName: '',
};

const categoryOptions: { value: Category; label: string }[] = [
  { value: 'maintenance', label: '维护保养' },
  { value: 'safety', label: '安全隐患' },
  { value: 'quality', label: '质量问题' },
  { value: 'environment', label: '环境异常' },
  { value: 'equipment', label: '设备故障' },
  { value: 'other', label: '其他' },
];

const priorityOptions: { value: Priority; label: string; color: string }[] = [
  { value: 'low', label: '低', color: 'bg-green-500' },
  { value: 'medium', label: '中', color: 'bg-yellow-500' },
  { value: 'high', label: '高', color: 'bg-orange-500' },
  { value: 'critical', label: '紧急', color: 'bg-red-500' },
];

/** Mock data for voice recognition (inspection report scenario) */
const voiceMockData: Partial<SmartFormData> = {
  title: '3号车间空压机异响',
  category: 'equipment',
  description:
    '巡检发现3号车间B区空压机运行时有明显异响，疑似轴承磨损。设备运行温度偏高，建议尽快安排检修。',
  location: '3号车间B区',
  priority: 'high',
};

/** Mock data for image analysis (equipment fault scenario) */
const imageMockData: Partial<SmartFormData> = {
  title: '配电箱漏水损坏',
  category: 'safety',
  description:
    '配电箱外壳有明显水渍，内部线路有受潮迹象。可能由屋顶漏水导致，存在短路风险，需立即断电处理。',
  location: '1号仓库东侧',
  priority: 'critical',
};

// ============================================================================
// VoiceInputButton
// ============================================================================

type VoiceState = 'idle' | 'recording' | 'processing' | 'filled';

function VoiceInputButton({
  onResult,
}: {
  onResult: (data: Partial<SmartFormData>) => void;
}) {
  const [state, setState] = useState<VoiceState>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = useCallback(() => {
    if (state === 'recording') {
      // Stop recording early
      if (timerRef.current) clearTimeout(timerRef.current);
      setState('processing');
      timerRef.current = setTimeout(() => {
        onResult(voiceMockData);
        setState('filled');
        timerRef.current = setTimeout(() => setState('idle'), 2000);
      }, 1000);
      return;
    }

    if (state !== 'idle') return;

    setState('recording');
    // Auto-stop after 3 seconds
    timerRef.current = setTimeout(() => {
      setState('processing');
      timerRef.current = setTimeout(() => {
        onResult(voiceMockData);
        setState('filled');
        timerRef.current = setTimeout(() => setState('idle'), 2000);
      }, 1000);
    }, 3000);
  }, [state, onResult]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <Button
      type="button"
      variant={state === 'recording' ? 'destructive' : 'outline'}
      size="sm"
      onClick={handleClick}
      disabled={state === 'processing'}
      className={cn('gap-2', state === 'recording' && 'animate-pulse')}
    >
      {state === 'idle' && (
        <>
          <Mic className="size-4" />
          语音输入
        </>
      )}
      {state === 'recording' && (
        <>
          <MicOff className="size-4" />
          录制中...
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-red-500" />
          </span>
        </>
      )}
      {state === 'processing' && (
        <>
          <Loader2 className="size-4 animate-spin" />
          识别中...
        </>
      )}
      {state === 'filled' && (
        <>
          <Check className="size-4" />
          已填充
        </>
      )}
    </Button>
  );
}

// ============================================================================
// ImageUploadZone
// ============================================================================

type ImageState = 'empty' | 'uploading' | 'preview' | 'analyzing' | 'filled';

function ImageUploadZone({
  imageFile,
  imageName,
  onImageChange,
  onAnalyze,
}: {
  imageFile: string | null;
  imageName: string;
  onImageChange: (file: string | null, name: string) => void;
  onAnalyze: () => void;
}) {
  const [state, setState] = useState<ImageState>(
    imageFile ? 'preview' : 'empty',
  );
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const simulateUpload = useCallback(
    (file: File) => {
      setState('uploading');
      setProgress(0);

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        // Simulate upload progress
        let p = 0;
        const interval = setInterval(() => {
          p += 20;
          setProgress(p);
          if (p >= 100) {
            clearInterval(interval);
            onImageChange(dataUrl, file.name);
            setState('preview');
          }
        }, 150);
      };
      reader.readAsDataURL(file);
    },
    [onImageChange],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && file.type.startsWith('image/')) {
        simulateUpload(file);
      }
    },
    [simulateUpload],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith('image/')) {
        simulateUpload(file);
      }
    },
    [simulateUpload],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleRemove = useCallback(() => {
    onImageChange(null, '');
    setState('empty');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [onImageChange]);

  const handleAnalyze = useCallback(() => {
    setState('analyzing');
    timerRef.current = setTimeout(() => {
      onAnalyze();
      setState('filled');
      timerRef.current = setTimeout(() => setState('preview'), 2000);
    }, 2000);
  }, [onAnalyze]);

  if (state === 'empty') {
    return (
      <div
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors hover:border-primary hover:bg-muted/50"
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <Upload className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          点击或拖拽图片到此区域上传
        </p>
        <p className="text-xs text-muted-foreground">支持 JPG、PNG 格式</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>
    );
  }

  if (state === 'uploading') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border p-6">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm">上传中...</p>
        <Progress value={progress} className="w-full max-w-xs" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-lg border">
        <Image
          src={imageFile!}
          alt={imageName}
          className="h-48 w-full object-cover"
        />
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="absolute top-2 right-2 size-7"
          onClick={handleRemove}
        >
          <X className="size-4" />
        </Button>
        {state === 'filled' && (
          <div className="absolute bottom-2 left-2">
            <Badge variant="default" className="gap-1 bg-green-600">
              <Check className="size-3" />
              已分析
            </Badge>
          </div>
        )}
      </div>
      <p className="truncate text-xs text-muted-foreground">{imageName}</p>
      {(state === 'preview' || state === 'filled') && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={handleAnalyze}
          disabled={state === 'filled'}
        >
          {state === 'filled' ? (
            <>
              <Check className="size-4" />
              分析完成
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              AI 分析图片
            </>
          )}
        </Button>
      )}
      {state === 'analyzing' && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-2"
          disabled
        >
          <Loader2 className="size-4 animate-spin" />
          分析中...
        </Button>
      )}
    </div>
  );
}

// ============================================================================
// AISmartFormContent
// ============================================================================

function AISmartFormContent({
  formData,
  setFormData,
  onSave,
  onCancel,
}: {
  formData: SmartFormData;
  setFormData: React.Dispatch<React.SetStateAction<SmartFormData>>;
  onSave?: (data: SmartFormData) => void;
  onCancel?: () => void;
}) {
  const handleVoiceResult = useCallback(
    (data: Partial<SmartFormData>) => {
      setFormData((prev) => ({ ...prev, ...data }));
    },
    [setFormData],
  );

  const handleImageChange = useCallback(
    (file: string | null, name: string) => {
      setFormData((prev) => ({ ...prev, imageFile: file, imageName: name }));
    },
    [setFormData],
  );

  const handleImageAnalyze = useCallback(() => {
    setFormData((prev) => ({ ...prev, ...imageMockData }));
  }, [setFormData]);

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      onSave?.(formData);
    },
    [formData, onSave],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* AI Toolbar */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <span className="text-sm font-medium">AI 辅助工具</span>
        </div>
        <div className="flex flex-wrap gap-2 rounded-lg border bg-muted/30 p-3">
          <VoiceInputButton onResult={handleVoiceResult} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() =>
              document
                .getElementById('ai-form-image-section')
                ?.scrollIntoView({ behavior: 'smooth' })
            }
          >
            <ImageIcon className="size-4" />
            图片上传
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          ⓘ AI 功能为演示模拟，实际使用需接入真实 AI 服务
        </p>
      </div>

      <Separator />

      {/* Form Fields */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">标题</Label>
          <Input
            id="title"
            placeholder="请输入报告标题"
            value={formData.title}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, title: e.target.value }))
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">分类</Label>
          <Select
            value={formData.category}
            onValueChange={(value: Category) =>
              setFormData((prev) => ({ ...prev, category: value }))
            }
          >
            <SelectTrigger id="category">
              <SelectValue placeholder="选择分类" />
            </SelectTrigger>
            <SelectContent>
              {categoryOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">描述</Label>
          <Textarea
            id="description"
            placeholder="详细描述问题情况"
            rows={4}
            value={formData.description}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                description: e.target.value,
              }))
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">位置</Label>
          <Input
            id="location"
            placeholder="请输入位置信息"
            value={formData.location}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, location: e.target.value }))
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="priority">优先级</Label>
          <Select
            value={formData.priority}
            onValueChange={(value: Priority) =>
              setFormData((prev) => ({ ...prev, priority: value }))
            }
          >
            <SelectTrigger id="priority">
              <SelectValue placeholder="选择优先级" />
            </SelectTrigger>
            <SelectContent>
              {priorityOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <div className="flex items-center gap-2">
                    <span className={cn('size-2 rounded-full', opt.color)} />
                    {opt.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2" id="ai-form-image-section">
          <Label>附件</Label>
          <ImageUploadZone
            imageFile={formData.imageFile}
            imageName={formData.imageName}
            onImageChange={handleImageChange}
            onAnalyze={handleImageAnalyze}
          />
        </div>
      </div>

      <Separator />

      {/* Actions */}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            取消
          </Button>
        )}
        <Button type="submit" disabled={!formData.title.trim()}>
          提交报告
        </Button>
      </div>
    </form>
  );
}

// ============================================================================
// AISmartForm
// ============================================================================

export function AISmartForm({
  initialData,
  onSave,
  onCancel,
  variant = 'card',
  open,
  onOpenChange,
}: AISmartFormProps) {
  const [formData, setFormData] = useState<SmartFormData>({
    ...defaultFormData,
    ...initialData,
  });
  const prevInitialDataRef = useRef(initialData);

  useEffect(() => {
    if (prevInitialDataRef.current !== initialData) {
      setFormData({ ...defaultFormData, ...initialData });
      prevInitialDataRef.current = initialData;
    }
  }, [initialData]);

  const content = (
    <AISmartFormContent
      formData={formData}
      setFormData={setFormData}
      onSave={onSave}
      onCancel={onCancel}
    />
  );

  if (variant === 'dialog') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>智能报告表单</DialogTitle>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  if (variant === 'inline') {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">智能报告表单</h3>
        {content}
      </div>
    );
  }

  // Default: card
  return (
    <Card>
      <CardHeader>
        <CardTitle>智能报告表单</CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}

// ============================================================================
// Demo (default export)
// ============================================================================

export default function AISmartFormDemo() {
  const handleSave = useCallback((data: SmartFormData) => {
    logger.info('提交报告:', String(data));
  }, []);

  return (
    <div className="flex min-h-screen items-start justify-center bg-background p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-2xl">
        <AISmartForm variant="card" onSave={handleSave} />
      </div>
    </div>
  );
}

export type { SmartFormData, AISmartFormProps, Priority, Category };
