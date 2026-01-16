import React, { useRef, useState } from 'react';
import { Upload, X, File, Image, Video, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ENV } from '@/config/env';

interface MediaUploadProps {
  onMediaSelected: (files: File[]) => void;
  onUploadComplete?: (mediaData: any[]) => void;
}

const ALLOWED_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip', 'text/plain'],
  video: ['video/mp4', 'video/avi', 'video/quicktime', 'video/x-matroska', 'video/webm']
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function MediaUpload({ onMediaSelected, onUploadComplete }: MediaUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="w-4 h-4" />;
    if (type.startsWith('video/')) return <Video className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      const allAllowed = [...ALLOWED_TYPES.image, ...ALLOWED_TYPES.document, ...ALLOWED_TYPES.video];
      if (!allAllowed.includes(file.type)) {
        alert(`File type ${file.type} not allowed`);
        return false;
      }
      if (file.size > MAX_FILE_SIZE) {
        alert(`File ${file.name} is too large (max 50MB)`);
        return false;
      }
      return true;
    });

    setSelectedFiles(prev => [...prev, ...validFiles]);
    onMediaSelected(validFiles);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (messageId?: string) => {
    if (selectedFiles.length === 0) return [];

    setUploading(true);
    const token = localStorage.getItem('authToken');
    const uploadedMedia = [];

    for (const file of selectedFiles) {
      const formData = new FormData();
      formData.append('file', file);
      if (messageId) formData.append('message_id', messageId);

      try {
        const response = await fetch(`${ENV.API_URL}/media/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (response.ok) {
          const data = await response.json();
          uploadedMedia.push(data);
        }
      } catch (error) {
        console.error('Upload failed:', error);
      }
    }

    setUploading(false);
    setSelectedFiles([]);
    if (onUploadComplete) onUploadComplete(uploadedMedia);
    return uploadedMedia;
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*,.pdf,.doc,.docx,.txt,.zip"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        <Upload className="w-4 h-4" />
      </Button>

      {selectedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 p-2 bg-secondary/20 rounded-lg">
          {selectedFiles.map((file, index) => (
            <div key={index} className="flex items-center gap-2 bg-background p-2 rounded border">
              {getFileIcon(file.type)}
              <span className="text-xs max-w-[150px] truncate">{file.name}</span>
              <button
                onClick={() => removeFile(index)}
                className="text-destructive hover:text-destructive/80"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export { uploadFiles };
