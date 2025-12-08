import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function AcceptInvitation() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    verifyInvitation();
  }, [token]);

  const verifyInvitation = async () => {
    try {
      const response = await api.get(`/api/invitations/verify/${token}`);
      setInvitation(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    try {
      const response = await api.post(`/api/invitations/accept/${token}`);
      
      // Redirect to chat with newly connected user
      navigate(`/chat/${response.data.contact_id}`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to accept invitation');
    }
  };

  if (loading) {
    return <div className="text-center p-8">Loading invitation...</div>;
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto p-6 bg-red-50 border border-red-200 rounded-lg mt-8">
        <h2 className="text-red-800 font-bold">Invalid Invitation</h2>
        <p className="text-red-700">{error}</p>
        <button
          onClick={() => navigate('/login')}
          className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          Return to Login
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md mt-8">
      <h2 className="text-2xl font-bold mb-4">Accept Invitation</h2>
      
      <p className="text-gray-700 mb-4">
        <strong>{invitation.inviter_name}</strong> has invited you to join the Secure Messaging App.
      </p>

      {invitation.inviter_avatar && (
        <img
          src={invitation.inviter_avatar}
          alt={invitation.inviter_name}
          className="w-16 h-16 rounded-full mx-auto mb-4"
        />
      )}

      <p className="text-sm text-gray-600 mb-6">
        Expires: {new Date(invitation.expires_at).toLocaleDateString()}
      </p>

      <button
        onClick={handleAccept}
        className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 mb-3"
      >
        Accept & Start Chatting
      </button>

      <button
        onClick={() => navigate('/')}
        className="w-full bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
      >
        Cancel
      </button>
    </div>
  );
}