import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText, Upload } from 'lucide-react';
import { localStore } from '@/lib/localStore';
import { 
  conversationToMarkdown, 
  downloadMarkdown, 
  exportConversationByDate,
  markdownToMessages
} from '@/lib/markdownSerializer';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface ExportConversationProps {
  contactId: string;
  contactName: string;
}

export function ExportConversation({ contactId, contactName }: ExportConversationProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportAll = async () => {
    console.log('🔵 Export All clicked for:', contactId, contactName);
    setIsExporting(true);
    try {
      const messages = await localStore.getConversation(contactId);
      console.log('📊 Got messages for export:', messages.length);
      
      // Debug: Log first message structure
      if (messages.length > 0) {
        console.log('🔍 First message structure:', JSON.stringify(messages[0], null, 2));
      }
      
      const markdown = conversationToMarkdown(messages);
      console.log('📝 Generated markdown, length:', markdown.length);
      downloadMarkdown(markdown, `conversation-${contactName}-all.md`);
    } catch (error) {
      console.error('❌ Export failed:', error);
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportByDate = async () => {
    console.log('🔵 Export By Date clicked for:', contactId, contactName);
    setIsExporting(true);
    try {
      const messages = await localStore.getConversation(contactId);
      console.log('📊 Got messages for export:', messages.length);
      exportConversationByDate(contactId, messages);
    } catch (error) {
      console.error('❌ Export by date failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImportStatus(null);
      const text = await file.text();
      
      // Parse markdown to messages
      const parsedMessages = markdownToMessages(text);
      console.log(`📥 Parsed ${parsedMessages.length} messages from markdown`);
      
      let imported = 0;
      let skipped = 0;
      
      // Import each message
      for (const msg of parsedMessages) {
        try {
          await localStore.saveMessage({
            id: msg.id,
            conversationId: contactId,
            from: msg.from || contactId, // Default to contact if not specified
            to: msg.to || '',
            timestamp: msg.timestamp,
            content: msg.content,
            signature: undefined,
            synced: true
          });
          imported++;
        } catch (error) {
          skipped++;
        }
      }
      
      setImportStatus({
        type: 'success',
        message: `Imported ${imported} messages (${skipped} duplicates skipped)`
      });
      
      // Reload after 2 seconds
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (error) {
      setImportStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Import failed'
      });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowDialog(true)}
        className="gap-2"
      >
        <FileText className="h-4 w-4" />
        <span className="hidden sm:inline">Backup</span>
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Conversation Backup</DialogTitle>
            <DialogDescription>
              Export or import your conversation with {contactName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Export Section */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Download className="w-5 h-5 text-blue-500" />
                <h3 className="font-semibold">Export Chat</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Download conversation as markdown file(s)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportAll}
                  disabled={isExporting}
                  className="flex-1"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Single File
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportByDate}
                  disabled={isExporting}
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" />
                  By Date
                </Button>
              </div>
            </div>

            {/* Import Section */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-green-500" />
                <h3 className="font-semibold">Import Chat</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Restore messages from a markdown backup file
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".md,.txt"
                onChange={handleImport}
                className="hidden"
                id="import-file-md"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <Upload className="w-4 h-4 mr-2" />
                Import from File
              </Button>
              {importStatus && (
                <Alert variant={importStatus.type === 'success' ? 'default' : 'destructive'}>
                  {importStatus.type === 'success' ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <AlertDescription>{importStatus.message}</AlertDescription>
                </Alert>
              )}
            </div>

            {/* Info */}
            <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
              <p className="font-semibold mb-1">Privacy Note:</p>
              <p>
                Backups are stored only on your device. Share backup files securely.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
