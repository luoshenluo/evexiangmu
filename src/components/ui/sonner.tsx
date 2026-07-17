'use client';

import { Toaster as Sonner, type ToasterProps } from 'sonner';

function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="top-center"
      toastOptions={{
        style: {
          background: '#2C2C2C',
          border: '1px solid #3A3A3A',
          color: '#E6E8ED',
          borderRadius: '8px',
        },
      }}
      {...props}
    />
  );
}

export { Toaster };