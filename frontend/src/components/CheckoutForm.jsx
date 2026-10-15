import { SHIPPING_FIELDS } from '../utils/validation';

// Controlled shipping form. State lives in the Checkout page (it needs the values
// to prefill Razorpay and to validate before calling the backend).
export default function CheckoutForm({ values, errors, onChange, disabled }) {
  return (
    <div className="form-grid">
      {SHIPPING_FIELDS.map((f) => (
        <div className={`form-group ${f.full ? 'full' : ''}`} key={f.name}>
          <label htmlFor={f.name}>{f.label}</label>
          <input
            id={f.name}
            name={f.name}
            className={`form-control ${errors[f.name] ? 'invalid' : ''}`}
            value={values[f.name]}
            onChange={onChange}
            disabled={disabled}
            autoComplete={f.autoComplete}
            inputMode={f.inputMode}
            placeholder={f.placeholder}
          />
          {errors[f.name] && <p className="field-error">{errors[f.name]}</p>}
        </div>
      ))}
    </div>
  );
}
