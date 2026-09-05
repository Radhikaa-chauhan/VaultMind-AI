import type { ReactNode } from 'react';
import type { Page } from '../../types';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function Layout({
  page,
  onChange,
  live,
  children,
}: {
  page: Page;
  onChange: (page: Page) => void;
  live: boolean;
  children: ReactNode;
}) {
  return (
    <div className="app">
      <Sidebar page={page} onChange={onChange} />
      <div className="main">
        <Header page={page} live={live} />
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
