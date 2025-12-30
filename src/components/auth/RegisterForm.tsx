import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, Mail, Lock, User, ArrowRight, Loader2, Key, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';

interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

export function RegisterForm({ onSwitchToLogin }: RegisterFormProps) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { register, isLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // ✅ Get invitation token from URL
  const invitationToken = searchParams.get('invitation');
  const [inviterName, setInviterName] = useState('');

  // ✅ Verify invitation token on mount
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
          description: `${data.inviter_name} invited you to join Secure Messaging.`,
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
  
  if (password !== confirmPassword) {
    toast({
      title: "Passwords don't match",
      description: "Please make sure your passwords match.",
      variant: "destructive",
    });
    return;
  }

  if (password.length < 8) {
    toast({
      title: "Password too short",
      description: "Password must be at least 8 characters.",
      variant: "destructive",
    });
    return;
  }

  try {
    // ✅ Register and get response with token
    const result = await register(email, username, password, fullName);
    
    toast({
      title: "Account created!",
      description: "Your encryption keys have been generated securely.",
    });

    // ✅ Accept invitation if token exists
    if (invitationToken && result?.user?.id && result?.token) {
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api/v1';
        const acceptResponse = await fetch(`${API_URL}/invitations/accept`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${result.token}` // ✅ Use the token from registration
          },
          body: JSON.stringify({
            token: invitationToken,
            new_user_id: result.user.id
          })
        });

        if (acceptResponse.ok) {
          toast({
            title: "Invitation accepted!",
            description: `You and ${inviterName} are now connected.`,
          });
        } else {
          const error = await acceptResponse.json();
          console.error('Failed to accept invitation:', error);
        }
      } catch (error) {
        console.error('Failed to accept invitation:', error);
        // Don't block registration flow
      }
    }

    // Navigate to chat
    setTimeout(() => navigate('/'), 1500);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Something went wrong. Please try again.";
    
    // Check if error is due to user already existing
    if (errorMessage.toLowerCase().includes('already exist') || errorMessage.toLowerCase().includes('email already registered')) {
      toast({
        title: "Account already exists",
        description: invitationToken 
          ? "This email is already registered. Please sign in to accept the invitation."
          : "This email is already registered. Please sign in instead.",
        variant: "destructive",
      });
      
      // Auto-switch to login if there's an invitation token
      if (invitationToken) {
        setTimeout(() => onSwitchToLogin(), 2000);
      }
    } else {
      toast({
        title: "Registration failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }
};


  return (
    <div className="w-full max-w-md animate-in">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
          <Key className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-3xl font-display font-bold mb-2">Create Account</h1>
        <p className="text-muted-foreground">
          Generate your encryption keys and start messaging securely
        </p>
        
        {/* ✅ Show invitation banner if token exists */}
        {inviterName && (
          <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/30">
            <UserPlus className="w-5 h-5 text-primary flex-shrink-0" />
            <p className="text-sm text-primary font-medium">
              Invited by <strong>{inviterName}</strong>
            </p>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Full Name</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="John Doe"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="pl-11"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Username</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
            <Input
              type="text"
              placeholder="username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="pl-9"
              required
            />
          </div>
        </div>

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
              disabled={!!invitationToken} // ✅ Disable if from invitation
            />
          </div>
          {invitationToken && (
            <p className="text-xs text-muted-foreground">
              Email pre-filled from invitation
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
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

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Confirm</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <Shield className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            We'll generate a unique RSA-2048 key pair for your account. Your private key never leaves your device.
          </p>
        </div>

        <Button type="submit" variant="glow" className="w-full" size="lg" disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              {invitationToken ? 'Create Account & Accept Invitation' : 'Create Account'}
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-muted-foreground">
          Already have an account?{' '}
          <button
            onClick={onSwitchToLogin}
            className="text-primary hover:underline font-medium"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
