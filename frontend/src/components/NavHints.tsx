interface NavHintsProps {
  visible: boolean;
}

export default function NavHints({ visible }: NavHintsProps) {
  const style = { opacity: visible ? undefined : 0 };
  return (
    <>
      <div className="nav-hint nav-hint-top" style={style}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M18 15l-6-6-6 6" />
        </svg>
        Scroll up
      </div>
      <div className="nav-hint nav-hint-bottom" style={style}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M6 9l6 6 6-6" />
        </svg>
        Scroll or press ↓
      </div>
    </>
  );
}
