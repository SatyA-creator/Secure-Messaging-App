import React, { useState } from 'react';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { Shield, Lock, Zap, Users } from 'lucide-react';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-card via-background to-card relative overflow-hidden">
        {/* Gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        
        <div className="relative z-10 flex flex-col justify-center p-12 max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Shield className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold">QuantChat</h1>
              <p className="text-sm text-muted-foreground">End-to-End Encrypted</p>
            </div>
          </div>

          <h2 className="text-4xl font-display font-bold mb-4 leading-tight">
            Private conversations,
            <br />
            <span className="gradient-text">truly private.</span>
          </h2>
          
          <p className="text-muted-foreground mb-10">
            Your messages are encrypted before they leave your device. Not even we can read them.
          </p>

          <div className="space-y-4">
            <FeatureItem
              icon={<Lock className="w-5 h-5" />}
              title="AES-256-GCM Encryption"
              description="Military-grade encryption for every message"
            />
            <FeatureItem
              icon={<Zap className="w-5 h-5" />}
              title="Real-time Delivery"
              description="Messages delivered in under 500ms"
            />
            <FeatureItem
              icon={<Users className="w-5 h-5" />}
              title="Zero-Knowledge"
              description="Server never sees your plaintext messages"
            />
          </div>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <span className="text-xl font-display font-bold">SecureChat</span>
          </div>

          {isLogin ? (
            <LoginForm onSwitchToRegister={() => setIsLogin(false)} />
          ) : (
            <RegisterForm onSwitchToLogin={() => setIsLogin(true)} />
          )}
        </div>
      </div>
    </div>
  );
}

function FeatureItem({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-xl bg-secondary/30 border border-border/50">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
        {icon}
      </div>
      <div>
        <h3 className="font-medium mb-0.5">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
