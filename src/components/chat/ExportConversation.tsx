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
    setIsExporting(true);
    try {
      const messages = await localStore.getConversation(contactId);
      const markdown = conversationToMarkdown(messages);
      downloadMarkdown(markdown, `conversation-${contactName}-all.md`);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportByDate = async () => {
    setIsExporting(true);
    try {
      const messages = await localStore.getConversation(contactId);
      exportConversationByDate(contactId, messages);
    } catch (error) {
      console.error('Export by date failed:', error);
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
