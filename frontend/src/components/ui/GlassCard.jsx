export default function GlassCard({ children, className = '', ...props }) {
  return <section className={`glass panel ${className}`} {...props}>{children}</section>
}
