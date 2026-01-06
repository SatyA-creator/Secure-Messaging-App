import React, { useState, useEffect } from 'react';
import { X, Users, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import api from '@/config/api';
import { useAuth } from '@/context/AuthContext';

interface Contact {
  id: string;
  username: string;
  email: string;
  full_name: string;
}

interface CreateGroupDialogProps {
  onClose: () => void;
  onGroupCreated?: (group: any) => void;
}

export function CreateGroupDialog({ onClose, onGroupCreated }: CreateGroupDialogProps) {
  const { user } = useAuth();
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      setLoadingContacts(true);
      setError('');
      
      if (!user?.id) {
        setError('User not authenticated');
        setLoadingContacts(false);
        return;
      }

      console.log('Loading contacts for user:', user.id);
      
      // Call the API endpoint with user_id parameter
      const response = await api.get(`/contacts?user_id=${user.id}`);
      
      console.log('Contacts response:', response);
      
      // Map the backend response format to frontend format
      const mappedContacts = (response.data || []).map((contact: any) => ({
        id: contact.contact_id,
        username: contact.contact_username,
        email: contact.contact_email,
        full_name: contact.contact_full_name || contact.contact_username
      }));
      
      console.log('Mapped contacts:', mappedContacts);
      setContacts(mappedContacts);
      setError('');
    } catch (err: any) {
      console.error('Error loading contacts:', err);
      const errorMessage = err?.message || 'Failed to load contacts. Please try again.';
      setError(errorMessage);
      setContacts([]);
    } finally {
      setLoadingContacts(false);
    }
  };

  const toggleMember = (contactId: string) => {
    const newSelected = new Set(selectedMembers);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedMembers(newSelected);
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      setError('Group name is required');
      return;
    }

    if (selectedMembers.size === 0) {
      setError('Please select at least one member');
      return;
    }

    if (selectedMembers.size > 10) {
      setError('Maximum 10 members allowed per group');
      return;
    }

    try {
      setLoading(true);
      setError('');

      console.log('Creating group with name:', groupName, 'and', selectedMembers.size, 'members');

      // Create the group using api.post
      const createUrl = `/groups/create?name=${encodeURIComponent(groupName)}${description ? `&description=${encodeURIComponent(description)}` : ''}`;
      const groupResponse = await api.post(createUrl);
      const groupData = groupResponse.data;

      console.log('✅ Group created:', groupData);

      // Add selected members to the group
      const memberPromises = Array.from(selectedMembers).map(async (memberId) => {
        try {
          const addUrl = `/groups/add-member/${groupData.group_id}?user_id=${memberId}`;
          await api.post(addUrl);
          console.log('✅ Added member:', memberId);
        } catch (err) {
          console.error('Failed to add member:', memberId, err);
        }
      });

      await Promise.all(memberPromises);
      console.log('✅ All members added to group');

      // Notify parent component
      if (onGroupCreated) {
        onGroupCreated({
          id: groupData.group_id,
          name: groupData.name,
          description: groupData.description,
          admin_id: groupData.admin_id,
          memberCount: selectedMembers.size + 1, // +1 for admin
          created_at: groupData.created_at
        });
      }

      onClose();
    } catch (err: any) {
      console.error('Error creating group:', err);
      const errorMsg = err?.message || err?.response?.data?.detail || err?.toString() || 'Failed to create group';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = contacts.filter(contact =>
    contact.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Create Group Chat</h2>
              <p className="text-sm text-gray-500">Maximum 10 members</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Group Details */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Group Name *
              </label>
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Enter group name"
                maxLength={50}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Description (Optional)
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this group about?"
                maxLength={200}
                rows={3}
              />
            </div>
          </div>

          {/* Members Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Add Members ({selectedMembers.size}/10)
            </label>
            
            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search contacts..."
                className="pl-10"
              />
            </div>

            {/* Contacts List */}
            <div className="border rounded-lg max-h-64 overflow-y-auto">
              {loadingContacts ? (
                <div className="p-4 text-center text-gray-500">
                  Loading contacts...
                </div>
              ) : error && contacts.length === 0 ? (
                <div className="p-4 text-center">
                  <div className="text-red-600 mb-2">{error}</div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={loadContacts}
                  >
                    Retry
                  </Button>
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  {searchQuery ? 'No contacts match your search' : 'No contacts available'}
                </div>
              ) : (
                filteredContacts.map(contact => (
                  <label
                    key={contact.id}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                  >
                    <Checkbox
                      checked={selectedMembers.has(contact.id)}
                      onCheckedChange={() => toggleMember(contact.id)}
                      disabled={!selectedMembers.has(contact.id) && selectedMembers.size >= 10}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{contact.full_name}</div>
                      <div className="text-sm text-gray-500">@{contact.username}</div>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Only show creation errors, not loading errors */}
          {error && !loadingContacts && contacts.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateGroup} 
            disabled={loading || !groupName.trim() || selectedMembers.size === 0}
          >
            {loading ? 'Creating...' : 'Create Group'}
          </Button>
        </div>
      </div>
    </div>
  );
}
