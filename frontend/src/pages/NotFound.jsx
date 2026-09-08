import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';

export default function NotFound() {
  return (
    <div className="notfound">
      <div className="notfound-code">404</div>
      <h1>Page not found</h1>
      <p>The page you are looking for doesn't exist or has been moved.</p>
      <Link to="/dashboard" className="btn primary"><Icon name="dashboard" size={15} /> Back to Dashboard</Link>
    </div>
  );
}