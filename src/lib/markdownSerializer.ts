import matter from 'gray-matter';
import { LocalMessage } from './localStore';

/* ============================================================
   Validation Helpers
============================================================ */

function assertMessageValid(message: LocalMessage) {
  if (!message) throw new Error('Message is null or undefined');

  if (!message.id) throw new Error('Missing message.id');
  if (!message.from) throw new Error('Missing message.from');
  if (!message.to) throw new Error('Missing message.to');
  if (!message.timestamp) throw new Error('Missing message.timestamp');

  if (message.content === null || message.content === undefined) {
    throw new Error('Message content is null or undefined');
  }
  
  // Log the message structure for debugging
  console.log('✅ Message valid:', {
    id: message.id,
    from: message.from,
    to: message.to,
    timestamp: message.timestamp,
    contentLength: typeof message.content === 'string' ? message.content.length : 'not a string'
  });
}

/* ============================================================
   Message → Markdown
============================================================ */

export function messageToMarkdown(message: LocalMessage): string {
  try {
    assertMessageValid(message);

    const safeContent =
      typeof message.content === 'string'
        ? message.content
        : JSON.stringify(message.content, null, 2);

    const frontmatter: Record<string, any> = {
      id: message.id,
      from: message.from,
      to: message.to,
      timestamp: new Date(message.timestamp).toISOString(),
      sig: message.signature ?? 'UNSIGNED',
      // Cryptographic metadata for algorithm agility
      cryptoVersion: message.cryptoVersion ?? 'v1',
      encryptionAlgorithm: message.encryptionAlgorithm ?? 'ECDH-AES256-GCM',
      kdfAlgorithm: message.kdfAlgorithm ?? 'HKDF-SHA256',
    };
    
    // Include multi-signature data if present
    if (message.signatures && message.signatures.length > 0) {
      frontmatter.signatures = JSON.stringify(message.signatures);
    }

    console.log('📝 Creating markdown with frontmatter:', frontmatter);
    
    // Manual markdown generation (more reliable than gray-matter)
    const yamlFrontmatter = Object.entries(frontmatter)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
    
    const markdown = `---\n${yamlFrontmatter}\n---\n\n${safeContent}`;
    
    console.log('✅ Markdown created, length:', markdown.length);
    return markdown;

  } catch (error) {
    console.error('❌ messageToMarkdown FAILED:', error instanceof Error ? error.message : error);
    console.error('   Error stack:', error instanceof Error ? error.stack : 'no stack');
    console.error('   Message object:', message);
    throw error;
  }
}

/* ============================================================
   Markdown → Message
============================================================ */

export function markdownToMessage(markdown: string): Partial<LocalMessage> {
  try {
    const parsed = matter(markdown);

    const message: Partial<LocalMessage> = {
      id: parsed.data.id,
      from: parsed.data.from,
      to: parsed.data.to,
      timestamp: parsed.data.timestamp,
      signature:
        parsed.data.sig && parsed.data.sig !== 'UNSIGNED'
          ? parsed.data.sig
          : undefined,
      content: parsed.content.trim(),
      // Parse cryptographic metadata (with backward compatibility)
      cryptoVersion: parsed.data.cryptoVersion,
      encryptionAlgorithm: parsed.data.encryptionAlgorithm,
      kdfAlgorithm: parsed.data.kdfAlgorithm,
    };
    
    // Parse multi-signature array if present
    if (parsed.data.signatures) {
      try {
        message.signatures = typeof parsed.data.signatures === 'string' 
          ? JSON.parse(parsed.data.signatures) 
          : parsed.data.signatures;
      } catch (e) {
        console.warn('Failed to parse signatures, skipping:', e);
      }
    }
    
    return message;
  } catch (error) {
    console.group('❌ markdownToMessage FAILED');
    console.error('Markdown:', markdown);
    console.error(error);
    console.groupEnd();
    throw error;
  }
}

/* ============================================================
   Conversation → Markdown
============================================================ */

export function conversationToMarkdown(
  messages: LocalMessage[],
  date?: string
): string {
  console.group(`📝 Exporting ${messages.length} messages`);

  const header = `# Conversation Export${date ? ` - ${date}` : ''}\n\n`;
  const successful: string[] = [];
  const failed: any[] = [];

  messages.forEach((msg, idx) => {
    try {
      console.log(`▶️ Converting ${idx + 1}/${messages.length}`, msg.id);
      console.log('   Message structure:', JSON.stringify(msg, null, 2));
      successful.push(messageToMarkdown(msg));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ Message ${idx + 1} (${msg.id}) FAILED:`, errorMsg);
      console.error('   Failed message object:', JSON.stringify(msg, null, 2));
      failed.push({ index: idx, id: msg.id, error: errorMsg, message: msg });
    }
  });

  if (failed.length) {
    console.warn(`⚠️ Failed Messages: ${failed.length}/${messages.length}`);
  }

  console.log(`✅ Exported ${successful.length}/${messages.length} messages`);
  console.groupEnd();

  if (!successful.length) {
    throw new Error('No messages could be exported');
  }

  return header + successful.join('\n\n---\n\n');
}

/* ============================================================
   Group Messages By Date
============================================================ */

export function groupMessagesByDate(
  messages: LocalMessage[]
): Map<string, LocalMessage[]> {
  const grouped = new Map<string, LocalMessage[]>();

  messages.forEach(msg => {
    const date = new Date(msg.timestamp).toISOString().split('T')[0];
    if (!grouped.has(date)) grouped.set(date, []);
    grouped.get(date)!.push(msg);
  });

  return grouped;
}

/* ============================================================
   Download Markdown File
============================================================ */

export function downloadMarkdown(content: string, filename: string): void {
  try {
    if (!content || !content.trim()) {
      throw new Error('Markdown content is empty');
    }

    const blob = new Blob([content], {
      type: 'text/markdown;charset=utf-8',
    });

    if (!blob.size) {
      throw new Error('Generated blob is empty');
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log('📥 Download started:', filename);

  } catch (error) {
    console.group('❌ downloadMarkdown FAILED');
    console.error('Filename:', filename);
    console.error(error);
    console.groupEnd();
    throw error;
  }
}

/* ============================================================
   Export Conversation (Grouped By Date)
============================================================ */

export function exportConversationByDate(
  conversationId: string,
  messages: LocalMessage[]
): void {
  try {
    const grouped = groupMessagesByDate(messages);

    grouped.forEach((msgs, date) => {
      const markdown = conversationToMarkdown(msgs, date);
      downloadMarkdown(
        markdown,
        `conversation-${conversationId}-${date}.md`
      );
    });

    console.log(
      `📦 Exported ${grouped.size} file(s) for conversation ${conversationId}`
    );
  } catch (error) {
    console.group('🚨 exportConversationByDate FAILED');
    console.error(error);
    console.groupEnd();
    throw error;
  }
}

/* ============================================================
   Import Messages From Markdown
============================================================ */

export function importFromMarkdown(
  markdownContent: string
): Partial<LocalMessage>[] {
  const sections = markdownContent.split(/\n\n---\n\n/);
  const messages: Partial<LocalMessage>[] = [];

  sections.forEach(section => {
    if (!section.trim() || section.trim().startsWith('#')) return;

    try {
      messages.push(markdownToMessage(section));
    } catch (error) {
      console.warn('⚠️ Skipped invalid markdown section', error);
    }
  });

  return messages;
}
