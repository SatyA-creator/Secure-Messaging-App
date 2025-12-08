import React, { useState } from 'react';
import api from '../services/api';

export default function SendInvitation() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSendInvitation = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await api.post('/api/invitations/send', {
        invitee_email: email,
        frontend_url: window.location.origin
      });

      setMessage(`Invitation sent to ${email}!`);
      setEmail('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Invite a Friend</h2>
      
      {message && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-2 rounded mb-4">
          {message}
        </div>
      )}
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-2 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSendInvitation}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Friend's email address"
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
          required
          disabled={loading}
        />
        
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Sending...' : 'Send Invitation'}
        </button>
      </form>

      <p className="text-sm text-gray-600 mt-4">
        Your friend will receive an email with a link to join your private group.
      </p>
    </div>
  );
}