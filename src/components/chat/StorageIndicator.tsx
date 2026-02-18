import { useEffect, useState } from 'react';
import { localStore } from '@/lib/localStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HardDrive, Trash2, Clock, AlertCircle } from 'lucide-react';

interface StorageStats {
  totalMessages: number;
  totalConversations: number;
  unsyncedMessages: number;
  expiringSoon: number;
  retentionDays: number;
}

export function StorageIndicator() {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadStats = async () => {
    try {
      const data = await localStore.getStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load storage stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCleanup = async () => {
    try {
      const deleted = await localStore.cleanupExpiredMessages();
      alert(`✅ Cleaned up ${deleted} expired messages`);
      await loadStats();
    } catch (error) {
      console.error('Failed to cleanup:', error);
      alert('❌ Cleanup failed');
    }
  };

  useEffect(() => {
    loadStats();
    
    // Refresh stats every minute
    const interval = setInterval(loadStats, 60000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading || !stats) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="w-5 h-5" />
          Local Storage
        </CardTitle>
        <CardDescription>
          Messages are stored locally on your device
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Storage Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">Messages</span>
            <span className="text-2xl font-bold">{stats.totalMessages}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">Conversations</span>
            <span className="text-2xl font-bold">{stats.totalConversations}</span>
          </div>
        </div>

        {/* Auto-Delete Info */}
        <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
          <Clock className="w-4 h-4 mt-0.5 text-blue-600" />
          <div className="flex-1">
            <p className="text-sm font-medium">Auto-Delete Enabled</p>
            <p className="text-xs text-muted-foreground">
              Messages older than {stats.retentionDays} days are automatically deleted
            </p>
          </div>
        </div>

        {/* Expiring Soon Warning */}
        {stats.expiringSoon > 0 && (
          <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertCircle className="w-4 h-4 mt-0.5 text-yellow-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-900">
                {stats.expiringSoon} message{stats.expiringSoon > 1 ? 's' : ''} expiring soon
              </p>
              <p className="text-xs text-yellow-700">
                Will be deleted within 7 days
              </p>
            </div>
          </div>
        )}

        {/* Unsynced Messages */}
        {stats.unsyncedMessages > 0 && (
          <Badge variant="outline" className="w-full justify-center">
            {stats.unsyncedMessages} unsynced message{stats.unsyncedMessages > 1 ? 's' : ''}
          </Badge>
        )}

        {/* Manual Cleanup Button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handleCleanup}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Clean Up Expired Messages
        </Button>
      </CardContent>
    </Card>
  );
}
