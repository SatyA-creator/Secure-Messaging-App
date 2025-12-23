import React from 'react';
import { useChat } from '@/context/ChatContext';
import { Contact } from '@/types/messaging';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { AddContactDialog } from './AddContactDialog';

function formatMessageTime(date: Date): string {
  if (isToday(date)) {
    return format(date, 'HH:mm');
  } else if (isYesterday(date)) {
    return 'Yesterday';
  } else {
    return format(date, 'MMM d');
  }
}

interface ContactListProps {
  onSelectContact?: () => void;
}

export function ContactList({ onSelectContact }: ContactListProps = {}) {
  const { contacts, selectedContactId, selectContact, markAsRead, addContact } = useChat();
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredContacts = contacts.filter(contact =>
    contact.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectContact = (contact: Contact) => {
    selectContact(contact.id);
    if (contact.unreadCount > 0) {
      markAsRead(contact.id);
    }
  };

  const handleAddContact = async (email: string, displayName?: string) => {
    try {
      await addContact(email, displayName);
    } catch (error) {
      throw error; // Re-throw to let the dialog handle the error
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 md:p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10 h-9 md:h-10 bg-secondary/30 text-sm"
          />
        </div>
        <AddContactDialog onAddContact={handleAddContact} />
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredContacts.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            No contacts found
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {filteredContacts.map(contact => (
              <ContactItem
                key={contact.id}
                contact={contact}
                isSelected={selectedContactId === contact.id}
                onClick={() => handleSelectContact(contact)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface ContactItemProps {
  contact: Contact;
  isSelected: boolean;
  onClick: () => void;
}

function ContactItem({ contact, isSelected, onClick }: ContactItemProps) {
  const { conversations } = useChat();
  const conversation = conversations[contact.id];
  const lastMessage = conversation?.messages[conversation.messages.length - 1];

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-xl transition-all duration-200",
        "hover:bg-secondary/80",
        isSelected && "bg-secondary"
      )}
    >
      <div className="relative flex-shrink-0">
        <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
          <span className="text-base md:text-lg font-medium text-primary">
            {contact.fullName.charAt(0).toUpperCase()}
          </span>
        </div>
        <span
          className={cn(
            "absolute bottom-0 right-0 w-3 h-3 md:w-3.5 md:h-3.5 rounded-full border-2 border-background",
            contact.isOnline ? "bg-green-500" : "bg-muted-foreground/50"
          )}
        />
      </div>

      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium truncate text-sm md:text-base">{contact.fullName}</span>
          {lastMessage && (
            <span className="text-[10px] md:text-xs text-muted-foreground flex-shrink-0">
              {formatMessageTime(lastMessage.createdAt)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs md:text-sm text-muted-foreground truncate">
            {contact.isTyping ? (
              <span className="text-primary italic">typing...</span>
            ) : (
              lastMessage?.decryptedContent?.replace(/^encrypted:/, '') || `@${contact.username}`
            )}
          </span>
          {contact.unreadCount > 0 && (
            <span className="flex-shrink-0 min-w-[1.25rem] h-4 md:h-5 px-1 md:px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] md:text-xs font-medium flex items-center justify-center">
              {contact.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
