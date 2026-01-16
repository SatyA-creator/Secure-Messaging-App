import React from 'react';
import { Download, File, Image as ImageIcon, Video, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MediaAttachment {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
  category: string;
}

interface MediaPreviewProps {
  media: MediaAttachment[];
}

export function MediaPreview({ media }: MediaPreviewProps) {
  if (!media || media.length === 0) return null;

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (category: string) => {
    switch (category) {
      case 'image': return <ImageIcon className="w-4 h-4" />;
      case 'video': return <Video className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const handleDownload = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  return (
    <div className="space-y-2 mt-2">
      {media.map((item) => (
        <div key={item.id}>
          {item.category === 'image' ? (
            <div className="relative group">
              <img
                src={item.file_url}
                alt={item.file_name}
                className="max-w-xs max-h-64 rounded-lg cursor-pointer hover:opacity-90"
                onClick={() => window.open(item.file_url, '_blank')}
              />
              <Button
                size="icon"
                variant="secondary"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleDownload(item.file_url, item.file_name)}
              >
                <Download className="w-4 h-4" />
              </Button>
            </div>
          ) : item.category === 'video' ? (
            <video
              src={item.file_url}
              controls
              className="max-w-xs max-h-64 rounded-lg"
            />
          ) : (
            <div className="flex items-center gap-3 p-3 bg-secondary/20 rounded-lg max-w-xs">
              {getFileIcon(item.category)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.file_name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(item.file_size)}</p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleDownload(item.file_url, item.file_name)}
              >
                <Download className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
