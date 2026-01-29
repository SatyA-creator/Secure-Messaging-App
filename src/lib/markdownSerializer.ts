import matter from 'gray-matter';
import { LocalMessage } from './localStore';

/**
 * Convert a message object to Markdown format with frontmatter
 */
export function messageToMarkdown(message: LocalMessage): string {
  try {
    const frontmatter = {
      id: message.id,
      from: message.from,
      to: message.to,
      timestamp: message.timestamp,
      sig: message.signature || 'UNSIGNED',
    };

    // Create Markdown with frontmatter
    const markdown = matter.stringify(message.content, frontmatter);
    
    return markdown;
  } catch (error) {
    console.error('❌ Error converting message to markdown:', error, message);
    throw error;
  }
}

/**
 * Parse Markdown back to message object
 */
export function markdownToMessage(markdown: string): Partial<LocalMessage> {
  const parsed = matter(markdown);
  
  return {
    id: parsed.data.id,
    from: parsed.data.from,
    to: parsed.data.to,
    timestamp: parsed.data.timestamp,
    signature: parsed.data.sig !== 'UNSIGNED' ? parsed.data.sig : undefined,
    content: parsed.content.trim(),
    // conversationId will be determined by context
  };
}

/**
 * Export an entire conversation to Markdown file
 */
export function conversationToMarkdown(messages: LocalMessage[], date?: string): string {
  try {
    console.log('📝 Converting', messages.length, 'messages to markdown');
    const header = `# Conversation Export${date ? ` - ${date}` : ''}\n\n`;
    
    const messagesMarkdown = messages
      .map((msg, idx) => {
        try {
          console.log(`  Converting message ${idx + 1}/${messages.length}`, msg);
          const md = messageToMarkdown(msg);
          console.log(`  ✅ Message ${idx + 1} converted successfully`);
          return md;
        } catch (err) {
          console.error(`  ❌ Failed to convert message ${idx + 1}:`, err, msg);
          throw err;
        }
      })
      .join('\n\n---\n\n');
    
    console.log('✅ Markdown conversion complete, total length:', header.length + messagesMarkdown.length);
    return header + messagesMarkdown;
  } catch (error) {
    console.error('❌ Error in conversationToMarkdown:', error);
    throw error;
  }
}

/**
 * Group messages by date for daily Markdown files
 */
export function groupMessagesByDate(messages: LocalMessage[]): Map<string, LocalMessage[]> {
  const grouped = new Map<string, LocalMessage[]>();
  
  messages.forEach(msg => {
    const date = new Date(msg.timestamp).toISOString().split('T')[0];
    
    if (!grouped.has(date)) {
      grouped.set(date, []);
    }
    grouped.get(date)!.push(msg);
  });
  
  return grouped;
}

/**
 * Create downloadable Markdown file
 */
export function downloadMarkdown(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  console.log('📥 Markdown file downloaded:', filename);
}

/**
 * Export conversation as Markdown files (grouped by date)
 */
export function exportConversationByDate(
  conversationId: string,
  messages: LocalMessage[]
): void {
  const grouped = groupMessagesByDate(messages);
  
  grouped.forEach((msgs, date) => {
    const markdown = conversationToMarkdown(msgs, date);
    downloadMarkdown(markdown, `conversation-${conversationId}-${date}.md`);
  });
  
  console.log(`📦 Exported ${grouped.size} Markdown files for conversation ${conversationId}`);
}

/**
 * Import messages from Markdown file content
 */
export function importFromMarkdown(markdownContent: string): Partial<LocalMessage>[] {
  // Split by separator
  const sections = markdownContent.split(/\n---\n/);
  
  const messages: Partial<LocalMessage>[] = [];
  
  sections.forEach(section => {
    // Skip headers and empty sections
    if (section.trim().startsWith('#') || !section.trim()) {
      return;
    }
    
    try {
      const msg = markdownToMessage(section);
      messages.push(msg);
    } catch (error) {
      console.warn('Failed to parse message section:', error);
    }
  });
  
  return messages;
}
