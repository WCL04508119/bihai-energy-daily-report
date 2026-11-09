import React, { useEffect, useRef, useState } from 'react';
import { renderAsync } from 'docx-preview';

interface FileDataState {
  data: ArrayBuffer | null;
  loading: boolean;
  error: string | null;
}

function useFileData(url: string): FileDataState {
  const [data, setData] = useState<ArrayBuffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch(url, { signal: controller.signal })
      .then((res: Response) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then((buf: ArrayBuffer) => setData(buf))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : '加载失败');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [url]);

  return { data, loading, error };
}

export const DocxDocumentPreview: React.FC<{ url: string }> = ({ url }) => {
  const { data, loading, error } = useFileData(url);
  if (loading) {
    return (
      <div className="p-4 text-center text-sm text-slate-500">
        正在加载文档...
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="p-4 text-center text-sm text-destructive">
        文档加载失败：{error ?? '未获取到文件内容'}
      </div>
    );
  }
  return <DocxRenderer data={data} />;
};

const DocxRenderer: React.FC<{ data: ArrayBuffer }> = ({ data }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = '';
    renderAsync(data, container, container, {
      className: 'docx-preview',
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
    }).catch(() => {
      if (containerRef.current) {
        containerRef.current.innerHTML =
          '<div class="p-4 text-center text-sm text-destructive">文档解析失败</div>';
      }
    });
  }, [data]);

  return <div ref={containerRef} className="w-full overflow-auto" />;
};