import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { ENV } from '@/config/env';

export function AcceptInvitation() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [inviterName, setInviterName] = useState('');
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    verifyInvitation();
  }, [token]);

  const verifyInvitation = async () => {
    try {
      const response = await fetch(`${ENV.API_URL}/invitations/verify/${token}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Invalid invitation');
      }

      const data = await response.json();
      setInviterName(data.inviter_name);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired invitation');
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    // Check if user is logged in
    const userId = localStorage.getItem('userId');
    
    if (!userId) {
      // Redirect to register with invitation token
      navigate(`/register?invitation=${token}`);
      return;
    }

    // Accept invitation
    setLoading(true);
    try {
      const response = await fetch(`${ENV.API_URL}/invitations/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token,
          new_user_id: userId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to accept invitation');
      }

      setAccepted(true);
      toast({
        title: "Invitation accepted!",
        description: `You and ${inviterName} are now connected.`,
      });

      // Redirect to chat after 2 seconds
      setTimeout(() => navigate('/chat'), 2000);
    } catch (err) {
      toast({
        title: "Failed to accept invitation",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <XCircle className="w-6 h-6 text-destructive" />
              <CardTitle>Invalid Invitation</CardTitle>
            </div>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/')} className="w-full">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-green-500" />
              <CardTitle>Invitation Accepted!</CardTitle>
            </div>
            <CardDescription>
              You and {inviterName} are now connected. Redirecting to chat...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>You've been invited!</CardTitle>
          <CardDescription>
            <strong>{inviterName}</strong> wants to connect with you on Secure Messaging App.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Accept this invitation to start chatting securely with {inviterName}.
          </p>
          <Button onClick={handleAccept} className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Accepting...
              </>
            ) : (
              'Accept Invitation'
            )}
          </Button>
          <Button 
            variant="outline" 
            onClick={() => navigate('/')} 
            className="w-full"
          >
            Decline
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
