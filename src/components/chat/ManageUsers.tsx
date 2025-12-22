import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ENV } from '@/config/env';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Users, UserPlus, UserMinus, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface RegisteredUser {
  id: string;
  email: string;
  username: string;
  full_name: string;
  role: string;
  is_contact: boolean;
  created_at: string;
}

export function ManageUsers({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${ENV.API_URL}/admin/all-users/${user.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data);
    } catch (err) {
      toast({
        title: "Failed to load users",
        description: err instanceof Error ? err.message : 'Please try again',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [user]);

  const handleAddContact = async (userId: string) => {
    if (!user?.id) return;
    
    setActionLoading(userId);
    try {
      const response = await fetch(`${ENV.API_URL}/admin/add-contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          admin_id: user.id,
          user_id: userId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to add contact');
      }

      toast({
        title: "Contact added!",
        description: "User added to your contacts successfully",
      });

      // Refresh the list
      await fetchUsers();
    } catch (err) {
      toast({
        title: "Failed to add contact",
        description: err instanceof Error ? err.message : 'Please try again',
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveContact = async (userId: string) => {
    if (!user?.id) return;
    
    setActionLoading(userId);
    try {
      const response = await fetch(`${ENV.API_URL}/admin/remove-contact/${user.id}/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to remove contact');
      }

      toast({
        title: "Contact removed",
        description: "User removed from your contacts",
      });

      // Refresh the list
      await fetchUsers();
    } catch (err) {
      toast({
        title: "Failed to remove contact",
        description: err instanceof Error ? err.message : 'Please try again',
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Manage Users
              </DialogTitle>
              <DialogDescription>
                View all registered users and manage contacts
              </DialogDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchUsers}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No other users registered yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {users.map((regUser) => (
                <div
                  key={regUser.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{regUser.full_name || regUser.username}</p>
                      {regUser.is_contact && (
                        <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                          Contact
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      @{regUser.username} • {regUser.email}
                    </p>
                  </div>

                  <div className="ml-3">
                    {regUser.is_contact ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveContact(regUser.id)}
                        disabled={actionLoading === regUser.id}
                      >
                        {actionLoading === regUser.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <UserMinus className="w-4 h-4 mr-1" />
                            Remove
                          </>
                        )}
                      </Button>
                    ) : (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleAddContact(regUser.id)}
                        disabled={actionLoading === regUser.id}
                      >
                        {actionLoading === regUser.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <UserPlus className="w-4 h-4 mr-1" />
                            Add
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t pt-4">
          <Button onClick={onClose} variant="outline" className="w-full">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
