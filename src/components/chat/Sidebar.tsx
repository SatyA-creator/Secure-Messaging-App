import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { ContactList } from './ContactList';
import { ConnectionStatus } from './ConnectionStatus';
import { Shield, Settings, LogOut, UserPlus, Crown, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  const { selectGroup } = useChat();
  const [showInvitation, setShowInvitation] = useState(false);
  const [showManageUsers, setShowManageUsers] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groups, setGroups] = useState<any[]>([]);
  const isAdmin = user?.role === 'admin';

  // Load groups when component mounts and user changes
  useEffect(() => {
    console.log('🔄 Sidebar useEffect triggered, user:', user?.id);
    
    if (user?.id) {
      console.log('✅ User is authenticated, loading groups...');
      loadGroups();
      
      // Listen for group-related WebSocket events
      const wsService = WebSocketService.getInstance();
      
      const handleGroupUpdate = (data: any) => {
        console.log('🔔 Received group update notification:', data);
        // Reload groups when user is added to a group or group is created
        loadGroups();
      };
      
      // Register listeners for group events
      wsService.on('group_created', handleGroupUpdate);
      wsService.on('added_to_group', handleGroupUpdate);
      wsService.on('group_updated', handleGroupUpdate);
      
      // Cleanup listeners on unmount
      return () => {
        wsService.off('group_created', handleGroupUpdate);
        wsService.off('added_to_group', handleGroupUpdate);
        wsService.off('group_updated', handleGroupUpdate);
      };
    } else {
      console.log('⚠️ User not authenticated yet, skipping group load');
    }
  }, [user?.id]); // Depend on user.id instead of user object

  const loadGroups = async () => {
    try {
      console.log('📋 Loading groups for user:', user?.id);
      console.log('🔍 Making API call to /groups...');
      
      const response = await api.get('/groups');
      
      console.log('✅ API Response received');
      console.log('📦 Response status:', response.status);
      console.log('📦 Response data:', response.data);
      console.log('📊 Total groups:', response.data?.length || 0);
      
      // Ensure we have an array
      const groupsData = Array.isArray(response.data) ? response.data : [];
      
      if (groupsData.length > 0) {
        console.log('✅ Groups found:', groupsData.map(g => g.name).join(', '));
      } else {
        console.log('⚠️ No groups found for this user');
      }
      
      setGroups(groupsData);
      console.log('✅ Groups state updated, count:', groupsData.length);
      
    } catch (err: any) {
      console.error('❌ Error loading groups:', err);
      console.error('Error response:', err.response?.data);
      console.error('Error status:', err.response?.status);
      console.error('Error message:', err.message);
      setGroups([]);
    }
  };

const handleGroupCreated = (newGroup: any) => {
  console.log('🎉 Group created:', newGroup);
  
  // ✅ FIX 1: Immediately update local state for instant UI feedback
  const createdGroup = {
    id: newGroup.id,
    name: newGroup.name,
    description: newGroup.description,
    memberCount: newGroup.memberCount || 1,
    admin_id: newGroup.admin_id,
    created_at: newGroup.created_at
  };
  
  // Add to local state immediately
  setGroups(prev => {
    const groupExists = prev.some(g => g.id === createdGroup.id);
    if (!groupExists) {
      console.log('✅ Added new group to local state:', createdGroup.name);
      return [createdGroup, ...prev];
    }
    return prev;
  });
  
  // ✅ FIX 2: Wait 500ms for backend database to commit before reload
  // This ensures /groups endpoint will return the new group
  setTimeout(() => {
    console.log('🔄 Syncing groups with server (500ms delay to allow DB commit)');
    loadGroups().then(() => {
      console.log('✅ Groups synced with server, count:', groups.length);
      
      // ✅ FIX 3: Select the newly created group
      if (newGroup?.id) {
        setTimeout(() => {
          console.log('🎯 Selecting newly created group:', newGroup.id);
          selectGroup(newGroup.id);
        }, 100);
      }
    }).catch(err => {
      console.error('❌ Failed to sync groups:', err);
    });
  }, 500); // 500ms delay for DB transaction
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
            <DropdownMenuItem>
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

      {/* Create Group Button - Available to All Users */}
      <div className="p-3 md:p-4 border-b border-border">
        <Button 
          onClick={() => setShowCreateGroup(true)} 
          className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
          size="sm"
        >
          <Users className="w-4 h-4 mr-2" />
          Create Group Chat
        </Button>
      </div>

      {/* Admin Action Buttons */}
      {isAdmin && (
        <div className="p-3 md:p-4 border-b border-border space-y-2">
          <Button 
            onClick={() => setShowInvitation(true)} 
            className="w-full"
            size="sm"
            variant="default"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Invite New User
          </Button>
          <Button 
            onClick={() => setShowManageUsers(true)} 
            className="w-full"
            size="sm"
            variant="outline"
          >
            <Users className="w-4 h-4 mr-2" />
            Manage Users
          </Button>
        </div>
      )}

      {/* Groups List */}
      <div className="p-3 md:p-4 border-b border-border">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-3 px-1">
          Group Chats ({groups.length})
        </h3>
        {groups.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3 px-1">
            No groups yet. Create one to get started!
          </p>
        ) : (
          <div className="space-y-1">
            {groups.map(group => (
              <button
                key={group.id}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-all duration-200 text-left group hover:shadow-sm border border-transparent hover:border-border"
                onClick={() => {
                  console.log('Selecting group:', group);
                  selectGroup(group.id);
                  if (onSelectContact) onSelectContact();
                }}
              >
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg shadow-md group-hover:shadow-lg transition-shadow">
                  {group.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate text-sm">{group.name}</div>
                  <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    <span>{group.description || `${group.memberCount || 0} members`}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Contacts */}
      <ContactList />

      {/* Footer */}
      <div className="border-t border-border">
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

