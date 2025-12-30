import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, Mail, Lock, ArrowRight, Loader2, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSearchParams, useNavigate } from 'react-router-dom';

interface LoginFormProps {
  onSwitchToRegister: () => void;
}

export function LoginForm({ onSwitchToRegister }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const invitationToken = searchParams.get('invitation');
  const [inviterName, setInviterName] = useState('');

  // Verify invitation token on mount
  useEffect(() => {
    const verifyToken = async (token: string) => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api/v1';
        const response = await fetch(`${API_URL}/invitations/verify/${token}`);
        
        if (!response.ok) {
          toast({
            title: "Invalid invitation",
            description: "This invitation link is invalid or expired.",
            variant: "destructive",
          });
          return;
        }

        const data = await response.json();
        setInviterName(data.inviter_name);
        setEmail(data.invitee_email);
        
        toast({
          title: "Invitation verified!",
          description: `${data.inviter_name} invited you. Please sign in to accept.`,
        });
      } catch (error) {
        console.error('Failed to verify invitation:', error);
      }
    };

    if (invitationToken) {
      verifyToken(invitationToken);
    }
  }, [invitationToken, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await login(email, password);
      
      // Accept invitation if token exists
      if (invitationToken && result?.user?.id) {
        try {
          const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api/v1';
          const acceptResponse = await fetch(`${API_URL}/invitations/accept`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('authToken')}` 
            },
            body: JSON.stringify({
              token: invitationToken,
              new_user_id: result.user.id
            })
          });

          if (acceptResponse.ok) {
            toast({
              title: "Invitation accepted!",
              description: `You and ${inviterName} are now connected. Redirecting...`,
            });
            // Force a reload to ensure ChatContext fetches the new contact
            setTimeout(() => {
              window.location.href = '/';
            }, 1500);
            return;
          }
        } catch (error) {
          console.error('Failed to accept invitation:', error);
        }
      }
      
      toast({
        title: "Welcome back!",
        description: "You've been securely authenticated.",
      });
      
      // Navigate after successful login
      setTimeout(() => navigate('/'), 1000);
    } catch (error) {
      toast({
        title: "Authentication failed",
        description: "Invalid email or password. Try alice@secure.chat / demo123",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="w-full max-w-md animate-in">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
          <Shield className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-3xl font-display font-bold mb-2">Welcome Back</h1>
        <p className="text-muted-foreground">
          Sign in to access your encrypted conversations
        </p>
        
        {inviterName && (
          <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/30">
            <UserPlus className="w-5 h-5 text-primary flex-shrink-0" />
            <p className="text-sm text-primary font-medium">
              Invited by <strong>{inviterName}</strong> - Sign in to accept
            </p>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="pl-11"
              required
              disabled={!!invitationToken}
            />
            {invitationToken && (
              <p className="text-xs text-muted-foreground mt-1">
                Email pre-filled from invitation
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="pl-11"
              required
            />
          </div>
        </div>

        <Button type="submit" variant="glow" className="w-full" size="lg" disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              Sign In
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-muted-foreground">
          Don't have an account?{' '}
          <button
            onClick={onSwitchToRegister}
            className="text-primary hover:underline font-medium"
          >
            Create one
          </button>
        </p>
      </div>

      <div className="mt-8 p-4 rounded-lg bg-secondary/50 border border-border">
        <div className="space-y-2">
          <p className="text-xs font-medium text-center text-primary">Demo Accounts (Fallback):</p>
          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>alice@secure.chat</span>
              <span>demo123</span>
            </div>
            <div className="flex justify-between">
              <span>bob@secure.chat</span>
              <span>demo123</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Create your own account or use demo accounts if database is unavailable
          </p>
        </div>
      </div>
    </div>
  );
}
