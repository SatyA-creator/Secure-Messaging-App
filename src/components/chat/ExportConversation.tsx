import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText, Upload } from 'lucide-react';
import { localStore } from '@/lib/localStore';
import { 
  conversationToMarkdown, 
  downloadMarkdown, 
  exportConversationByDate
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
      
      console.log('📥 Starting markdown import...');
      console.log('📄 File content length:', text.length);
      
      // Split by message boundaries (matching the export format: \n\n---\n\n)
      const messageSections = text.split(/\n\n---\n\n/);
      console.log(`📦 Found ${messageSections.length} message sections`);
      
      let imported = 0;
      let skipped = 0;
      
      for (const section of messageSections) {
        const trimmedSection = section.trim();
        
        // Skip empty sections or header
        if (!trimmedSection || trimmedSection.includes('# Conversation Export')) {
          console.log('⏭️ Skipping header or empty section');
          continue;
        }
        
        // Ensure the section has proper frontmatter delimiters
        const messageMarkdown = trimmedSection.startsWith('---') 
          ? trimmedSection 
          : `---\n${trimmedSection}`;
        
        try {
          // Use the existing markdownToMessage parser
          const { markdownToMessage } = await import('@/lib/markdownSerializer');
          const parsedMsg = markdownToMessage(messageMarkdown);
          
          // ⚠️ SECURITY: Only log metadata, not content
          console.log(`📨 Parsed message ${parsedMsg.id}`);
          
          if (!parsedMsg.id || !parsedMsg.from || !parsedMsg.to) {
            console.warn('⚠️ Skipping invalid message - missing required fields:', parsedMsg);
            skipped++;
            continue;
          }
          
          // Clean content - remove "encrypted:" prefix if present
          let cleanContent = parsedMsg.content || '';
          if (cleanContent.startsWith('encrypted:')) {
            cleanContent = cleanContent.substring(10);
          }
          
          await localStore.saveMessage({
            id: parsedMsg.id,
            conversationId: contactId,
            from: parsedMsg.from,
            to: parsedMsg.to,
            timestamp: parsedMsg.timestamp || new Date().toISOString(),
            content: cleanContent,
            signature: parsedMsg.signature,
            synced: true,
            cryptoVersion: parsedMsg.cryptoVersion,
            encryptionAlgorithm: parsedMsg.encryptionAlgorithm,
            kdfAlgorithm: parsedMsg.kdfAlgorithm,
            signatures: parsedMsg.signatures
          });
          
          imported++;
          console.log(`✅ Imported message ${parsedMsg.id} (${imported} total)`);
        } catch (error) {
          console.warn('⚠️ Failed to import message section:', error);
          console.warn('   Section preview:', messageMarkdown.substring(0, 200));
          skipped++;
        }
      }
      
      setImportStatus({
        type: imported > 0 ? 'success' : 'error',
        message: imported > 0 
          ? `Imported ${imported} messages (${skipped} skipped/duplicates)` 
          : `No messages imported. ${skipped} skipped. Please check the file format.`
      });
      
      console.log(`✅ Import complete: ${imported} imported, ${skipped} skipped`);
      
      // Only reload if messages were actually imported
      if (imported > 0) {
        setTimeout(() => {
          // Refresh the page to reload messages from IndexedDB
          window.location.reload();
        }, 2000);
      }
      
    } catch (error) {
      console.error('❌ Import failed:', error);
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
        size="icon"
        onClick={() => setShowDialog(true)}
        className="text-muted-foreground hover:text-foreground w-8 h-8 md:w-10 md:h-10"
        title="Backup conversation"
      >
        <FileText className="w-4 h-4 md:w-5 md:h-5" />
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
