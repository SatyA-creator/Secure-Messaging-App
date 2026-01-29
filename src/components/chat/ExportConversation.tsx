import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText } from 'lucide-react';
import { localStore } from '@/lib/localStore';
import { 
  conversationToMarkdown, 
  downloadMarkdown, 
  exportConversationByDate 
} from '@/lib/markdownSerializer';

interface ExportConversationProps {
  contactId: string;
  contactName: string;
}

export function ExportConversation({ contactId, contactName }: ExportConversationProps) {
  const [isExporting, setIsExporting] = useState(false);

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

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleExportAll}
        disabled={isExporting}
        className="flex items-center gap-2"
      >
        <FileText className="h-4 w-4" />
        Export (Single File)
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        onClick={handleExportByDate}
        disabled={isExporting}
        className="flex items-center gap-2"
      >
        <Download className="h-4 w-4" />
        Export (By Date)
      </Button>
    </div>
  );
}
