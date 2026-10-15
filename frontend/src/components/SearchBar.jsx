import { CATEGORIES } from '../utils/constants';

export default function SearchBar({ search, category, sort, onSearchChange, onCategoryChange, onSortChange }) {
  return (
    <div className="toolbar">
      <input
        type="search"
        className="form-control search-input"
        placeholder="Search products..."
        aria-label="Search products"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <select
        className="form-control"
        aria-label="Category"
        value={category}
        onChange={(e) => onCategoryChange(e.target.value)}
      >
        <option value="">All Categories</option>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <select
        className="form-control"
        aria-label="Sort"
        value={sort}
        onChange={(e) => onSortChange(e.target.value)}
      >
        <option value="">Newest first</option>
        <option value="price_asc">Price: Low to High</option>
        <option value="price_desc">Price: High to Low</option>
      </select>
    </div>
  );
}
