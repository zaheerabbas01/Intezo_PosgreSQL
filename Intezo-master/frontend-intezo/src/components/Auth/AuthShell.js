import React from 'react';
import { Link } from 'react-router-dom';
import '../../styles/AuthPages.scss';

const AuthShell = ({
  role,
  title,
  intro,
  asideTitle,
  asideBody,
  asideItems,
  variant = 'login',
  children
}) => (
  <div className={`auth-page auth-page--${variant}`}>
    <aside className="auth-story">
      <Link to="/" className="auth-brand" aria-label="Intezo home">
        <img src="/web-app-manifest-192x192.png" alt="" aria-hidden="true" />
        <span>Intezo</span>
      </Link>

      <div className="auth-story__copy">
        <p className="auth-kicker">{role}</p>
        <h1>{asideTitle}</h1>
        <p>{asideBody}</p>
      </div>

      <dl className="auth-story__list">
        {asideItems.map((item, index) => (
          <div key={item}>
            <dt>{String(index + 1).padStart(2, '0')}</dt>
            <dd>{item}</dd>
          </div>
        ))}
      </dl>

      <p className="auth-story__footer">Live clinic queues, shared clearly.</p>
    </aside>

    <main className="auth-panel">
      <div className="auth-panel__inner">
        <Link to="/" className="auth-home-link">← Back to Intezo</Link>
        <header className="auth-heading">
          <p className="auth-kicker">{role}</p>
          <h2>{title}</h2>
          <p>{intro}</p>
        </header>
        {children}
      </div>
    </main>
  </div>
);

export default AuthShell;
