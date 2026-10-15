import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectCartCount } from '../features/cart/cartSlice';
import { useAuth } from '../context/AuthContext';
import useWishlistCount from '../hooks/useWishlistCount';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const wishlistCount = useWishlistCount(Boolean(user));
  const cartCount = useSelector(selectCartCount);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header>
      <div className="nav-inner">
        <Link to={user ? '/home' : '/login'} className="brand">
          <div className="brand-mark">SK</div>
          <div className="brand-name">Shop<span>Kart</span></div>
        </Link>

        <nav className="nav-links">
          {user ? (
            <>
              <NavLink to="/home">Home</NavLink>
              <NavLink to="/products">Products</NavLink>
              <NavLink to="/wishlist">
                Wishlist<span className="count-badge">{wishlistCount}</span>
              </NavLink>
              <NavLink to="/cart">
                Cart<span className="count-badge">{cartCount}</span>
              </NavLink>
              <NavLink to="/orders">Orders</NavLink>
              <NavLink to="/profile">Profile</NavLink>
              <span className="nav-user">{user.fullName}</span>
              <button type="button" className="btn btn-outline-danger" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login">Login</NavLink>
              <NavLink to="/register">Register</NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
