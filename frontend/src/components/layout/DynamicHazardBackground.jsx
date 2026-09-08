import { motion } from 'framer-motion'

export default function DynamicHazardBackground({ theme }) {
  return (
    <motion.div
      key={theme.id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      className="pointer-events-none fixed inset-0 -z-10"
      style={{ background: `radial-gradient(circle at 15% 10%, ${theme.glow}, transparent 34%)` }}
    />
  )
}
