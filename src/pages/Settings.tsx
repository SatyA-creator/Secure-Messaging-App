import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { StorageIndicator } from '@/components/chat/StorageIndicator';
import { ArrowLeft, Shield, Database, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { localStore } from '@/lib/localStore';

export default function Settings() {
  const navigate = useNavigate();

  const handleClearAllData = async () => {
    if (confirm('⚠️ This will delete ALL your local messages and conversations. This cannot be undone. Continue?')) {
      try {
        await localStore.clearAllData();
        alert('✅ All local data has been cleared');
      } catch (error) {
        console.error('Failed to clear data:', error);
        alert('❌ Failed to clear data');
      }
    }
  };

  const handleResetEncryption = async () => {
    if (confirm('⚠️ This will clear your local messages. Your encryption keys are managed automatically. Continue?')) {
      try {
        await localStore.clearAllData();
        alert('✅ Local data has been cleared. Your encryption keys will be regenerated on next use.');
        window.location.reload();
      } catch (error) {
        console.error('Failed to reset:', error);
        alert('❌ Failed to reset');
      }
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>

        {/* Storage Section */}
        <StorageIndicator />

        {/* Privacy & Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Privacy & Security
            </CardTitle>
            <CardDescription>
              Manage your encryption and privacy settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <h3 className="font-medium">End-to-End Encryption</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  All messages are encrypted with ECDH + AES-256-GCM
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                  Active
                </span>
              </div>
            </div>

            <div className="flex items-start justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <h3 className="font-medium">Local Storage Only</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Messages are stored only on your device indefinitely
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  Enabled
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Data Management
            </CardTitle>
            <CardDescription>
              Manage your local data and encryption keys
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleResetEncryption}
            >
              <Shield className="w-4 h-4 mr-2" />
              Reset Encryption Keys
            </Button>

            <Button
              variant="destructive"
              className="w-full justify-start"
              onClick={handleClearAllData}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All Local Data
            </Button>
          </CardContent>
        </Card>

        {/* About */}
        <Card>
          <CardHeader>
            <CardTitle>About</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p><strong>Version:</strong> 1.0.0</p>
            <p><strong>Encryption:</strong> ECDH P-256 + AES-256-GCM</p>
            <p><strong>Storage:</strong> IndexedDB (QuChatDB)</p>
            <p><strong>Data Retention:</strong> Indefinite (manual deletion only)</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}