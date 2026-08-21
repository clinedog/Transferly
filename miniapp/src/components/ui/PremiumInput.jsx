import React from 'react';

export const PremiumInput = React.forwardRef(function PremiumInput({
  as = 'input',
  id,
  type = 'text',
  label,
  value = '',
  onChange,
  onBlur,
  onFocus,
  error,
  helperText,
  icon: Icon,
  disabled = false,
  success = false,
  className = '',
  inputClassName = '',
  options = [],
  rows = 4,
  placeholder,
  ...props
}, ref) {
  const [focused, setFocused] = React.useState(false);
  const generatedId = React.useId();
  const inputId = id || `premium-input-${generatedId}`;
  const messageId = error || helperText ? `${inputId}-message` : undefined;
  const hasValue = value !== undefined && value !== null && String(value).length > 0;
  const isFloating = Boolean(focused || hasValue || as === 'select' || type === 'date');
  const controlClassName = `
    w-full rounded-[18px] border bg-[var(--miniapp-panel-bg,rgba(255,255,255,0.06))]
    ${label ? 'pb-2 pt-6' : 'py-3'} ${Icon ? 'pl-11' : 'pl-4'} pr-4
    text-sm font-bold text-[var(--tg-text-color,#111827)] outline-none
    transition duration-200 placeholder:text-[var(--tg-hint-color,#64748b)]
    border-[var(--miniapp-border-color,rgba(148,163,184,0.24))]
    focus:border-[var(--tg-button-color,#2aabee)] focus:ring-2 focus:ring-[var(--miniapp-focus-ring,rgba(42,171,238,0.22))]
    disabled:cursor-not-allowed disabled:opacity-55
    ${as === 'textarea' ? 'min-h-[118px] resize-y leading-6' : 'min-h-[50px]'}
    ${error ? 'border-[var(--tg-destructive-text-color,#ef4444)] focus:border-[var(--tg-destructive-text-color,#ef4444)] focus:ring-red-500/20' : ''}
    ${success && !error ? 'border-emerald-500/70 focus:border-emerald-500 focus:ring-emerald-500/20' : ''}
    ${inputClassName}
  `;

  const handleFocus = (event) => {
    setFocused(true);
    onFocus?.(event);
  };

  const handleBlur = (event) => {
    setFocused(false);
    onBlur?.(event);
  };

  const sharedProps = {
    id: inputId,
    ref,
    value,
    onChange,
    onFocus: handleFocus,
    onBlur: handleBlur,
    disabled,
    placeholder,
    'aria-invalid': error ? 'true' : 'false',
    'aria-describedby': messageId,
    className: controlClassName,
    ...props
  };

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label htmlFor={inputId} className={`
          pointer-events-none absolute z-10 transition-all duration-200 font-black
          ${Icon ? 'left-11' : 'left-4'}
          ${isFloating
            ? 'top-2 text-[11px] uppercase tracking-[0.12em] text-[var(--tg-hint-color,#64748b)]'
            : 'top-3.5 text-sm text-[var(--tg-hint-color,#64748b)]'
          }
        `}>
          {label}
        </label>
      )}

      <div className="relative">
        {Icon && (
          <Icon className={`
            absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 transform
            transition-colors duration-200 pointer-events-none
            ${focused ? 'text-[var(--tg-button-color)]' : 'text-[var(--tg-hint-color,#64748b)]'}
            ${disabled ? 'opacity-50' : ''}
          `} />
        )}

        {as === 'textarea' ? (
          <textarea {...sharedProps} rows={rows} />
        ) : as === 'select' ? (
          <select {...sharedProps}>
            {placeholder ? <option value="">{placeholder}</option> : null}
            {options.map((option) => {
              const optionValue = typeof option === 'string' ? option : option.value;
              const optionLabel = typeof option === 'string' ? option : option.label;

              return (
                <option key={optionValue} value={optionValue} disabled={option.disabled}>
                  {optionLabel}
                </option>
              );
            })}
          </select>
        ) : (
          <input {...sharedProps} type={type} />
        )}
      </div>

      {error && (
        <p id={messageId} className="miniapp-field-message mt-2 text-sm font-bold text-[var(--tg-destructive-text-color,#ef4444)]">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p id={messageId} className="mt-2 text-xs font-semibold leading-5 text-[var(--tg-hint-color,#64748b)]">
          {helperText}
        </p>
      )}
    </div>
  );
});
