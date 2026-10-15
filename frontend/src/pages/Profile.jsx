import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { changePassword, getErrorMessage } from '../services/api';

export default function Profile() {
  const { user } = useAuth();
  const [form, setForm] = useState({ oldPassword: '', newPassword: '' });
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    if (form.newPassword.length < 6) {
      setMessage({ type: 'error', text: 'New password must be at least 6 characters' });
      return;
    }
    setSubmitting(true);
    try {
      const data = await changePassword(form);
      setMessage({ type: 'success', text: data.message });
      setForm({ oldPassword: '', newPassword: '' });
    } catch (err) {
      setMessage({ type: 'error', text: getErrorMessage(err, 'Could not change password') });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page narrow">
      <div className="form-card">
        <div className="card-title-row"><h3>My Profile</h3></div>
        <div className="profile-summary">
          <div className="profile-row"><span className="label">Name</span><span className="val">{user.fullName}</span></div>
          <div className="profile-row"><span className="label">Email</span><span className="val">{user.email}</span></div>
          <div className="profile-row"><span className="label">Phone</span><span className="val">{user.phone}</span></div>
        </div>
      </div>

      <div className="form-card">
        <div className="card-title-row"><h3>Change Password</h3></div>
        {message && <div className={`alert-box ${message.type}`}>{message.text}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="oldPassword">Current Password</label>
            <input id="oldPassword" name="oldPassword" type="password" className="form-control"
              value={form.oldPassword} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label htmlFor="newPassword">New Password</label>
            <input id="newPassword" name="newPassword" type="password" className="form-control"
              value={form.newPassword} onChange={handleChange} required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
