import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getErrorMessage, registerCustomer } from '../services/api';

const validate = ({ fullName, email, password, phone }) => {
  const errors = {};
  if (!fullName.trim()) errors.fullName = 'Full name is required';
  if (!email.trim()) errors.email = 'Email is required';
  else if (!/^\S+@\S+\.\S+$/.test(email.trim())) errors.email = 'Enter a valid email address';
  if (!password) errors.password = 'Password is required';
  else if (password.length < 6) errors.password = 'Password must be at least 6 characters';
  if (!phone.trim()) errors.phone = 'Phone number is required';
  else if (!/^\d{10}$/.test(phone.trim())) errors.phone = 'Phone number must be 10 digits';
  return errors;
};

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', phone: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      await registerCustomer(form);
      navigate('/login', { state: { registered: true, email: form.email.trim() } });
    } catch (err) {
      setServerError(getErrorMessage(err, 'Registration failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const field = (name, label, type, placeholder) => (
    <div className="form-group">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        className={`form-control ${errors[name] ? 'invalid' : ''}`}
        placeholder={placeholder}
        value={form[name]}
        onChange={handleChange}
      />
      {errors[name] && <p className="field-error">{errors[name]}</p>}
    </div>
  );

  return (
    <div className="auth-wrap">
      <div className="form-card auth-card">
        <div className="card-title-row">
          <h3>Create your account</h3>
        </div>
        {serverError && <div className="alert-box error">{serverError}</div>}
        <form onSubmit={handleSubmit} noValidate>
          {field('fullName', 'Full Name', 'text', 'John Doe')}
          {field('email', 'Email', 'email', 'john@gmail.com')}
          {field('password', 'Password', 'password', 'At least 6 characters')}
          {field('phone', 'Phone Number', 'tel', '9876543210')}
          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
