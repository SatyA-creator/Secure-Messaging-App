import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LoginFormProps {
  onSwitchToRegister: () => void;
}

export function LoginForm({ onSwitchToRegister }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      toast({
        title: "Welcome back!",
        description: "You've been securely authenticated.",
      });
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
            />
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
