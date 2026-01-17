import { ENV } from '@/config/env';

export interface UploadResult {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
  category: string;
}

export class MediaService {
  private static getAuthToken(): string {
    const token = localStorage.getItem('authToken');
    if (!token) throw new Error('No authentication token found');
    return token;
  }

  static async uploadFile(file: File, messageId?: string): Promise<UploadResult> {
    const formData = new FormData();
    formData.append('file', file);
    if (messageId) formData.append('message_id', messageId);

    const response = await fetch(`${ENV.API_URL}/media/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.getAuthToken()}`
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Upload failed');
    }

    return response.json();
  }

  static async uploadMultiple(files: File[], messageId?: string): Promise<UploadResult[]> {
    const uploads = files.map(file => this.uploadFile(file, messageId));
    return Promise.all(uploads);
  }

  static async getMessageMedia(messageId: string): Promise<UploadResult[]> {
    const response = await fetch(`${ENV.API_URL}/media/message/${messageId}`, {
      headers: {
        'Authorization': `Bearer ${this.getAuthToken()}`
      }
    });

    if (!response.ok) throw new Error('Failed to fetch media');
    return response.json();
  }

  static async deleteMedia(mediaId: string): Promise<void> {
    const response = await fetch(`${ENV.API_URL}/media/${mediaId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.getAuthToken()}`
      }
    });

    if (!response.ok) throw new Error('Failed to delete media');
  }

  static getFileUrl(filename: string): string {
    return `${ENV.API_URL}/media/files/${filename}`;
  }

  static formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  static getFileCategory(filename: string): 'image' | 'video' | 'document' | 'other' {
    const ext = filename.split('.').pop()?.toLowerCase();
    
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
    const videoExts = ['mp4', 'avi', 'mov', 'mkv', 'webm'];
    const docExts = ['pdf', 'doc', 'docx', 'txt', 'zip', 'rar'];

    if (ext && imageExts.includes(ext)) return 'image';
    if (ext && videoExts.includes(ext)) return 'video';
    if (ext && docExts.includes(ext)) return 'document';
    return 'other';
  }

  static isValidFileType(filename: string): boolean {
    const category = this.getFileCategory(filename);
    return category !== 'other';
  }

  static validateFile(file: File, maxSize: number = 50 * 1024 * 1024): { valid: boolean; error?: string } {
    if (!this.isValidFileType(file.name)) {
      return { valid: false, error: 'File type not supported' };
    }

    if (file.size > maxSize) {
      return { valid: false, error: `File too large (max ${this.formatFileSize(maxSize)})` };
    }

    return { valid: true };
  }
}
