import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { ContactList } from './ContactList';
import { ConnectionStatus } from './ConnectionStatus';
import { Shield, Settings, LogOut, UserPlus, Crown, Users, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SendInvitation } from '@/components/SendInvitation';
import { ManageUsers } from './ManageUsers';
import { CreateGroupDialog } from './CreateGroupDialog';
import { Badge } from '@/components/ui/badge';
import api from '@/config/api';
import WebSocketService from '@/lib/websocket';

interface SidebarProps {
  onSelectContact?: () => void;
}

export function Sidebar({ onSelectContact }: SidebarProps = {}) {
  const { user, logout } = useAuth();
  const { selectGroup, selectedGroupId } = useChat();
  const navigate = useNavigate();
  const [showInvitation, setShowInvitation] = useState(false);
  const [showManageUsers, setShowManageUsers] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groups, setGroups] = useState<any[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const isAdmin = user?.role === 'admin';

  // Load groups when component mounts and user changes
  useEffect(() => {
    console.log('🔄 Sidebar useEffect triggered, user:', user?.id);
    
    if (user?.id) {
      console.log('✅ User is authenticated, loading groups...');
      loadGroups();
      
      // Listen for group-related WebSocket events
      const wsService = WebSocketService.getInstance();
      
      // 🔥 FIX: Separate handlers for different events
      const handleAddedToGroup = (data: any) => {
        console.log('🎉 You were added to group:', data);
        console.log('   Group:', data.group_name);
        console.log('   Added by:', data.added_by);
        console.log('   Group ID:', data.group_id);
        
        // Immediately reload groups when added to a group
        setTimeout(() => {
          console.log('🔄 Reloading groups after being added...');
          loadGroups();
        }, 500); // Small delay to ensure backend has committed
      };
      
      const handleMemberAdded = (data: any) => {
        console.log('👥 Member added to group:', data);
        // Only reload if it's a group we're already in
        if (groups.some(g => g.id === data.group_id)) {
          loadGroups();
        }
      };
      
      const handleGroupCreated = (data: any) => {
        console.log('🆕 Group created:', data);
        loadGroups();
      };
      
      const handleGroupUpdated = (data: any) => {
        console.log('🔄 Group updated:', data);
        loadGroups();
      };
      
      const handleGroupDeleted = (data: any) => {
        console.log('🗑️ Group deleted:', data);
        console.log('   Group:', data.group_name);
        console.log('   Deleted by:', data.deleted_by);
        
        // Remove from local state
        setGroups(prev => prev.filter(g => g.id !== data.group_id));
        
        // If this was the selected group, clear selection
        if (selectedGroupId === data.group_id) {
          selectGroup(''); // Clear the selection
        }
      };
      
      // Register listeners for group events
      wsService.on('added_to_group', handleAddedToGroup);
      wsService.on('member_added', handleMemberAdded);
      wsService.on('group_created', handleGroupCreated);
      wsService.on('group_updated', handleGroupUpdated);
      wsService.on('group_deleted', handleGroupDeleted);
      
      // Cleanup listeners on unmount
      return () => {
        console.log('🧹 Cleaning up WebSocket listeners...');
        wsService.off('added_to_group', handleAddedToGroup);
        wsService.off('member_added', handleMemberAdded);
        wsService.off('group_created', handleGroupCreated);
        wsService.off('group_updated', handleGroupUpdated);
        wsService.off('group_deleted', handleGroupDeleted);
      };
    } else {
      console.log('⚠️ User not authenticated yet, skipping group load');
    }
  }, [user?.id]); // Only depend on user.id

  const loadGroups = async () => {
    // Prevent multiple simultaneous loads
    if (isLoadingGroups) {
      console.log('⏳ Already loading groups, skipping...');
      return;
    }

    try {
      setIsLoadingGroups(true);
      console.log('📋 Loading groups for user:', user?.id);
      console.log('🔍 Making API call to GET /groups/...');
      
      const response = await api.get('/groups/');
      
      console.log('✅ API Response received');
      console.log('📦 Response status:', response.status);
      console.log('📦 Response data:', response.data);
      
      // Ensure we have an array
      const groupsData = Array.isArray(response.data) 
        ? response.data 
        : (response.data?.groups || []);
      
      console.log(`✅ Total groups loaded: ${groupsData.length}`);
      
      if (groupsData.length > 0) {
        console.log('📋 Groups:', groupsData.map((g: any) => 
          `${g.name} (${g.memberCount} members, Admin: ${g.is_admin})`
        ).join(', '));
      } else {
        console.log('⚠️ No groups found - user may not be member of any groups yet');
      }
      
      setGroups(groupsData);
      console.log('✅ Groups state updated, count:', groupsData.length);
      
    } catch (err: any) {
      console.error('❌ Error loading groups:', err);
      console.error('   Status:', err.response?.status);
      console.error('   Data:', err.response?.data);
      console.error('   Message:', err.message);
      
      // Don't clear groups on error, keep existing ones
      setGroups(prev => prev);
    } finally {
      setIsLoadingGroups(false);
    }
  };

  const handleDeleteGroup = async (groupId: string, groupName: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent group selection when clicking delete
    
    if (!window.confirm(`Are you sure you want to delete "${groupName}"? This action cannot be undone.`)) {
      return;
    }
    
    try {
      console.log('🗑️ Deleting group:', groupId);
      await api.delete(`/groups/${groupId}`);
      
      console.log('✅ Group deleted successfully');
      
      // Remove from local state immediately
      setGroups(prev => prev.filter(g => g.id !== groupId));
      
      // If this was the selected group, clear selection
      if (selectedGroupId === groupId) {
        selectGroup(''); // Clear the selection by passing empty string
      }
      
    } catch (err: any) {
      console.error('❌ Error deleting group:', err);
      alert(`Failed to delete group: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleGroupCreated = async (newGroup: any) => {
    console.log('🎉 Group created callback:', newGroup);
    
    // ✅ FIX 1: Optimistic UI update - add immediately
    const createdGroup = {
      id: newGroup.group_id || newGroup.id,
      name: newGroup.name,
      description: newGroup.description || '',
      memberCount: newGroup.memberCount || 1,
      admin_id: newGroup.admin_id || user?.id,
      created_at: newGroup.created_at || new Date().toISOString(),
      is_admin: true // Creator is always admin
    };
    
    // Add to local state immediately for instant feedback
    setGroups(prev => {
      const groupExists = prev.some(g => g.id === createdGroup.id);
      if (!groupExists) {
        console.log('✅ Added new group to local state:', createdGroup.name);
        return [createdGroup, ...prev];
      }
      console.log('⚠️ Group already exists in state');
      return prev;
    });
    
    // ✅ FIX 2: Reload from server after short delay
    setTimeout(async () => {
      console.log('🔄 Syncing groups with server...');
      await loadGroups();
      
      // ✅ FIX 3: Select the newly created group
      const groupId = newGroup.group_id || newGroup.id;
      if (groupId) {
        setTimeout(() => {
          console.log('🎯 Auto-selecting newly created group:', groupId);
          selectGroup(groupId);
          if (onSelectContact) onSelectContact();
        }, 200);
      }
    }, 800); // 800ms delay for backend commit
  };

  return (
    <div className="w-full border-r border-border bg-card/30 flex flex-col h-full">
      {/* Header */}
      <div className="p-3 md:p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="w-4 h-4 md:w-5 md:h-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-bold text-base md:text-lg">QuantChat</h1>
              {isAdmin && (
                <Badge variant="default" className="h-5 px-1.5 text-xs">
                  <Crown className="w-3 h-3 mr-1" />
                  Admin
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">E2E Encrypted</p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="w-8 h-8 md:w-10 md:h-10">
              <Settings className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="font-medium text-sm">{user?.fullName}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
              {isAdmin && (
                <Badge variant="outline" className="mt-1 h-5 px-1.5 text-xs">
                  Administrator
                </Badge>
              )}
            </div>
            <DropdownMenuSeparator />
            {isAdmin && (
              <>
                <DropdownMenuItem onClick={() => setShowInvitation(true)}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Invite User
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowManageUsers(true)}>
                  <Users className="w-4 h-4 mr-2" />
                  Manage Users
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Action Bar — Create Group + (admin) quick actions */}
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <Button
          onClick={() => setShowCreateGroup(true)}
          className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 h-8 text-xs"
          size="sm"
          disabled={isLoadingGroups}
        >
          <Users className="w-3.5 h-3.5 mr-1.5" />
          New Group
        </Button>
        {isAdmin && (
          <>
            <Button
              onClick={() => setShowInvitation(true)}
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0 flex-shrink-0"
              title="Invite User"
            >
              <UserPlus className="w-3.5 h-3.5" />
            </Button>
            <Button
              onClick={() => setShowManageUsers(true)}
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0 flex-shrink-0"
              title="Manage Users"
            >
              <Users className="w-3.5 h-3.5" />
            </Button>
          </>
        )}
      </div>

      {/* Groups List */}
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center justify-between mb-2 px-1">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Groups ({groups.length})
          </h3>
          {isLoadingGroups && (
            <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          )}
        </div>

        {groups.length === 0 ? (
          <div className="text-center py-3 px-2">
            <p className="text-xs text-muted-foreground">
              {isLoadingGroups ? 'Loading...' : 'No groups yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
            {groups.map(group => (
              <div
                key={group.id}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent transition-colors group/item"
              >
                <button
                  className="flex items-center gap-2 flex-1 min-w-0 text-left"
                  onClick={() => {
                    selectGroup(group.id);
                    if (onSelectContact) onSelectContact();
                  }}
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                      {group.name.charAt(0).toUpperCase()}
                    </div>
                    {group.is_admin && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-yellow-500 flex items-center justify-center border border-card">
                        <Crown className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate text-sm">{group.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {group.memberCount || 0} members
                    </div>
                  </div>
                </button>
                {group.is_admin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover/item:opacity-100 transition-opacity text-destructive hover:bg-destructive/10 flex-shrink-0"
                    onClick={(e) => handleDeleteGroup(group.id, group.name, e)}
                    title="Delete group"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Contacts */}
      <div className="flex-1 overflow-y-auto">
        <ContactList />
      </div>

      {/* Footer */}
      <div className="border-t border-border mt-auto">
        <ConnectionStatus />
        <div className="p-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
                <span className="font-medium text-primary">
                  {user?.fullName?.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-card" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{user?.fullName}</p>
              <p className="text-xs text-muted-foreground truncate">@{user?.username}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Send Invitation Dialog */}
      {showInvitation && (
        <SendInvitation onClose={() => setShowInvitation(false)} />
      )}

      {/* Manage Users Dialog */}
      {showManageUsers && (
        <ManageUsers onClose={() => setShowManageUsers(false)} />
      )}

      {/* Create Group Dialog */}
      {showCreateGroup && (
        <CreateGroupDialog 
          onClose={() => setShowCreateGroup(false)}
          onGroupCreated={handleGroupCreated}
        />
      )}
    </div>
  );
}
