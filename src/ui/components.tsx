import { useEffect, useRef, type ReactNode } from 'react';
import type { GroupId } from '../types';
import { GROUP_ICON, GROUP_LABEL, S } from '../strings';

export function Button({
  children,
  onClick,
  variant = 'primary',
  size,
  block,
  disabled,
  type = 'button',
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost' | 'danger';
  size?: 'sm' | 'big';
  block?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}) {
  const cls = ['btn', variant !== 'primary' ? `btn-${variant}` : '', size ? `btn-${size}` : '', block ? 'btn-block' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={cls} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="icon-btn" aria-label={label} onClick={onClick}>
      {children}
    </button>
  );
}

export function Chip({
  children,
  selected,
  resting,
  onClick,
  tag,
}: {
  children: ReactNode;
  selected?: boolean;
  resting?: boolean;
  onClick?: () => void;
  tag?: string;
}) {
  return (
    <button
      type="button"
      className={['chip', selected ? 'selected' : '', resting ? 'resting' : ''].filter(Boolean).join(' ')}
      onClick={onClick}
      aria-pressed={selected}
    >
      {children}
      {tag ? <span className="tag">{tag}</span> : null}
    </button>
  );
}

export function GroupChip({
  group,
  selected,
  resting,
  onClick,
  tag,
}: {
  group: GroupId;
  selected?: boolean;
  resting?: boolean;
  onClick?: () => void;
  tag?: string;
}) {
  return (
    <Chip selected={selected} resting={resting} onClick={onClick} tag={tag}>
      <span aria-hidden="true">{GROUP_ICON[group]}</span> {GROUP_LABEL[group]}
    </Chip>
  );
}

export function Badge({ children, tone = 'soft' }: { children: ReactNode; tone?: 'soft' | 'accent' | 'warning' | 'success' | 'muted' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" aria-label="−" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
        −
      </button>
      <span className="value" aria-live="polite">
        {value}
      </span>
      <button type="button" aria-label="+" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
        +
      </button>
    </div>
  );
}

export function CheckRow({
  checked,
  title,
  sub,
  onToggle,
  trailing,
}: {
  checked: boolean;
  title: ReactNode;
  sub?: ReactNode;
  onToggle: () => void;
  trailing?: ReactNode;
}) {
  return (
    <div className={`check-row ${checked ? 'checked' : ''}`}>
      <button type="button" className="row grow" style={{ minHeight: 48, textAlign: 'left' }} onClick={onToggle} aria-pressed={checked}>
        <span className="box" aria-hidden="true">
          {checked ? '✓' : ''}
        </span>
        <span className="grow">
          <div className="title">{title}</div>
          {sub ? <div className="sub">{sub}</div> : null}
        </span>
      </button>
      {trailing}
    </div>
  );
}

export function ListRow({
  title,
  sub,
  onClick,
  trailing,
  leading,
}: {
  title: ReactNode;
  sub?: ReactNode;
  onClick?: () => void;
  trailing?: ReactNode;
  leading?: ReactNode;
}) {
  const inner = (
    <>
      {leading}
      <span className="grow">
        <div className="title">{title}</div>
        {sub ? <div className="sub">{sub}</div> : null}
      </span>
      {trailing ?? (onClick ? <span className="chevron">›</span> : null)}
    </>
  );
  if (onClick) {
    return (
      <button type="button" className="list-row" onClick={onClick}>
        {inner}
      </button>
    );
  }
  return <div className="list-row">{inner}</div>;
}

export function GroupHeader({ group, trailing }: { group: GroupId; trailing?: ReactNode }) {
  return (
    <div className="group-header">
      <span aria-hidden="true">{GROUP_ICON[group]}</span>
      <span className="grow">{GROUP_LABEL[group]}</span>
      {trailing}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <div className="section-title">{children}</div>;
}

export function Empty({ icon, title, help, action }: { icon: string; title: string; help?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="big" aria-hidden="true">
        {icon}
      </div>
      <h3>{title}</h3>
      {help ? <p className="small" style={{ marginTop: 6 }}>{help}</p> : null}
      {action ? <div style={{ marginTop: 16 }}>{action}</div> : null}
    </div>
  );
}

export function Sheet({
  title,
  onClose,
  children,
  footer,
  full,
  headerRight,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  full?: boolean;
  headerRight?: ReactNode;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div className={`sheet ${full ? 'full' : ''}`} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="grabber" />
        <div className="sheet-header">
          <h2 className="ellipsis">{title}</h2>
          {headerRight}
          <IconButton label={S.common.close} onClick={onClose}>
            ✕
          </IconButton>
        </div>
        <div className="sheet-body">{children}</div>
        {footer ? <div className="sheet-footer">{footer}</div> : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  text,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  text?: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="dialog-backdrop" onClick={onCancel} role="presentation">
      <div className="dialog stack" role="alertdialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {text ? <p className="muted">{text}</p> : null}
        <div className="row" style={{ marginTop: 8 }}>
          <Button variant="secondary" onClick={onCancel} className="grow">
            {S.common.cancel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} className="grow">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Toast({ text, action, onAction, onDismiss, timeout = 4000 }: { text: string; action?: string; onAction?: () => void; onDismiss: () => void; timeout?: number }) {
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  useEffect(() => {
    if (!timeout) return;
    const t = window.setTimeout(() => dismiss.current(), timeout);
    return () => window.clearTimeout(t);
  }, [timeout, text]);
  return (
    <div className="toast" role="status">
      <span className="grow">{text}</span>
      {action && onAction ? (
        <button type="button" className="btn" onClick={onAction}>
          {action}
        </button>
      ) : null}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder, autoFocus }: { value: string; onChange: (v: string) => void; placeholder: string; autoFocus?: boolean }) {
  return (
    <div className="search">
      <span className="icon" aria-hidden="true">
        🔍
      </span>
      <input
        className="input"
        type="search"
        inputMode="search"
        autoCapitalize="none"
        autoCorrect="off"
        enterKeyHint="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus={autoFocus}
      />
      {value ? (
        <span className="clear">
          <IconButton label={S.common.close} onClick={() => onChange('')}>
            ✕
          </IconButton>
        </span>
      ) : null}
    </div>
  );
}

export function Progress({ value, max }: { value: number; max: number }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div className="progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div style={{ width: `${pct}%` }} />
    </div>
  );
}
