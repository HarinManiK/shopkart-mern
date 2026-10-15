import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="page">
      <div className="hero-box">
        <h2>Welcome, {user.fullName}!</h2>
        <p>You're signed in to ShopKart.</p>
        <Link to="/products" className="btn btn-primary" style={{ marginTop: 14 }}>Start Shopping</Link>
      </div>
      <div className="form-card">
        <div className="card-title-row">
          <h3>Your details</h3>
        </div>
        <div className="profile-summary">
          <div className="profile-row"><span className="label">Name</span><span className="val">{user.fullName}</span></div>
          <div className="profile-row"><span className="label">Email</span><span className="val">{user.email}</span></div>
          <div className="profile-row"><span className="label">Phone</span><span className="val">{user.phone}</span></div>
        </div>
      </div>
    </div>
  );
}
