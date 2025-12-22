import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { ENV } from '@/config/env';

export function AcceptInvitation() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [inviterName, setInviterName] = useState('');
  const [inviteeEmail, setInviteeEmail] = useState('');
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    verifyAndAutoAccept();
  }, [token]);

  const verifyAndAutoAccept = async () => {
    try {
      // Step 1: Verify invitation
      const response = await fetch(`${ENV.API_URL}/invitations/verify/${token}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Invalid invitation');
      }

      const data = await response.json();
      setInviterName(data.inviter_name);
      setInviteeEmail(data.invitee_email);
      
      // Step 2: Check if user is logged in
      const userId = localStorage.getItem('userId');
      const userEmail = localStorage.getItem('userEmail');
      
      if (userId && userEmail) {
        // User is logged in - auto-accept if email matches
        if (userEmail.toLowerCase() === data.invitee_email.toLowerCase()) {
          await autoAcceptInvitation(userId, data.inviter_name);
        } else {
          // Logged in as different user
          setError(`This invitation is for ${data.invitee_email}. You are logged in as ${userEmail}. Please log out and try again.`);
          setLoading(false);
        }
      } else {
        // Not logged in - show accept button
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired invitation');
      setLoading(false);
    }
  };

  const autoAcceptInvitation = async (userId: string, inviterName: string) => {
    try {
      const response = await fetch(`${ENV.API_URL}/invitations/accept`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          token: token,
          new_user_id: userId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to accept invitation');
      }

      setAccepted(true);
      toast({
        title: "Invitation accepted!",
        description: `You and ${inviterName} are now connected.`,
      });

      // Redirect to chat after 1.5 seconds
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to accept invitation";
      setError(errorMsg);
      setLoading(false);
      toast({
        title: "Failed to accept invitation",
        description: errorMsg,
        variant: "destructive",
      });
    }
  };

  const handleAccept = async () => {
    // Check if user is logged in
    const userId = localStorage.getItem('userId');
    const userEmail = localStorage.getItem('userEmail');
    
    if (!userId) {
      // Redirect to login/register with invitation token
      // Store invitation token for after registration
      sessionStorage.setItem('pendingInvitation', token || '');
      navigate(`/?invitation=${token}`);
      return;
    }

    // Check if email matches
    if (userEmail && inviteeEmail && userEmail.toLowerCase() !== inviteeEmail.toLowerCase()) {
      toast({
        title: "Email mismatch",
        description: `This invitation is for ${inviteeEmail}. Please log out and use the correct account.`,
        variant: "destructive",
      });
      return;
    }

    // Accept invitation
    setLoading(true);
    await autoAcceptInvitation(userId, inviterName);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-muted">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Verifying invitation...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 bg-gradient-to-br from-background to-muted">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <XCircle className="w-6 h-6 text-destructive" />
              <CardTitle>Unable to Process Invitation</CardTitle>
            </div>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button onClick={() => navigate('/')} className="w-full">
              Go to Home
            </Button>
            {error.includes('logged in as') && (
              <Button 
                variant="outline" 
                onClick={() => {
                  localStorage.clear();
                  sessionStorage.clear();
                  window.location.href = `/accept-invitation/${token}`;
                }} 
                className="w-full"
              >
                Log Out and Try Again
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 bg-gradient-to-br from-background to-muted">
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
          <CardContent>
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gradient-to-br from-background to-muted">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">You've Been Invited!</CardTitle>
          <CardDescription className="text-base">
            <strong className="text-foreground">{inviterName}</strong> wants to connect with you on QuantChat.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {inviteeEmail && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Invitation sent to:</p>
              <p className="text-sm font-medium">{inviteeEmail}</p>
            </div>
          )}
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
