import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { loginApi } from '@/services/auth';
import { Zap } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await loginApi(username, password);
      setAuth(result.user, result.accessToken, result.refreshToken);
      navigate('/app');
    } catch {
      setError('Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-scada-bg">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Zap className="w-10 h-10 text-scada-accent" />
            <div>
              <h1 className="text-3xl font-bold">
                <span className="text-scada-accent">Grid</span>
                <span className="text-white">Vision</span>
              </h1>
              <p className="text-xs text-gray-400 tracking-widest">SCADA SYSTEM</p>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            MSEDCL Smart Distribution Substation Monitoring
          </p>
        </div>

        {/* Login Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-scada-panel border border-scada-border rounded-lg p-6 space-y-4"
        >
          <h2 className="text-lg font-semibold text-center mb-4">Operator Login</h2>

          {error && (
            <div className="bg-red-900/30 border border-red-800 text-red-300 text-sm px-3 py-2 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 bg-scada-bg border border-scada-border rounded text-white focus:outline-none focus:border-scada-accent"
              placeholder="Enter username"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-scada-bg border border-scada-border rounded text-white focus:outline-none focus:border-scada-accent"
              placeholder="Enter password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-scada-accent hover:bg-blue-600 disabled:opacity-50 text-white font-medium rounded transition-colors"
          >
            {loading ? 'Authenticating...' : 'Login'}
          </button>

          {/* Demo credentials */}
          <div className="text-center text-xs text-gray-500 mt-4 pt-4 border-t border-scada-border">
            <p className="mb-1">Demo Credentials:</p>
            <p>admin / admin123 | operator1 / operator123</p>
          </div>
        </form>
      </div>
    </div>
  );
}
