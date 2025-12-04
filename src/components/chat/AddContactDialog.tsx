import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserPlus, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AddContactDialogProps {
  onAddContact: (email: string, displayName?: string) => Promise<void>;
  children?: React.ReactNode;
}

export function AddContactDialog({ onAddContact, children }: AddContactDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!email.trim()) return;
    
    setIsLoading(true);
    try {
      // TODO: Implement actual user search API call
      const response = await fetch(`/api/v1/users/search?email=${encodeURIComponent(email)}`);
      if (response.ok) {
        const results = await response.json();
        setSearchResults(results);
      } else {
        toast({
          title: "User not found",
          description: "No user found with that email address.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Search failed",
        description: "Failed to search for user. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddContact = async () => {
    if (!email.trim()) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await onAddContact(email, displayName || undefined);
      setEmail('');
      setDisplayName('');
      setSearchResults([]);
      setOpen(false);
      toast({
        title: "Contact added",
        description: `${displayName || email} has been added to your contacts.`,
      });
    } catch (error) {
      toast({
        title: "Failed to add contact",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setDisplayName('');
    setSearchResults([]);
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      setOpen(newOpen);
      if (!newOpen) resetForm();
    }}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm" className="w-full justify-start gap-2">
            <UserPlus className="w-4 h-4" />
            Add Contact
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Contact</DialogTitle>
          <DialogDescription>
            Search for a user by email address to add them to your contacts.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="flex gap-2">
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={handleSearch}
                disabled={isLoading || !email.trim()}
              >
                <Search className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="displayName">Display Name (Optional)</Label>
            <Input
              id="displayName"
              placeholder="Enter a custom name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          {searchResults.length > 0 && (
            <div className="grid gap-2">
              <Label>Search Results</Label>
              <div className="border rounded-md max-h-32 overflow-y-auto">
                {searchResults.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-2 hover:bg-secondary cursor-pointer"
                    onClick={() => {
                      setEmail(user.email);
                      setDisplayName(user.full_name || user.username);
                    }}
                  >
                    <div>
                      <div className="font-medium text-sm">{user.full_name || user.username}</div>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                    </div>
                    <Button size="sm" variant="ghost">
                      Select
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            onClick={handleAddContact}
            disabled={isLoading || !email.trim()}
          >
            {isLoading ? "Adding..." : "Add Contact"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}