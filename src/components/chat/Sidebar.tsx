import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ContactList } from './ContactList';
import { ConnectionStatus } from './ConnectionStatus';
import { Shield, Settings, LogOut, UserPlus, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SendInvitation } from '@/components/SendInvitation';
import { Badge } from '@/components/ui/badge';

export function Sidebar() {
  const { user, logout } = useAuth();
  const [showInvitation, setShowInvitation] = useState(false);
  const isAdmin = user?.role === 'admin';

  return (
    <div className="w-80 border-r border-border bg-card/30 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-bold text-lg">QuantChat</h1>
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
            <Button variant="ghost" size="icon">
              <Settings className="w-5 h-5 text-muted-foreground" />
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

      {/* Admin Action Buttons */}
      {isAdmin && (
        <div className="p-4 border-b border-border">
          <Button 
            onClick={() => setShowInvitation(true)} 
            className="w-full"
            size="sm"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Invite New User
          </Button>
        </div>
      )}

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
    </div>
  );
}
