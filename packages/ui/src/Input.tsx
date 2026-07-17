import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

export function Input({
  label,
  error,
  hint,
  required,
  className = "",
  id,
  ...props
}: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="form-group">
      {label && (
        <label
          htmlFor={inputId}
          className={`form-label ${required ? "form-label--required" : ""}`}
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`form-input ${error ? "form-input--error" : ""} ${className}`}
        {...props}
      />
      {error && <span className="form-error">{error}</span>}
      {hint && !error && <span className="form-hint">{hint}</span>}
    </div>
  );
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  required?: boolean;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function Select({
  label,
  error,
  required,
  options,
  placeholder,
  className = "",
  id,
  ...props
}: SelectProps) {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="form-group">
      {label && (
        <label
          htmlFor={selectId}
          className={`form-label ${required ? "form-label--required" : ""}`}
        >
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`form-input ${error ? "form-input--error" : ""} ${className}`}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  required?: boolean;
}

export function TextArea({
  label,
  error,
  required,
  className = "",
  id,
  ...props
}: TextAreaProps) {
  const textId = id || label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="form-group">
      {label && (
        <label
          htmlFor={textId}
          className={`form-label ${required ? "form-label--required" : ""}`}
        >
          {label}
        </label>
      )}
      <textarea
        id={textId}
        className={`form-input ${error ? "form-input--error" : ""} ${className}`}
        {...props}
      />
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}
