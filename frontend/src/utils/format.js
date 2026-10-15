export const formatPrice = (amount) =>
  `₹${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

// Stock status shown on cards and details. "low" kicks in at 5 units or fewer.
export const stockInfo = (stock) => {
  if (stock <= 0) return { className: 'out', label: 'Out of stock' };
  if (stock <= 5) return { className: 'low', label: `Only ${stock} left` };
  return { className: 'in', label: `${stock} units left` };
};

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
