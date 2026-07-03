import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { APP_DOWNLOAD_FALLBACK_URL, resolveAppDownload } from '../utils/appDownload';
import '../styles/MainPage.scss';

const Arrow = () => <span aria-hidden="true">↗</span>;

const MainPage = () => {
  const [preparingDownload, setPreparingDownload] = useState(false);

  const downloadApp = async () => {
    if (preparingDownload) return;
    setPreparingDownload(true);
    try {
      const download = await resolveAppDownload();
      window.location.assign(download.url);
    } catch {
      window.location.assign(APP_DOWNLOAD_FALLBACK_URL);
    } finally {
      setPreparingDownload(false);
    }
  };

  return (
    <div className="main-page">
      <header className="landing-header">
        <nav className="landing-shell landing-nav" aria-label="Main navigation">
          <Link to="/" className="landing-brand" aria-label="Intezo home">
            <img src="/web-app-manifest-192x192.png" alt="" aria-hidden="true" />
            <span>Intezo</span>
          </Link>

          <div className="landing-nav__links">
            <a href="#daily-flow">How it works</a>
            <Link to="/doctor/login">Doctor portal</Link>
            <Link to="/clinic/login">Clinic portal <Arrow /></Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-shell landing-hero__grid">
            <div className="landing-hero__copy">
              <p className="landing-label">Queue software for clinics</p>
              <h1>A live clinic queue people can check from anywhere.</h1>
              <p className="landing-hero__lead">
                Patients join from the app and follow their position. Clinic staff
                see the same line. Doctors call the next patient when they are ready.
              </p>
              <div className="landing-hero__actions">
                <Link to="/clinic/register" className="landing-action landing-action--dark">
                  Register your clinic <Arrow />
                </Link>
                <button type="button" onClick={downloadApp} disabled={preparingDownload}>
                  {preparingDownload ? 'Preparing the app…' : 'Download the patient app'} <span>↓</span>
                </button>
              </div>
            </div>

            <aside className="hero-note">
              <p>Made for the busiest hour of the day.</p>
              <dl>
                <div>
                  <dt>Patient</dt>
                  <dd>Joins before leaving home</dd>
                </div>
                <div>
                  <dt>Clinic</dt>
                  <dd>Sees one ordered queue</dd>
                </div>
                <div>
                  <dt>Doctor</dt>
                  <dd>Calls the next patient</dd>
                </div>
              </dl>
            </aside>
          </div>
        </section>

        <section className="queue-board" aria-label="Example live queue">
          <div className="landing-shell queue-board__inner">
            <span className="queue-board__status"><i /> Live queue</span>
            <div><small>Now serving</small><strong>Q-024</strong></div>
            <div><small>Up next</small><strong>Q-025</strong></div>
            <div><small>Patients waiting</small><strong>18</strong></div>
            <div><small>Average wait</small><strong>18 min</strong></div>
            <span className="queue-board__update">Updated just now</span>
          </div>
        </section>

        <section className="day-section" id="daily-flow">
          <div className="landing-shell">
            <div className="day-section__heading">
              <p className="landing-label">A morning with Intezo</p>
              <h2>The queue moves before the waiting room fills.</h2>
            </div>

            <ol className="day-timeline">
              <li>
                <time>09:00</time>
                <div>
                  <strong>A patient joins from the app.</strong>
                  <p>They choose a clinic and service, then receive a queue number.</p>
                </div>
                <span>Patient app</span>
              </li>
              <li>
                <time>09:01</time>
                <div>
                  <strong>The clinic sees the booking.</strong>
                  <p>The new patient appears in the correct doctor’s live queue.</p>
                </div>
                <span>Clinic portal</span>
              </li>
              <li>
                <time>09:18</time>
                <div>
                  <strong>The doctor calls next.</strong>
                  <p>Everyone’s screen updates, without a manual refresh or phone call.</p>
                </div>
                <span>Doctor portal</span>
              </li>
            </ol>
          </div>
        </section>

        <section className="portal-section">
          <div className="landing-shell">
            <div className="portal-section__heading">
              <p className="landing-label">Open your workspace</p>
              <h2>Where do you need to go?</h2>
            </div>

            <div className="portal-list">
              <article>
                <span>01</span>
                <div>
                  <h3>Clinic</h3>
                  <p>Run queues, manage doctors and see the day clearly.</p>
                </div>
                <div className="portal-list__links">
                  <Link to="/clinic/login">Sign in <Arrow /></Link>
                  <Link to="/clinic/register">Create a clinic</Link>
                </div>
              </article>
              <article>
                <span>02</span>
                <div>
                  <h3>Doctor</h3>
                  <p>See assigned queues and move to the next patient.</p>
                </div>
                <div className="portal-list__links">
                  <Link to="/doctor/login">Sign in <Arrow /></Link>
                  <Link to="/doctor/register">Create an account</Link>
                </div>
              </article>
              <article>
                <span>03</span>
                <div>
                  <h3>Patient</h3>
                  <p>Find a clinic, join a queue and follow it on your phone.</p>
                </div>
                <div className="portal-list__links">
                  <button type="button" onClick={downloadApp} disabled={preparingDownload}>
                    {preparingDownload ? 'Preparing…' : 'Download app'} <span>↓</span>
                  </button>
                </div>
              </article>
            </div>
          </div>
        </section>

      </main>

      <footer className="landing-footer">
        <div className="landing-shell landing-footer__grid">
          <Link to="/" className="landing-brand" aria-label="Intezo home">
            <img src="/web-app-manifest-192x192.png" alt="" aria-hidden="true" />
            <span>Intezo</span>
          </Link>
          <p>Live queues for clinics and patients.</p>
          <div>
            <Link to="/clinic/login">Clinic</Link>
            <Link to="/doctor/login">Doctor</Link>
            <Link to="/admin/login">Admin</Link>
          </div>
          <small>© {new Date().getFullYear()}</small>
        </div>
      </footer>
    </div>
  );
};

export default MainPage;
