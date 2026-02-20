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

  const handleDownload = async (url: string, filename: string) => {
    console.log('🔽 Starting download:', filename);
    console.log('📍 Download URL:', url);
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        mode: 'cors',
        credentials: 'include',
      });
      
      console.log('📡 Response:', response.status, response.statusText);
      
      if (!response.ok) {
        let errorDetail = `HTTP ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorDetail = errorData.detail || errorDetail;
        } catch {
          const errorText = await response.text();
          errorDetail = errorText || errorDetail;
        }
        throw new Error(errorDetail);
      }
      
      const blob = await response.blob();
      console.log('📦 Blob created:', blob.size, 'bytes, type:', blob.type);
      
      // Force download by creating a blob URL and triggering click
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename; // Force download with original filename
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
        console.log('✅ Download triggered:', filename);
      }, 100);
      
    } catch (error) {
      console.error('❌ Download failed:', error);
      console.error('❌ Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      let userMessage = 'Download failed';
      if (error instanceof Error) {
        if (error.message.includes('404') || error.message.includes('not found')) {
          userMessage = 'File not found on server. The file may have been deleted or the server was restarted (files in /tmp are temporary on Render).';
        } else if (error.message.includes('Failed to fetch')) {
          userMessage = 'Network error. Please check your connection and try again.';
        } else {
          userMessage = error.message;
        }
      }
      
      alert(`Failed to download ${filename}:\n\n${userMessage}`);
    }
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
                className="max-w-full md:max-w-sm max-h-96 rounded-lg cursor-pointer hover:opacity-95 transition-opacity object-contain bg-black/5"
                onClick={() => window.open(item.file_url, '_blank')}
              />
              {/* Download button overlay (visible on hover) */}
              <Button
                size="icon"
                variant="secondary"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                onClick={() => handleDownload(item.file_url, item.file_name)}
              >
                <Download className="w-4 h-4" />
              </Button>
              {/* Download button below image (always visible) */}
              <Button
                variant="outline"
                size="sm"
                className="mt-2 w-full"
                onClick={() => handleDownload(item.file_url, item.file_name)}
              >
                <Download className="w-4 h-4 mr-2" />
                Download Image
              </Button>
            </div>
          ) : item.category === 'video' ? (
            <div className="relative">
              <video
                src={item.file_url}
                controls
                className="max-w-full md:max-w-sm max-h-96 rounded-lg bg-black/5"
              />
              {/* Download button below video */}
              <Button
                variant="outline"
                size="sm"
                className="mt-2 w-full"
                onClick={() => handleDownload(item.file_url, item.file_name)}
              >
                <Download className="w-4 h-4 mr-2" />
                Download Video
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-secondary/20 rounded-lg max-w-sm">
              {getFileIcon(item.category)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.file_name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(item.file_size)}</p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleDownload(item.file_url, item.file_name)}
                title="Download file"
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
