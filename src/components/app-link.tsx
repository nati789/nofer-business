'use client';
import NextLink from 'next/link';
import type { ComponentProps } from 'react';

// Each business route already loads the shared snapshot on navigation.
// Avoid speculative RSC requests, which Windows WebKit rejects during route changes.
export default function AppLink(props: ComponentProps<typeof NextLink>) {
  return <NextLink {...props} prefetch={false} />;
}
