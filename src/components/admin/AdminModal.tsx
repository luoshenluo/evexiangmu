import { useEffect, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface AdminModalProps {
  open: boolean;
  onClose?: () => void;
  icon?: ReactNode;
  iconBgClass?: string;
  iconColorClass?: string;
  title: string;
  description?: string;
  children?: ReactNode;
  /** 是否点击遮罩关闭，默认 false */
  closeOnOverlay?: boolean;
}

export default function AdminModal({
  open,
  onClose,
  icon,
  iconBgClass = 'bg-[#7C3AED]/15',
  iconColorClass = 'text-[#A78BFA]',
  title,
  description,
  children,
  closeOnOverlay = false,
}: AdminModalProps) {
  // ESC 键关闭
  useEffect(() => {
    if (!open || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          {/* 遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => closeOnOverlay && onClose?.()}
          />
          {/* 卡片 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 10 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-sm overflow-hidden rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] p-5 shadow-2xl"
          >
            {/* 图标 */}
            {icon && (
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-full ${iconBgClass} ${iconColorClass}`}
                >
                  {icon}
                </div>
              </div>
            )}

            {/* 标题 */}
            <h3 className="text-center text-base font-semibold text-white">
              {title}
            </h3>

            {/* 描述 */}
            {description && (
              <p className="mt-1.5 text-center text-sm text-[#A0A0A0]">
                {description}
              </p>
            )}

            {/* 底部内容（按钮等） */}
            {children && <div className="mt-5">{children}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
