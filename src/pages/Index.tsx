import { useAuth } from '@/context/AuthContext';
import Auth from './Auth';
import Chat from './Chat';

const Index = () => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Auth />;
  }

  return <Chat />;
};

export default Index;
