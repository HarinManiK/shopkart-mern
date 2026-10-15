// Client-side checks so we don't call the backend with obviously bad data.
// The backend validates again - the client is only for fast feedback.
export const SHIPPING_FIELDS = [
  { name: 'fullName', label: 'Full Name', autoComplete: 'name', full: true },
  { name: 'phone', label: 'Phone', autoComplete: 'tel', inputMode: 'numeric', placeholder: '10-digit number' },
  { name: 'pincode', label: 'Pincode', autoComplete: 'postal-code', inputMode: 'numeric', placeholder: '6 digits' },
  { name: 'addressLine1', label: 'Address', autoComplete: 'address-line1', full: true },
  { name: 'city', label: 'City', autoComplete: 'address-level2' },
  { name: 'state', label: 'State', autoComplete: 'address-level1' }
];

export const validateShipping = (values) => {
  const errors = {};
  for (const { name, label } of SHIPPING_FIELDS) {
    if (!values[name]?.trim()) errors[name] = `${label} is required`;
  }
  if (!errors.phone && !/^\d{10}$/.test(values.phone.trim())) errors.phone = 'Phone number must contain 10 digits';
  if (!errors.pincode && !/^\d{6}$/.test(values.pincode.trim())) errors.pincode = 'Pincode must contain 6 digits';
  return errors;
};
